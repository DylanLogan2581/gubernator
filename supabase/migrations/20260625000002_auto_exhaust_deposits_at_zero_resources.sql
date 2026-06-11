-- Migration: auto_exhaust_deposits_at_zero_resources
-- Updates the remove_deposit_instance RPC to unassign all NPCs instead of
-- requiring them to be empty first. Adds a trigger to auto-exhaust deposits
-- when all resources reach zero (remaining_quantity = 0 for all resources).
-- ---------------------------------------------------------------------------
-- 1. Replace remove_deposit_instance RPC to unassign NPCs instead of reject
drop function if exists public.remove_deposit_instance (uuid);

create function public.remove_deposit_instance (p_deposit_instance_id uuid) returns table (id uuid, settlement_id uuid) language plpgsql security definer
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

  -- Unassign ALL citizens assigned to this deposit (instead of rejecting)
  delete from public.citizen_assignments ca
   where ca.deposit_instance_id = p_deposit_instance_id
     and ca.assignment_type = 'deposit';

  -- Soft-tombstone
  update public.deposit_instances di
     set status = 'removed'
   where di.id = p_deposit_instance_id;

  id            := p_deposit_instance_id;
  settlement_id := v_settlement_id;
  return next;
end;
$$;

-- 2. Create trigger function: auto-exhaust when all resources reach zero
create or replace function public.auto_exhaust_deposit_at_zero_resources () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_deposit_instance_id uuid;
  v_has_non_zero        boolean;
begin
  v_deposit_instance_id := new.deposit_instance_id;

  -- Check if any resource of this deposit still has remaining_quantity > 0
  select exists (
    select 1
    from public.deposit_instance_resources
    where deposit_instance_id = v_deposit_instance_id
      and remaining_quantity > 0
  ) into v_has_non_zero;

  -- If no resources have remaining > 0, auto-exhaust
  if not v_has_non_zero then
    -- Unassign all citizens from this deposit
    delete from public.citizen_assignments ca
     where ca.deposit_instance_id = v_deposit_instance_id
       and ca.assignment_type = 'deposit';

    -- Set status to 'removed' (exhausted)
    update public.deposit_instances di
       set status = 'removed'
     where di.id = v_deposit_instance_id
       and di.status != 'removed';
  end if;

  return new;
end;
$$;

-- Create trigger on deposit_instance_resources UPDATE
-- Fires after a resource quantity is updated
drop trigger if exists deposit_instance_resources_auto_exhaust_on_update on public.deposit_instance_resources;

create trigger deposit_instance_resources_auto_exhaust_on_update
after
update of remaining_quantity on public.deposit_instance_resources for each row
execute function public.auto_exhaust_deposit_at_zero_resources ();
