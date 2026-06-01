-- Migration: set_per_target_assignment_rpc
-- Adds the per-target citizen assignment surface (Epic 5):
--
--   set_per_target_assignment(p_settlement_id, p_assignment_type, p_target_id,
--                             p_citizen_ids, p_trade_route_end)
--     SECURITY DEFINER RPC that atomically sets the full list of citizens
--     assigned to a specific target (deposit instance, managed population
--     instance, or trade route end). p_citizen_ids is the desired final state;
--     the RPC deletes prior assignments for both the target and the supplied
--     citizens, then inserts new rows. Re-supplying the same set is a no-op
--     in terms of data but still deletes and reinserts rows.
--
-- Authorised callers: super admin, world admin, OR
--   current_user_manages_settlement(p_settlement_id).
--
-- Error contract:
--   P0002 (no_data_found)          – null required param, settlement not found,
--                                    target not found
--   42501 (insufficient_privilege) – caller lacks authority
--   P0001 (raise_exception)        – invalid assignment type, target not in
--                                    settlement, inactive instance, max workers
--                                    exceeded (deposit), trashed linked job
--                                    (husbandry/culling), missing or mismatched
--                                    trade_route_end, inactive trade route,
--                                    citizen not alive or not in settlement
--
-- Returns: assigned_count (cardinality of p_citizen_ids after validation),
--          replaced_count (total rows deleted before the new insert —
--          counts both old assignees removed from this target and citizens
--          moved here from a different assignment).
-- ---------------------------------------------------------------------------
create or replace function public.set_per_target_assignment (
  p_settlement_id uuid,
  p_assignment_type text,
  p_target_id uuid,
  p_citizen_ids uuid[],
  p_trade_route_end text default null
) returns table (assigned_count integer, replaced_count integer) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id         uuid;
  v_turn_number      integer;
  v_replaced_count   integer := 0;
  v_target_settlement uuid;
  v_target_status    text;
  v_max_workers      integer;
  v_job_is_trashed   boolean;
