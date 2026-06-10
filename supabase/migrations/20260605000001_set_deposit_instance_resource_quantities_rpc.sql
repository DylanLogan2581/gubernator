-- Migration: set_deposit_instance_resource_quantities_rpc
-- SECURITY DEFINER RPC that updates initial_quantity and remaining_quantity on
-- a single deposit_instance_resources row. Both values are independently
-- settable subject to the invariant: 0 ≤ remaining_quantity ≤ initial_quantity.
--
-- Authorised callers: world_admin, super_admin only.
--
-- Error contract:
--   P0002 (no_data_found)          – p_deposit_instance_resource_id is null or not found
--   42501 (insufficient_privilege) – caller is not world admin or super admin
--   P0001 (raise_exception)        – null quantities, initial_quantity not positive,
--                                    or quantities violate 0 ≤ remaining ≤ initial
-- ---------------------------------------------------------------------------
create or replace function public.set_deposit_instance_resource_quantities (
  p_deposit_instance_resource_id uuid,
  p_initial_quantity numeric,
  p_remaining_quantity numeric
) returns table (
  deposit_instance_resource_id uuid,
  deposit_instance_id uuid,
  settlement_id uuid,
  initial_quantity numeric,
  remaining_quantity numeric
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_deposit_instance_id uuid;
  v_settlement_id       uuid;
  v_world_id            uuid;
begin
  -- Null guard
  if p_deposit_instance_resource_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Null guard for numeric params
  if p_initial_quantity is null then
    raise exception 'initial_quantity must not be null' using errcode = 'P0001';
  end if;

  if p_remaining_quantity is null then
    raise exception 'remaining_quantity must not be null' using errcode = 'P0001';
  end if;

  -- Range validation: initial_quantity must be > 0, remaining must be >= 0 and <= initial
  if p_initial_quantity <= 0 then
    raise exception 'initial_quantity must be > 0' using errcode = 'P0001';
  end if;

  if p_remaining_quantity < 0 then
    raise exception 'remaining_quantity must be >= 0' using errcode = 'P0001';
  end if;

  if p_remaining_quantity > p_initial_quantity then
    raise exception 'remaining_quantity must be <= initial_quantity' using errcode = 'P0001';
  end if;

  -- Resolve resource row → deposit instance → settlement → world
  select dir.deposit_instance_id, s.id, n.world_id
    into v_deposit_instance_id, v_settlement_id, v_world_id
    from public.deposit_instance_resources dir
    join public.deposit_instances di on di.id = dir.deposit_instance_id
    join public.settlements s on s.id = di.settlement_id
    join public.nations n on n.id = s.nation_id
   where dir.id = p_deposit_instance_resource_id;

  if v_deposit_instance_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: world admin or super admin only
  if not (public.is_world_admin (v_world_id) or public.is_super_admin ()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Apply the update
  update public.deposit_instance_resources dir
     set initial_quantity   = p_initial_quantity,
         remaining_quantity = p_remaining_quantity
   where dir.id = p_deposit_instance_resource_id;

  deposit_instance_resource_id := p_deposit_instance_resource_id;
  deposit_instance_id          := v_deposit_instance_id;
  settlement_id                := v_settlement_id;
  initial_quantity             := p_initial_quantity;
  remaining_quantity           := p_remaining_quantity;
  return next;
end;
$$;

revoke all on function public.set_deposit_instance_resource_quantities (uuid, numeric, numeric)
from
  public;

grant
execute on function public.set_deposit_instance_resource_quantities (uuid, numeric, numeric) to authenticated;
