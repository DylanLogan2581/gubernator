-- Migration: create_deposit_instance_rpc
-- Adds the max-name-length CHECK constraint that was deferred from the initial table
-- migration, then adds a SECURITY DEFINER RPC for world admins to create deposit
-- instances on a settlement.
--
-- Error contract:
--   P0002 (no_data_found)          – null params, settlement / deposit type not found,
--                                    or deposit type belongs to a different world
--   42501 (insufficient_privilege) – caller is not world admin or super admin
--   P0001 (raise_exception)        – deposit type is trashed, name length out of bounds,
--                                    max_workers not positive, initial_quantity not positive,
--                                    resource is soft-deleted, or resource belongs to a
--                                    different world
-- ---------------------------------------------------------------------------
alter table public.deposit_instances
add constraint deposit_instances_name_max_length_check check (char_length(name) <= 64);

-- ---------------------------------------------------------------------------
create or replace function public.create_deposit_instance (
  p_settlement_id uuid,
  p_deposit_type_id uuid,
  p_name text,
  p_max_workers integer,
  p_resources jsonb
) returns setof public.deposit_instances language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id        uuid;
  v_deposit_type_id uuid;
  v_is_trashed      boolean;
  v_resource_entry  jsonb;
  v_resource_id     uuid;
  v_resource_world  uuid;
  v_is_res_trashed  boolean;
  v_initial_qty     numeric;
  v_row             public.deposit_instances%rowtype;
begin
  -- Null guard
  if p_settlement_id is null or p_deposit_type_id is null or p_name is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

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
    raise exception 'deposit instance name length is out of bounds (1–64)' using errcode = 'P0001';
  end if;

  -- Validate max_workers: if not null, must be > 0
  if p_max_workers is not null and p_max_workers <= 0 then
    raise exception 'max_workers must be > 0' using errcode = 'P0001';
  end if;

  -- Validate deposit type: must exist in this world
  select dt.id, dt.is_trashed into v_deposit_type_id, v_is_trashed
  from public.deposit_types dt
  where dt.id = p_deposit_type_id
    and dt.world_id = v_world_id;

  if v_deposit_type_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_is_trashed then
    raise exception 'deposit type is trashed' using errcode = 'P0001';
  end if;

  -- Validate resources: soft-deleted, cross-world, and initial_quantity checks
  if p_resources is not null and jsonb_array_length(p_resources) > 0 then
    for v_resource_entry in
      select value from jsonb_array_elements(p_resources)
    loop
      v_resource_id := (v_resource_entry ->> 'resource_id')::uuid;
      v_initial_qty := (v_resource_entry ->> 'initial_quantity')::numeric;

      -- Null guard for initial_quantity
      if v_initial_qty is null then
        raise exception 'initial_quantity must not be null' using errcode = 'P0001';
      end if;

      -- Validate initial_quantity > 0
      if v_initial_qty <= 0 then
        raise exception 'initial_quantity must be > 0' using errcode = 'P0001';
      end if;

      select r.world_id, r.is_trashed into v_resource_world, v_is_res_trashed
      from public.resources r
      where r.id = v_resource_id;

      if v_resource_world is null then
        raise exception 'resource not found' using errcode = 'P0002';
      end if;

      if v_is_res_trashed then
        raise exception 'resource % is soft-deleted', v_resource_id
          using errcode = 'P0001';
      end if;

      if v_resource_world != v_world_id then
        raise exception 'resource % belongs to a different world', v_resource_id
          using errcode = 'P0001';
      end if;
    end loop;
  end if;

  -- Insert deposit instance
  insert into public.deposit_instances (
    settlement_id,
    deposit_type_id,
    name,
    status,
    max_workers
  )
  values (
    p_settlement_id,
    p_deposit_type_id,
    p_name,
    'active',
    p_max_workers
  )
  returning * into v_row;

  -- Insert resource rows (remaining_quantity starts equal to initial_quantity)
  if p_resources is not null and jsonb_array_length(p_resources) > 0 then
    insert into public.deposit_instance_resources (
      deposit_instance_id,
      resource_id,
      initial_quantity,
      remaining_quantity
    )
    select
      v_row.id,
      (elem ->> 'resource_id')::uuid,
      (elem ->> 'initial_quantity')::numeric,
      (elem ->> 'initial_quantity')::numeric
    from jsonb_array_elements(p_resources) as elem;
  end if;

  return next v_row;
end;
$$;

revoke all on function public.create_deposit_instance (uuid, uuid, text, integer, jsonb)
from
  public;

grant
execute on function public.create_deposit_instance (uuid, uuid, text, integer, jsonb) to authenticated;