begin
  -- Null guard (p_citizen_ids may be empty but must not be null)
  if p_settlement_id is null
     or p_assignment_type is null
     or p_target_id is null
     or p_citizen_ids is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Type validation
  if p_assignment_type not in ('deposit', 'husbandry', 'culling', 'trade_route') then
    raise exception 'assignment type must be deposit, husbandry, culling, or trade_route'
      using errcode = 'P0001';
  end if;

  -- Resolve settlement → world
  select n.world_id
    into v_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Authorization
  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (p_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- -----------------------------------------------------------------------
  -- Target validation: deposit
  -- -----------------------------------------------------------------------
  if p_assignment_type = 'deposit' then

    select di.settlement_id, di.status, di.max_workers
      into v_target_settlement, v_target_status, v_max_workers
      from public.deposit_instances di
     where di.id = p_target_id;

    if v_target_settlement is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_target_settlement <> p_settlement_id then
      raise exception 'deposit instance does not belong to settlement'
        using errcode = 'P0001';
    end if;

    if v_target_status <> 'active' then
      raise exception 'deposit instance status is not active (%)', v_target_status
        using errcode = 'P0001';
    end if;

    if v_max_workers is not null
       and cardinality(p_citizen_ids) > v_max_workers
    then
      raise exception 'citizen count (%) exceeds max workers (%) for this deposit instance',
        cardinality(p_citizen_ids), v_max_workers
        using errcode = 'P0001';
    end if;

  -- -----------------------------------------------------------------------
  -- Target validation: husbandry / culling
  -- -----------------------------------------------------------------------
  elsif p_assignment_type in ('husbandry', 'culling') then

    select mpi.settlement_id, mpi.status
      into v_target_settlement, v_target_status
      from public.managed_population_instances mpi
     where mpi.id = p_target_id;

    if v_target_settlement is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_target_settlement <> p_settlement_id then
      raise exception 'managed population instance does not belong to settlement'
        using errcode = 'P0001';
    end if;

    if v_target_status <> 'active' then
      raise exception 'managed population instance status is not active (%)', v_target_status
        using errcode = 'P0001';
    end if;

    -- Check that the linked job (husbandry or culling) is not trashed.
    if p_assignment_type = 'husbandry' then
      select j.is_trashed
        into v_job_is_trashed
        from public.managed_population_instances mpi
        join public.managed_population_types mpt on mpt.id = mpi.managed_population_type_id
        join public.job_definitions j on j.id = mpt.husbandry_job_id
       where mpi.id = p_target_id;
    else
      select j.is_trashed
        into v_job_is_trashed
        from public.managed_population_instances mpi
        join public.managed_population_types mpt on mpt.id = mpi.managed_population_type_id
        join public.job_definitions j on j.id = mpt.culling_job_id
       where mpi.id = p_target_id;
    end if;

    if v_job_is_trashed then
      raise exception 'linked % job is trashed', p_assignment_type
        using errcode = 'P0001';
    end if;

  -- -----------------------------------------------------------------------
  -- Target validation: trade_route
  -- -----------------------------------------------------------------------
  elsif p_assignment_type = 'trade_route' then

    if p_trade_route_end is null or p_trade_route_end not in ('origin', 'destination') then
      raise exception 'trade_route_end must be origin or destination'
        using errcode = 'P0001';
    end if;

    -- Confirm the route exists and its relevant endpoint matches the settlement.
    select tr.status
      into v_target_status
      from public.trade_routes tr
     where tr.id = p_target_id
       and (
         (p_trade_route_end = 'origin'      and tr.origin_settlement_id      = p_settlement_id)
         or
         (p_trade_route_end = 'destination' and tr.destination_settlement_id = p_settlement_id)
       );

    if v_target_status is null then
      -- Distinguish "route not found" (P0002) from "wrong end" (P0001).
      if exists (select 1 from public.trade_routes where id = p_target_id) then
        raise exception 'trade route end does not match settlement'
          using errcode = 'P0001';
      end if;
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_target_status <> 'active' then
      raise exception 'trade route status is not active (%)', v_target_status
        using errcode = 'P0001';
    end if;

  end if;

  -- -----------------------------------------------------------------------
  -- Validate all supplied citizens: must belong to settlement and be alive.
  -- -----------------------------------------------------------------------
  if exists (
    select 1
      from unnest(p_citizen_ids) as cid
     where not exists (
       select 1
         from public.citizens c
        where c.id = cid
          and c.settlement_id = p_settlement_id
          and c.status = 'alive'
     )
  ) then
    raise exception 'one or more citizens are not alive members of this settlement'
      using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------------
  -- Current turn number (needed for assigned_on_turn_number on new rows).
  -- -----------------------------------------------------------------------
  select w.current_turn_number
    into v_turn_number
    from public.worlds w
   where w.id = v_world_id;

  -- -----------------------------------------------------------------------
  -- Count rows that will be deleted (replaced_count).
  -- This covers two disjoint sets:
  --   A. Citizens currently assigned to this target who are NOT in p_citizen_ids
  --      (they are being removed from the target).
  --   B. Citizens in p_citizen_ids who currently have any assignment
  --      (they are being moved to this target, possibly from elsewhere).
  -- -----------------------------------------------------------------------
  if p_assignment_type = 'deposit' then
    select count(*)::integer
      into v_replaced_count
      from public.citizen_assignments ca
     where (
       ca.deposit_instance_id = p_target_id
       and ca.citizen_id <> all (p_citizen_ids)
     )
     or ca.citizen_id = any (p_citizen_ids);

  elsif p_assignment_type in ('husbandry', 'culling') then
    select count(*)::integer
      into v_replaced_count
      from public.citizen_assignments ca
     where (
       ca.managed_population_instance_id = p_target_id
       and ca.assignment_type = p_assignment_type
       and ca.citizen_id <> all (p_citizen_ids)
     )
     or ca.citizen_id = any (p_citizen_ids);

  elsif p_assignment_type = 'trade_route' then
    select count(*)::integer
      into v_replaced_count
      from public.citizen_assignments ca
     where (
       ca.trade_route_id = p_target_id
       and ca.trade_route_end = p_trade_route_end
       and ca.citizen_id <> all (p_citizen_ids)
     )
     or ca.citizen_id = any (p_citizen_ids);
  end if;

  -- -----------------------------------------------------------------------
  -- Atomic reassignment: clear the given citizens and the given target,
  -- then insert the new assignment list.
  -- Step 1: Remove assignments for all citizens in p_citizen_ids.
  -- -----------------------------------------------------------------------
  delete from public.citizen_assignments
   where citizen_id = any (p_citizen_ids);

  -- Step 2: Remove remaining assignments for this specific target
  --         (citizens not in p_citizen_ids who are being displaced).
  if p_assignment_type = 'deposit' then
    delete from public.citizen_assignments
     where deposit_instance_id = p_target_id;

  elsif p_assignment_type in ('husbandry', 'culling') then
    delete from public.citizen_assignments
     where managed_population_instance_id = p_target_id
       and assignment_type = p_assignment_type;

  elsif p_assignment_type = 'trade_route' then
    delete from public.citizen_assignments
     where trade_route_id = p_target_id
       and trade_route_end = p_trade_route_end;
  end if;

  -- Step 3: Insert new assignments (skip if list is empty).
  if cardinality(p_citizen_ids) > 0 then
    if p_assignment_type = 'deposit' then
      insert into public.citizen_assignments (
        citizen_id, assignment_type, deposit_instance_id, assigned_on_turn_number
      )
      select cid, 'deposit', p_target_id, v_turn_number
        from unnest(p_citizen_ids) as cid;

    elsif p_assignment_type = 'husbandry' then
      insert into public.citizen_assignments (
        citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number
      )
      select cid, 'husbandry', p_target_id, v_turn_number
        from unnest(p_citizen_ids) as cid;

    elsif p_assignment_type = 'culling' then
      insert into public.citizen_assignments (
        citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number
      )
      select cid, 'culling', p_target_id, v_turn_number
        from unnest(p_citizen_ids) as cid;

    elsif p_assignment_type = 'trade_route' then
      insert into public.citizen_assignments (
        citizen_id, assignment_type, trade_route_id, trade_route_end, assigned_on_turn_number
      )
      select cid, 'trade_route', p_target_id, p_trade_route_end, v_turn_number
        from unnest(p_citizen_ids) as cid;
    end if;
  end if;

  assigned_count := cardinality(p_citizen_ids);
  replaced_count := coalesce(v_replaced_count, 0);
  return next;
end;
$$;

revoke all on function public.set_per_target_assignment (uuid, text, uuid, uuid[], text)
from
  public;

grant
execute on function public.set_per_target_assignment (uuid, text, uuid, uuid[], text) to authenticated;
