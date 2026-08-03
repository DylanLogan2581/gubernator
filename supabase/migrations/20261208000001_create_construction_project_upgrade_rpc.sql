-- Migration: create_construction_project_upgrade_rpc
-- #1372: extends create_construction_project with an optional
-- p_upgrade_settlement_building_id. When null the behaviour is unchanged
-- (direct build). When set the project upgrades that existing building in
-- place; the RPC validates that the building exists in this settlement, is
-- active, matches the blueprint, has no in-flight upgrade already, and that the
-- target tier is strictly higher than the building's current tier.
--
-- Error contract (adds upgrade cases to the existing one):
--   P0002 (no_data_found)          – null required params, settlement / blueprint / tier
--                                    not found, blueprint in another world, or upgrade
--                                    building not found / not in this settlement / wrong blueprint
--   42501 (insufficient_privilege) – caller lacks manage-settlement permission
--   P0001 (raise_exception)        – world archived, blueprint trashed, upgrade building not
--                                    active, target tier not higher than current, or an upgrade
--                                    is already in flight for the building
--   23514 (check_violation)        – max_instances exceeded (direct build only)
-- ---------------------------------------------------------------------------
-- Drop the previous 3-arg signature so the 4-arg version below is the only one.
drop function if exists public.create_construction_project (uuid, uuid, uuid);

create or replace function public.create_construction_project (
  p_settlement_id uuid,
  p_blueprint_id uuid,
  p_target_tier_id uuid,
  p_upgrade_settlement_building_id uuid default null
) returns setof public.construction_projects language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id            uuid;
  v_blueprint_id        uuid;
  v_max                 integer;
  v_is_trashed          boolean;
  v_active_count        integer;
  v_queue_position      integer;
  v_target_tier_number  integer;
  v_building_blueprint  uuid;
  v_building_state      text;
  v_current_tier_number integer;
  v_row                 public.construction_projects%rowtype;
begin
  -- Null guard (upgrade building is optional)
  if p_settlement_id is null or p_blueprint_id is null or p_target_tier_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve settlement world via nation chain
  select n.world_id
  into v_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Archived world guard
  if public.world_is_archived(v_world_id) then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  -- Auth: settlement manager, nation manager, world admin, or super admin
  if not public.current_user_manages_settlement(p_settlement_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Validate blueprint: must exist in this world
  select bb.id, bb.max_instances_per_settlement, bb.is_trashed
  into v_blueprint_id, v_max, v_is_trashed
  from public.building_blueprints bb
  where bb.id = p_blueprint_id
    and bb.world_id = v_world_id;

  if v_blueprint_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_is_trashed then
    raise exception 'blueprint is trashed' using errcode = 'P0001';
  end if;

  -- Validate tier: must belong to this blueprint
  select t.tier_number
  into v_target_tier_number
  from public.building_blueprint_tiers t
  where t.id = p_target_tier_id
    and t.building_blueprint_id = p_blueprint_id;

  if v_target_tier_number is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Upgrade validation
  if p_upgrade_settlement_building_id is not null then
    select sb.building_blueprint_id, sb.state, ct.tier_number
    into v_building_blueprint, v_building_state, v_current_tier_number
    from public.settlement_buildings sb
    join public.building_blueprint_tiers ct on ct.id = sb.current_tier_id
    where sb.id = p_upgrade_settlement_building_id
      and sb.settlement_id = p_settlement_id;

    if v_building_blueprint is null then
      raise exception 'upgrade building not found' using errcode = 'P0002';
    end if;

    if v_building_blueprint <> p_blueprint_id then
      raise exception 'upgrade building blueprint mismatch' using errcode = 'P0002';
    end if;

    if v_building_state <> 'active' then
      raise exception 'upgrade building is not active' using errcode = 'P0001';
    end if;

    if v_target_tier_number <= v_current_tier_number then
      raise exception 'target tier must be higher than the current tier' using errcode = 'P0001';
    end if;
  end if;

  -- Lock before counting and inserting to prevent race conditions
  lock table public.construction_projects in share row exclusive mode;

  if p_upgrade_settlement_building_id is not null then
    -- Reject a second concurrent upgrade of the same building.
    if exists (
      select 1
      from public.construction_projects cp
      where cp.upgrade_settlement_building_id = p_upgrade_settlement_building_id
        and cp.status in ('queued', 'in_progress', 'paused')
    ) then
      raise exception 'an upgrade is already in progress for this building' using errcode = 'P0001';
    end if;
  elsif v_max is not null then
    -- Direct-build max_instances_per_settlement check. Counts active
    -- settlement_buildings + non-terminal direct-build construction_projects.
    -- Upgrade projects are excluded (they reuse an existing instance).
    select count(*)
    into v_active_count
    from (
      select id
      from public.settlement_buildings sb
      where sb.settlement_id = p_settlement_id
        and sb.building_blueprint_id = p_blueprint_id
        and sb.state = 'active'
      union all
      select id
      from public.construction_projects cp
      where cp.settlement_id = p_settlement_id
        and cp.building_blueprint_id = p_blueprint_id
        and cp.upgrade_settlement_building_id is null
        and cp.status in ('queued', 'in_progress', 'paused')
    ) combined;

    if v_active_count >= v_max then
      raise exception 'maximum number of instances reached for this blueprint'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Derive queue_position as one past the current highest among non-terminal rows
  select coalesce(max(cp.queue_position), 0) + 1
  into v_queue_position
  from public.construction_projects cp
  where cp.settlement_id = p_settlement_id
    and cp.status in ('queued', 'in_progress', 'paused');

  -- Insert the new project
  insert into public.construction_projects (
    settlement_id,
    building_blueprint_id,
    target_tier_id,
    upgrade_settlement_building_id,
    status,
    queue_position,
    progress_worker_turns
  ) values (
    p_settlement_id,
    p_blueprint_id,
    p_target_tier_id,
    p_upgrade_settlement_building_id,
    'queued',
    v_queue_position,
    0
  )
  returning * into v_row;

  return next v_row;
end;
$$;

revoke all on function public.create_construction_project (uuid, uuid, uuid, uuid)
from
  public;

grant
execute on function public.create_construction_project (uuid, uuid, uuid, uuid) to authenticated;
