-- Migration: create_managed_population_instance_rpc
-- Adds the max-name-length CHECK constraint deferred from the initial table
-- migration, then adds a SECURITY DEFINER RPC for world admins / super admins
-- to create managed population instances on a settlement.
--
-- Error contract:
--   P0002 (no_data_found)          – null params, settlement / type not found,
--                                    or type belongs to a different world
--   42501 (insufficient_privilege) – caller is not world admin or super admin
--   P0001 (raise_exception)        – type is trashed, name length out of bounds,
--                                    initial count <= 0, or cull quantity invalid
-- ---------------------------------------------------------------------------
alter table public.managed_population_instances
add constraint managed_population_instances_name_max_length_check check (char_length(name) <= 64);

-- ---------------------------------------------------------------------------
create or replace function public.create_managed_population_instance (
  p_settlement_id uuid,
  p_type_id uuid,
  p_name text,
  p_initial_count numeric,
  p_initial_cull_quantity numeric
) returns setof public.managed_population_instances language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id   uuid;
  v_type_id    uuid;
  v_is_trashed boolean;
  v_row        public.managed_population_instances%rowtype;
begin
  -- Null guard
  if p_settlement_id is null or p_type_id is null or p_name is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Normalise optional cull quantity
  p_initial_cull_quantity := coalesce(p_initial_cull_quantity, 0);

  -- Resolve settlement → world via nation chain
  select n.world_id into v_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: world admin or super admin only (managers excluded)
  if not (public.is_world_admin (v_world_id) or public.is_super_admin ()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Validate name length (DB has min=1 via btrim check; RPC enforces max=64)
  if char_length(btrim(p_name)) < 1 or char_length(p_name) > 64 then
    raise exception 'managed population instance name length is out of bounds (1–64)' using errcode = 'P0001';
  end if;

  -- Validate initial count: must be > 0
  if p_initial_count is null or p_initial_count <= 0 then
    raise exception 'initial count must be greater than 0' using errcode = 'P0001';
  end if;

  -- Validate cull quantity: must be >= 0 and <= initial count
  if p_initial_cull_quantity < 0 or p_initial_cull_quantity > p_initial_count then
    raise exception 'initial cull quantity must be between 0 and initial count' using errcode = 'P0001';
  end if;

  -- Validate managed population type: must exist in this world
  select mpt.id, mpt.is_trashed into v_type_id, v_is_trashed
  from public.managed_population_types mpt
  where mpt.id = p_type_id
    and mpt.world_id = v_world_id;

  if v_type_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_is_trashed then
    raise exception 'managed population type is trashed' using errcode = 'P0001';
  end if;

  -- Insert managed population instance
  insert into public.managed_population_instances (
    settlement_id,
    managed_population_type_id,
    name,
    current_count,
    configured_cull_quantity,
    status
  )
  values (
    p_settlement_id,
    p_type_id,
    p_name,
    p_initial_count,
    p_initial_cull_quantity,
    'active'
  )
  returning * into v_row;

  return next v_row;
end;
$$;

revoke all on function public.create_managed_population_instance (uuid, uuid, text, numeric, numeric)
from
  public;

grant
execute on function public.create_managed_population_instance (uuid, uuid, text, numeric, numeric) to authenticated;
