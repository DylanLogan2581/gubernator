-- Migration: set_configured_cull_quantity_rpc
-- SECURITY DEFINER RPC that updates configured_cull_quantity on a managed
-- population instance.
--
-- Authorised callers: settlement_manager, nation_manager, world_admin,
-- super_admin (resolved via current_user_manages_settlement).
--
-- Error contract:
--   P0002 (no_data_found)          – p_instance_id is null or not found
--   42501 (insufficient_privilege) – caller lacks manage-settlement permission
--   P0001 (raise_exception)        – p_quantity < 0 or p_quantity > current_count
-- ---------------------------------------------------------------------------
create or replace function public.set_configured_cull_quantity (p_instance_id uuid, p_quantity numeric) returns table (id uuid, settlement_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id  uuid;
  v_current_count  numeric;
begin
  -- Null guard
  if p_instance_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Validate quantity >= 0
  if p_quantity is null or p_quantity < 0 then
    raise exception 'configured cull quantity must be non-negative' using errcode = 'P0001';
  end if;

  -- Resolve instance → settlement and current_count
  select mpi.settlement_id, mpi.current_count
    into v_settlement_id, v_current_count
    from public.managed_population_instances mpi
   where mpi.id = p_instance_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: settlement manager, nation manager, world admin, or super admin
  if not public.current_user_manages_settlement (v_settlement_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Validate quantity <= current_count
  if p_quantity > v_current_count then
    raise exception 'configured cull quantity must not exceed current count' using errcode = 'P0001';
  end if;

  -- Update configured_cull_quantity
  update public.managed_population_instances mpi
     set configured_cull_quantity = p_quantity
   where mpi.id = p_instance_id;

  id            := p_instance_id;
  settlement_id := v_settlement_id;
  return next;
end;
$$;

revoke all on function public.set_configured_cull_quantity (uuid, numeric)
from
  public;

grant
execute on function public.set_configured_cull_quantity (uuid, numeric) to authenticated;
