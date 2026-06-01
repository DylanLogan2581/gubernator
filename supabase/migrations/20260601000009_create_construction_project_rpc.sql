-- Migration: create_construction_project_rpc
-- SECURITY DEFINER RPC that creates a new construction project for a settlement.
-- Authorised callers: settlement_manager, nation_manager, world_admin, super_admin
-- (resolved via current_user_manages_settlement).
--
-- Error contract:
--   P0002 (no_data_found)          – null params, settlement / blueprint / tier not found,
--                                    or blueprint belongs to a different world
--   42501 (insufficient_privilege) – caller lacks manage-settlement permission
--   P0001 (raise_exception)        – blueprint is trashed, or max_instances exceeded
-- ---------------------------------------------------------------------------
create or replace function public.create_construction_project (
  p_settlement_id uuid,
  p_blueprint_id uuid,
  p_target_tier_id uuid
) returns setof public.construction_projects language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id       uuid;
  v_blueprint_id   uuid;
  v_max            integer;
  v_is_trashed     boolean;
  v_active_count   integer;
  v_queue_position integer;
  v_row            public.construction_projects%rowtype;
begin
  -- Null guard
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
  if not exists (
    select 1
    from public.building_blueprint_tiers t
    where t.id = p_target_tier_id
      and t.building_blueprint_id = p_blueprint_id
  ) then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Lock before counting and inserting to prevent race conditions
  lock table public.construction_projects in share row exclusive mode;

  -- Check max_instances_per_settlement if a cap is set.
  -- Counts active settlement_buildings + non-terminal construction_projects.
  if v_max is not null then
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
    status,
    queue_position,
    progress_worker_turns
  ) values (
    p_settlement_id,
    p_blueprint_id,
    p_target_tier_id,
    'queued',
    v_queue_position,
    0
  )
  returning * into v_row;

  return next v_row;
end;
$$;

revoke all on function public.create_construction_project (uuid, uuid, uuid)
from
  public;

grant
execute on function public.create_construction_project (uuid, uuid, uuid) to authenticated;
