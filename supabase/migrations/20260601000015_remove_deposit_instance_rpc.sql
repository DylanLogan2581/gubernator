-- Migration: remove_deposit_instance_rpc
-- SECURITY DEFINER RPC that soft-tombstones a deposit instance by setting its
-- status to 'removed'. The record and its historical assignments are retained
-- for audit trail purposes.
--
-- Authorised callers: world_admin, super_admin.
--
-- Error contract:
--   P0002 (no_data_found)          – p_deposit_instance_id is null or not found
--   42501 (insufficient_privilege) – caller is not world admin or super admin
--   P0001 (raise_exception)        – deposit instance is already removed, or
--                                    active citizen_assignments still reference
--                                    the deposit (admin must unassign first)
-- ---------------------------------------------------------------------------
create or replace function public.remove_deposit_instance (p_deposit_instance_id uuid) returns table (id uuid, settlement_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_world_id      uuid;
  v_status        text;
  v_active_count  integer;
begin
  -- Null guard
  if p_deposit_instance_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve deposit instance → settlement → world
  select di.settlement_id, n.world_id, di.status
    into v_settlement_id, v_world_id, v_status
    from public.deposit_instances di
    join public.settlements s on s.id = di.settlement_id
    join public.nations n on n.id = s.nation_id
   where di.id = p_deposit_instance_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: world admin or super admin only
  if not (public.is_world_admin (v_world_id) or public.is_super_admin ()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Reject if already removed (idempotent re-call is an error)
  if v_status = 'removed' then
    raise exception 'deposit instance is already removed' using errcode = 'P0001';
  end if;

  -- Reject if active citizen_assignments still reference this deposit
  select count(*)
    into v_active_count
    from public.citizen_assignments ca
   where ca.deposit_instance_id = p_deposit_instance_id
     and ca.assignment_type = 'deposit';

  if v_active_count > 0 then
    raise exception 'deposit instance has active assignments; unassign workers first'
      using errcode = 'P0001';
  end if;

  -- Soft-tombstone
  update public.deposit_instances di
     set status = 'removed'
   where di.id = p_deposit_instance_id;

  id            := p_deposit_instance_id;
  settlement_id := v_settlement_id;
  return next;
end;
$$;

revoke all on function public.remove_deposit_instance (uuid)
from
  public;

grant
execute on function public.remove_deposit_instance (uuid) to authenticated;
