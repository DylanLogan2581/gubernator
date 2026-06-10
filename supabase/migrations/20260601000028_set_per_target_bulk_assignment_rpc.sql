-- Migration: set_per_target_bulk_assignment_rpc
-- Adds a count-based per-target assignment surface (Epic 5 / Issue #556):
--
--   set_per_target_bulk_assignment(p_settlement_id, p_assignment_type,
--                                  p_target_id, p_target_count,
--                                  p_trade_route_end)
--     SECURITY DEFINER RPC that sets the number of citizens assigned to a
--     specific target (deposit instance, managed population instance, or trade
--     route end) to exactly p_target_count, using the same deterministic-random
--     NPC selection as set_bulk_standard_job_assignment.  The caller provides
--     a desired count; the RPC picks or removes NPCs automatically.
--
-- Authorised callers: super admin, world admin, OR
--   current_user_manages_settlement(p_settlement_id).
--
-- Error contract:
--   P0002 (no_data_found)          – null required param, settlement not found,
--                                    target not found
--   42501 (insufficient_privilege) – caller lacks authority
--   P0001 (raise_exception)        – world is archived, negative target count, invalid assignment
--                                    type, target not in settlement, inactive
--                                    instance, target count exceeds max_workers
--                                    (deposit), trashed linked job
--                                    (husbandry/culling), missing or mismatched
--                                    trade_route_end, inactive trade route,
--                                    insufficient unassigned NPCs when raising
--
-- Returns: before (count before mutation), after (= p_target_count),
--          added_citizen_ids, removed_citizen_ids.
-- ---------------------------------------------------------------------------
create or replace function public.set_per_target_bulk_assignment (
  p_settlement_id uuid,
  p_assignment_type text,
  p_target_id uuid,
  p_target_count integer,
  p_trade_route_end text default null
) returns table (
  before integer,
  after integer,
  added_citizen_ids uuid[],
  removed_citizen_ids uuid[]
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id          uuid;
  v_turn_number       integer;
  v_target_settlement uuid;
  v_target_status     text;
  v_max_workers       integer;
  v_job_is_trashed    boolean;
  v_current_count     integer;
  v_delta             integer;
  v_added_ids         uuid[] := array[]::uuid[];
  v_removed_ids       uuid[] := array[]::uuid[];
begin
  -- -----------------------------------------------------------------------
  -- Null guard
  -- -----------------------------------------------------------------------
  if p_settlement_id is null
     or p_assignment_type is null
     or p_target_id is null
     or p_target_count is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Non-negative count
  if p_target_count < 0 then
    raise exception 'target count must not be negative'
      using errcode = 'P0001';
  end if;

  -- Type validation
  if p_assignment_type not in ('deposit', 'husbandry', 'culling', 'trade_route') then
    raise exception 'assignment type must be deposit, husbandry, culling, or trade_route'
      using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------------
  -- Resolve settlement → world
  -- -----------------------------------------------------------------------
  select n.world_id
    into v_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Archived world guard
  if public.world_is_archived(v_world_id) then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------------
  -- Authorization
  -- -----------------------------------------------------------------------
  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (p_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- -----------------------------------------------------------------------
  -- Target validation and current-count fetch: deposit
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

    if v_max_workers is not null and p_target_count > v_max_workers then
      raise exception 'target count (%) exceeds max workers (%) for this deposit instance',
        p_target_count, v_max_workers
        using errcode = 'P0001';
    end if;

    select count (*)::integer
      into v_current_count
      from public.citizen_assignments ca
     where ca.assignment_type     = 'deposit'
       and ca.deposit_instance_id = p_target_id;

  -- -----------------------------------------------------------------------
  -- Target validation and current-count fetch: husbandry / culling
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

    select count (*)::integer
      into v_current_count
      from public.citizen_assignments ca
     where ca.assignment_type                 = p_assignment_type
       and ca.managed_population_instance_id  = p_target_id;

  -- -----------------------------------------------------------------------
  -- Target validation and current-count fetch: trade_route
  -- -----------------------------------------------------------------------
  elsif p_assignment_type = 'trade_route' then

    if p_trade_route_end is null or p_trade_route_end not in ('origin', 'destination') then
      raise exception 'trade_route_end must be origin or destination'
        using errcode = 'P0001';
    end if;

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

    select count (*)::integer
      into v_current_count
      from public.citizen_assignments ca
     where ca.assignment_type = 'trade_route'
       and ca.trade_route_id  = p_target_id
       and ca.trade_route_end = p_trade_route_end;

  end if;

  -- -----------------------------------------------------------------------
  -- Current world turn number
  -- -----------------------------------------------------------------------
  select w.current_turn_number
    into v_turn_number
    from public.worlds w
   where w.id = v_world_id;

  -- -----------------------------------------------------------------------
  -- No-op
  -- -----------------------------------------------------------------------
  if v_current_count = p_target_count then
    before              := v_current_count;
    after               := v_current_count;
    added_citizen_ids   := array[]::uuid[];
    removed_citizen_ids := array[]::uuid[];
    return next;
    return;
  end if;

  v_delta := p_target_count - v_current_count;

  -- -----------------------------------------------------------------------
  -- Raise: pick unassigned alive NPCs in deterministic-random order
  -- -----------------------------------------------------------------------
  if v_delta > 0 then

    if (
      select count (*)
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = p_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
    ) < v_delta then
      raise exception 'insufficient unassigned NPCs available'
        using errcode = 'P0001';
    end if;

    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    if p_assignment_type = 'deposit' then
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
         order by random ()
         limit v_delta
      ),
      inserted as (
        insert into public.citizen_assignments (
          citizen_id, assignment_type, deposit_instance_id, assigned_on_turn_number
        )
        select sn.id, 'deposit', p_target_id, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;

    elsif p_assignment_type = 'husbandry' then
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
         order by random ()
         limit v_delta
      ),
      inserted as (
        insert into public.citizen_assignments (
          citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number
        )
        select sn.id, 'husbandry', p_target_id, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;

    elsif p_assignment_type = 'culling' then
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
         order by random ()
         limit v_delta
      ),
      inserted as (
        insert into public.citizen_assignments (
          citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number
        )
        select sn.id, 'culling', p_target_id, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;

    elsif p_assignment_type = 'trade_route' then
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
         order by random ()
         limit v_delta
      ),
      inserted as (
        insert into public.citizen_assignments (
          citizen_id, assignment_type, trade_route_id, trade_route_end, assigned_on_turn_number
        )
        select sn.id, 'trade_route', p_target_id, p_trade_route_end, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;
    end if;

    v_removed_ids := array[]::uuid[];

  -- -----------------------------------------------------------------------
  -- Lower: remove assignees in deterministic-random order
  -- -----------------------------------------------------------------------
  else

    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    if p_assignment_type = 'deposit' then
      select array_agg (t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
           where ca.assignment_type     = 'deposit'
             and ca.deposit_instance_id = p_target_id
           order by random () asc
           limit (v_current_count - p_target_count)
        ) t;

    elsif p_assignment_type in ('husbandry', 'culling') then
      select array_agg (t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
           where ca.assignment_type                = p_assignment_type
             and ca.managed_population_instance_id = p_target_id
           order by random () asc
           limit (v_current_count - p_target_count)
        ) t;

    elsif p_assignment_type = 'trade_route' then
      select array_agg (t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
           where ca.assignment_type = 'trade_route'
             and ca.trade_route_id  = p_target_id
             and ca.trade_route_end = p_trade_route_end
           order by random () asc
           limit (v_current_count - p_target_count)
        ) t;
    end if;

    delete from public.citizen_assignments
     where citizen_id = any (v_removed_ids);

    v_added_ids := array[]::uuid[];
  end if;

  before              := v_current_count;
  after               := p_target_count;
  added_citizen_ids   := coalesce (v_added_ids,   array[]::uuid[]);
  removed_citizen_ids := coalesce (v_removed_ids, array[]::uuid[]);
  return next;
end;
$$;

revoke all on function public.set_per_target_bulk_assignment (uuid, text, uuid, integer, text)
from
  public;

grant
execute on function public.set_per_target_bulk_assignment (uuid, text, uuid, integer, text) to authenticated;
