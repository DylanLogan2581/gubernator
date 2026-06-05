-- Migration: add_settlement_building_as_admin_rpc
-- Adds an optional per-instance name column to settlement_buildings and a
-- SECURITY DEFINER RPC for world admins / super admins to insert a building
-- directly, bypassing the construction queue.
--
-- Authorization: super admin OR is_world_admin only — managers are excluded.
--
-- Error contract:
--   P0002 (no_data_found)          – null param, settlement not found, blueprint
--                                    not found or belongs to a different world,
--                                    or tier does not belong to the blueprint
--   P0001 (raise_exception)        – blueprint is trashed
--   42501 (insufficient_privilege) – caller is not super admin or world admin
-- ---------------------------------------------------------------------------
-- 1. Add nullable name column to settlement_buildings.
-- ---------------------------------------------------------------------------
alter table public.settlement_buildings
add column name text;

-- ---------------------------------------------------------------------------
-- 2. Create the RPC.
-- ---------------------------------------------------------------------------
create or replace function public.add_settlement_building_as_admin (
  p_settlement_id uuid,
  p_blueprint_id uuid,
  p_tier_id uuid,
  p_name text default null
) returns table (id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id           uuid;
  v_blueprint_world_id uuid;
  v_is_trashed         boolean;
  v_tier_belongs       boolean;
  v_turn_number        integer;
  v_new_id             uuid;
begin
  -- Null guard
  if p_settlement_id is null or p_blueprint_id is null or p_tier_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve settlement → nation → world
  select n.world_id
  into   v_world_id
  from   public.settlements s
  join   public.nations n on n.id = s.nation_id
  where  s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Authorization: super admin or world admin only
  if not (public.is_super_admin () or public.is_world_admin (v_world_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Validate blueprint: exists, same world, not trashed
  select bb.world_id, bb.is_trashed
  into   v_blueprint_world_id, v_is_trashed
  from   public.building_blueprints bb
  where  bb.id = p_blueprint_id;

  if v_blueprint_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_blueprint_world_id <> v_world_id then
    raise exception 'blueprint does not belong to this world' using errcode = 'P0002';
  end if;

  if v_is_trashed then
    raise exception 'blueprint is trashed' using errcode = 'P0001';
  end if;

  -- Validate tier belongs to blueprint
  select exists (
    select 1
    from   public.building_blueprint_tiers t
    where  t.id = p_tier_id
      and  t.building_blueprint_id = p_blueprint_id
  ) into v_tier_belongs;

  if not v_tier_belongs then
    raise exception 'tier does not belong to blueprint' using errcode = 'P0002';
  end if;

  -- Look up the world's current turn number
  select w.current_turn_number
  into   v_turn_number
  from   public.worlds w
  where  w.id = v_world_id;

  -- Insert the building directly as active, no construction project row
  insert into public.settlement_buildings (
    settlement_id,
    building_blueprint_id,
    current_tier_id,
    name,
    state,
    missed_upkeep_count,
    activated_on_turn_number
  ) values (
    p_settlement_id,
    p_blueprint_id,
    p_tier_id,
    p_name,
    'active',
    0,
    coalesce (v_turn_number, 0)
  )
  returning settlement_buildings.id into v_new_id;

  return query select v_new_id;
end;
$$;

revoke all on function public.add_settlement_building_as_admin (uuid, uuid, uuid, text)
from
  public;

grant
execute on function public.add_settlement_building_as_admin (uuid, uuid, uuid, text) to authenticated;
