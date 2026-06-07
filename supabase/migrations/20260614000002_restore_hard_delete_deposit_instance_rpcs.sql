-- Migration: restore_deposit_instance + hard_delete_deposit_instance
--
-- restore_deposit_instance: sets status from 'removed' back to 'active'
-- (or 'depleted' when all deposit_instance_resources quantities are exhausted).
--
-- hard_delete_deposit_instance: permanently deletes a removed deposit instance.
-- Cascades via FK to deposit_instance_resources and citizen_assignments.
--
-- Authorised callers: world_admin, super_admin.
--
-- Error contract (both RPCs):
--   P0002 (no_data_found)          – p_deposit_instance_id is null or not found
--   42501 (insufficient_privilege) – caller is not world admin or super admin
--   P0001 (raise_exception)        – status precondition not met
-- ---------------------------------------------------------------------------
-- ===========================================================================
-- restore_deposit_instance
-- ===========================================================================
create or replace function public.restore_deposit_instance (p_deposit_instance_id uuid) returns table (id uuid, settlement_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_world_id      uuid;
  v_status        text;
  v_target_status text;
begin
  -- Null guard
  if p_deposit_instance_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve deposit instance → settlement → world, lock row
  select di.settlement_id, n.world_id, di.status
    into v_settlement_id, v_world_id, v_status
    from public.deposit_instances di
    join public.settlements s on s.id = di.settlement_id
    join public.nations n on n.id = s.nation_id
   where di.id = p_deposit_instance_id
   for update;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: world admin or super admin only
  if not (public.is_world_admin (v_world_id) or public.is_super_admin ()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Reject if not removed
  if v_status != 'removed' then
    raise exception 'deposit instance is not removed' using errcode = 'P0001';
  end if;

  -- Determine restored status:
  --   'active'   if any resource has remaining_quantity > 0, or if no resources exist
  --   'depleted' if all resources exist but are exhausted
  select
    case
      when exists (
        select 1
          from public.deposit_instance_resources dir
         where dir.deposit_instance_id = p_deposit_instance_id
           and dir.remaining_quantity > 0
      ) then 'active'
      when exists (
        select 1
          from public.deposit_instance_resources dir
         where dir.deposit_instance_id = p_deposit_instance_id
      ) then 'depleted'
      else 'active'
    end
    into v_target_status;

  -- Restore
  update public.deposit_instances di
     set status     = v_target_status,
         updated_at = now ()
   where di.id = p_deposit_instance_id;

  id            := p_deposit_instance_id;
  settlement_id := v_settlement_id;
  return next;
end;
$$;

revoke all on function public.restore_deposit_instance (uuid)
from
  public;

grant
execute on function public.restore_deposit_instance (uuid) to authenticated;

-- ===========================================================================
-- hard_delete_deposit_instance
-- ===========================================================================
-- Permanently deletes a removed deposit instance.
-- CASCADE FKs on deposit_instance_resources and citizen_assignments handle
-- child-row cleanup automatically.
-- ===========================================================================
create or replace function public.hard_delete_deposit_instance (p_deposit_instance_id uuid) returns table (id uuid, settlement_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_world_id      uuid;
  v_status        text;
begin
  -- Null guard
  if p_deposit_instance_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve deposit instance → settlement → world, lock row
  select di.settlement_id, n.world_id, di.status
    into v_settlement_id, v_world_id, v_status
    from public.deposit_instances di
    join public.settlements s on s.id = di.settlement_id
    join public.nations n on n.id = s.nation_id
   where di.id = p_deposit_instance_id
   for update;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: world admin or super admin only
  if not (public.is_world_admin (v_world_id) or public.is_super_admin ()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Only removed deposit instances can be permanently deleted
  if v_status != 'removed' then
    raise exception 'deposit instance must be removed before it can be permanently deleted'
      using errcode = 'P0001';
  end if;

  -- Delete; cascades to deposit_instance_resources and citizen_assignments
  return query
  delete from public.deposit_instances di
   where di.id = p_deposit_instance_id
  returning di.id as id, di.settlement_id as settlement_id;
end;
$$;

revoke all on function public.hard_delete_deposit_instance (uuid)
from
  public;

grant
execute on function public.hard_delete_deposit_instance (uuid) to authenticated;
