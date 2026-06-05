-- Migration: fix_remove_managed_population_instance_zero_count
-- Fixes remove_managed_population_instance to also zero current_count when
-- marking an instance extinct. An extinct herd has no animals by definition.
create or replace function public.remove_managed_population_instance (p_instance_id uuid) returns table (id uuid, settlement_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_world_id      uuid;
  v_status        text;
  v_active_count  integer;
begin
  -- Null guard
  if p_instance_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve instance → settlement → world
  select mpi.settlement_id, n.world_id, mpi.status
    into v_settlement_id, v_world_id, v_status
    from public.managed_population_instances mpi
    join public.settlements s on s.id = mpi.settlement_id
    join public.nations n on n.id = s.nation_id
   where mpi.id = p_instance_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: world admin or super admin only
  if not (public.is_world_admin (v_world_id) or public.is_super_admin ()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Reject if already extinct
  if v_status = 'extinct' then
    raise exception 'managed population instance is already extinct' using errcode = 'P0001';
  end if;

  -- Reject if active citizen_assignments still reference this instance
  select count(*)
    into v_active_count
    from public.citizen_assignments ca
   where ca.managed_population_instance_id = p_instance_id
     and ca.assignment_type in ('husbandry', 'culling');

  if v_active_count > 0 then
    raise exception 'managed population instance has active assignments; unassign workers first'
      using errcode = 'P0001';
  end if;

  -- Retire the instance and zero the count
  update public.managed_population_instances mpi
     set status = 'extinct',
         current_count = 0
   where mpi.id = p_instance_id;

  id            := p_instance_id;
  settlement_id := v_settlement_id;
  return next;
end;
$$;

revoke all on function public.remove_managed_population_instance (uuid)
from
  public;

grant
execute on function public.remove_managed_population_instance (uuid) to authenticated;
