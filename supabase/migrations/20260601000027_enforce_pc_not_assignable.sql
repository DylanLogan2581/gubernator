-- Migration: enforce_pc_not_assignable
-- Enforces that player_character citizens cannot hold citizen_assignments and
-- removes the now-obsolete p_removal_strategy parameter from the bulk RPCs.
--
-- Changes:
--   1. BEFORE INSERT OR UPDATE trigger on citizen_assignments rejects any row
--      where the referenced citizen is a player_character (P0001, message names
--      the citizen). Fires for all callers including superuser.
--
--   2. set_bulk_standard_job_assignment(uuid, uuid, integer) — drops
--      p_removal_strategy. Raise path picks unassigned alive NPCs in
--      deterministic-random order (setseed + order by random()). Lower path
--      removes assignees in the same deterministic-random order. No PC sort
--      tier is needed since PCs cannot hold assignments.
--
--   3. set_bulk_construction_assignment(uuid, integer) — same changes.
--
--   4. set_per_target_assignment — signature unchanged; adds an early PC check
--      (P0001) immediately after the alive-in-settlement validation.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- 1. Trigger: block player_character inserts / updates on citizen_assignments
-- ---------------------------------------------------------------------------
create or replace function public.citizen_assignments_no_pc () returns trigger language plpgsql
set
  search_path = '' as $$
declare
  v_citizen_type text;
  v_citizen_name text;
begin
  select c.citizen_type, c.name
    into v_citizen_type, v_citizen_name
    from public.citizens c
   where c.id = new.citizen_id;

  if v_citizen_type = 'player_character' then
    raise exception 'citizen % (%) is a player_character and cannot be assigned',
      new.citizen_id, coalesce (v_citizen_name, 'unknown')
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger citizen_assignments_no_pc before insert
or
update on public.citizen_assignments for each row
execute function public.citizen_assignments_no_pc ();

-- ---------------------------------------------------------------------------
-- 2. Bulk standard-job assignment — drop old signature, create new
-- ---------------------------------------------------------------------------
drop function public.set_bulk_standard_job_assignment (uuid, uuid, integer, text);

create or replace function public.set_bulk_standard_job_assignment (
  p_settlement_id uuid,
  p_job_id uuid,
  p_target_count integer
) returns table (
  before integer,
  after integer,
  added_citizen_ids uuid[],
  removed_citizen_ids uuid[]
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id       uuid;
  v_turn_number    integer;
  v_job_type       text;
  v_job_is_trashed boolean;
  v_capacity       integer;
  v_current_count  integer;
  v_delta          integer;
  v_added_ids      uuid[] := array[]::uuid[];
  v_removed_ids    uuid[] := array[]::uuid[];
begin
  -- Null guard
  if p_settlement_id is null
     or p_job_id is null
     or p_target_count is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Input validation
  if p_target_count < 0 then
    raise exception 'target count must not be negative'
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

  -- Load job (must belong to the same world)
  select j.job_type, j.is_trashed
    into v_job_type, v_job_is_trashed
    from public.job_definitions j
   where j.id       = p_job_id
     and j.world_id = v_world_id;

  if v_job_type is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_job_is_trashed then
    raise exception 'job is trashed' using errcode = 'P0001';
  end if;

  if v_job_type <> 'standard' then
    raise exception 'job type must be standard' using errcode = 'P0001';
  end if;

  -- Capacity check
  v_capacity := public.settlement_job_capacity (p_settlement_id, p_job_id);

  if p_target_count > v_capacity then
    raise exception 'target count exceeds settlement job capacity'
      using errcode = 'P0001';
  end if;

  -- Current world turn number (used when inserting new assignments)
  select w.current_turn_number
    into v_turn_number
    from public.worlds w
   where w.id = v_world_id;

  -- Current count of citizens assigned to this job in this settlement
  select count (*)::integer
    into v_current_count
    from public.citizen_assignments ca
    join public.citizens c on c.id = ca.citizen_id
   where ca.assignment_type = 'standard_job'
     and ca.job_id          = p_job_id
     and c.settlement_id    = p_settlement_id;

  -- No-op
  if v_current_count = p_target_count then
    before              := v_current_count;
    after               := v_current_count;
    added_citizen_ids   := array[]::uuid[];
    removed_citizen_ids := array[]::uuid[];
    return next;
    return;
  end if;

  v_delta := p_target_count - v_current_count;

  if v_delta > 0 then
    -- Raise: add unassigned alive NPCs (reject if insufficient)
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

    -- Deterministic-random within the transaction: seed with fractional epoch
    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

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
        citizen_id,
        assignment_type,
        job_id,
        assigned_on_turn_number
      )
      select sn.id, 'standard_job', p_job_id, v_turn_number
        from selected_npcs sn
      returning citizen_id
    )
    select array_agg (citizen_id order by citizen_id)
      into v_added_ids
      from inserted;

    v_removed_ids := array[]::uuid[];

  else
    -- Lower: remove citizens in deterministic-random order
    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    select array_agg (t.citizen_id)
      into v_removed_ids
      from (
        select ca.citizen_id
          from public.citizen_assignments ca
          join public.citizens c on c.id = ca.citizen_id
         where ca.assignment_type = 'standard_job'
           and ca.job_id          = p_job_id
           and c.settlement_id    = p_settlement_id
         order by random () asc
         limit (v_current_count - p_target_count)
      ) t;

    delete from public.citizen_assignments ca
     where ca.citizen_id = any (v_removed_ids);

    v_added_ids := array[]::uuid[];
  end if;

  before              := v_current_count;
  after               := p_target_count;
  added_citizen_ids   := coalesce (v_added_ids,   array[]::uuid[]);
  removed_citizen_ids := coalesce (v_removed_ids, array[]::uuid[]);
  return next;
end;
$$;

revoke all on function public.set_bulk_standard_job_assignment (uuid, uuid, integer)
from
  public;

grant
execute on function public.set_bulk_standard_job_assignment (uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Bulk construction assignment — drop old signature, create new
-- ---------------------------------------------------------------------------
drop function public.set_bulk_construction_assignment (uuid, integer, text);

create or replace function public.set_bulk_construction_assignment (
  p_construction_project_id uuid,
  p_target_count integer
) returns table (
  before integer,
  after integer,
  added_citizen_ids uuid[],
  removed_citizen_ids uuid[]
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id  uuid;
  v_project_status text;
  v_world_id       uuid;
  v_turn_number    integer;
  v_current_count  integer;
  v_delta          integer;
  v_added_ids      uuid[] := array[]::uuid[];
  v_removed_ids    uuid[] := array[]::uuid[];
begin
  -- Null guard
  if p_construction_project_id is null
     or p_target_count is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Input validation
  if p_target_count < 0 then
    raise exception 'target count must not be negative'
      using errcode = 'P0001';
  end if;

  -- Load project (get settlement_id and status; P0002 if not found)
  select cp.settlement_id, cp.status
    into v_settlement_id, v_project_status
    from public.construction_projects cp
   where cp.id = p_construction_project_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve settlement → world
  select n.world_id
    into v_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = v_settlement_id;

  -- Authorization
  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (v_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Reject terminal projects
  if v_project_status in ('complete', 'cancelled') then
    raise exception 'construction project is in a terminal status (%)', v_project_status
      using errcode = 'P0001';
  end if;

  -- Current world turn number (used when inserting new assignments)
  select w.current_turn_number
    into v_turn_number
    from public.worlds w
   where w.id = v_world_id;

  -- Current count of citizens assigned to this construction project
  select count (*)::integer
    into v_current_count
    from public.citizen_assignments ca
   where ca.assignment_type         = 'construction_project'
     and ca.construction_project_id = p_construction_project_id;

  -- No-op
  if v_current_count = p_target_count then
    before              := v_current_count;
    after               := v_current_count;
    added_citizen_ids   := array[]::uuid[];
    removed_citizen_ids := array[]::uuid[];
    return next;
    return;
  end if;

  v_delta := p_target_count - v_current_count;

  if v_delta > 0 then
    -- Raise: add unassigned alive NPCs (reject if insufficient)
    if (
      select count (*)
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = v_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
    ) < v_delta then
      raise exception 'insufficient unassigned NPCs available'
        using errcode = 'P0001';
    end if;

    -- Deterministic-random within the transaction: seed with fractional epoch
    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    with selected_npcs as (
      select c.id
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = v_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
       order by random ()
       limit v_delta
    ),
    inserted as (
      insert into public.citizen_assignments (
        citizen_id,
        assignment_type,
        construction_project_id,
        assigned_on_turn_number
      )
      select sn.id, 'construction_project', p_construction_project_id, v_turn_number
        from selected_npcs sn
      returning citizen_id
    )
    select array_agg (citizen_id order by citizen_id)
      into v_added_ids
      from inserted;

    v_removed_ids := array[]::uuid[];

  else
    -- Lower: remove citizens in deterministic-random order
    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    select array_agg (t.citizen_id)
      into v_removed_ids
      from (
        select ca.citizen_id
          from public.citizen_assignments ca
         where ca.assignment_type         = 'construction_project'
           and ca.construction_project_id = p_construction_project_id
         order by random () asc
         limit (v_current_count - p_target_count)
      ) t;

    delete from public.citizen_assignments ca
     where ca.citizen_id = any (v_removed_ids);

    v_added_ids := array[]::uuid[];
  end if;

  before              := v_current_count;
  after               := p_target_count;
  added_citizen_ids   := coalesce (v_added_ids,   array[]::uuid[]);
  removed_citizen_ids := coalesce (v_removed_ids, array[]::uuid[]);
  return next;
end;
$$;

revoke all on function public.set_bulk_construction_assignment (uuid, integer)
from
  public;

grant
execute on function public.set_bulk_construction_assignment (uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Per-target assignment — add early PC check (same signature, replace body)
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
  v_world_id          uuid;
  v_turn_number       integer;
  v_replaced_count    integer := 0;
  v_target_settlement uuid;
  v_target_status     text;
  v_max_workers       integer;
  v_job_is_trashed    boolean;
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
       and cardinality (p_citizen_ids) > v_max_workers
    then
      raise exception 'citizen count (%) exceeds max workers (%) for this deposit instance',
        cardinality (p_citizen_ids), v_max_workers
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
      from unnest (p_citizen_ids) as cid
     where not exists (
       select 1
         from public.citizens c
        where c.id            = cid
          and c.settlement_id = p_settlement_id
          and c.status        = 'alive'
     )
  ) then
    raise exception 'one or more citizens are not alive members of this settlement'
      using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------------
  -- Reject player_character citizens.
  -- -----------------------------------------------------------------------
  if exists (
    select 1
      from unnest (p_citizen_ids) as cid
      join public.citizens c on c.id = cid
     where c.citizen_type = 'player_character'
  ) then
    raise exception 'one or more citizens are player_characters and cannot be assigned'
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
    select count (*)::integer
      into v_replaced_count
      from public.citizen_assignments ca
     where (
       ca.deposit_instance_id = p_target_id
       and ca.citizen_id <> all (p_citizen_ids)
     )
     or ca.citizen_id = any (p_citizen_ids);

  elsif p_assignment_type in ('husbandry', 'culling') then
    select count (*)::integer
      into v_replaced_count
      from public.citizen_assignments ca
     where (
       ca.managed_population_instance_id = p_target_id
       and ca.assignment_type            = p_assignment_type
       and ca.citizen_id                 <> all (p_citizen_ids)
     )
     or ca.citizen_id = any (p_citizen_ids);

  elsif p_assignment_type = 'trade_route' then
    select count (*)::integer
      into v_replaced_count
      from public.citizen_assignments ca
     where (
       ca.trade_route_id  = p_target_id
       and ca.trade_route_end = p_trade_route_end
       and ca.citizen_id  <> all (p_citizen_ids)
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
       and assignment_type                = p_assignment_type;

  elsif p_assignment_type = 'trade_route' then
    delete from public.citizen_assignments
     where trade_route_id  = p_target_id
       and trade_route_end = p_trade_route_end;
  end if;

  -- Step 3: Insert new assignments (skip if list is empty).
  if cardinality (p_citizen_ids) > 0 then
    if p_assignment_type = 'deposit' then
      insert into public.citizen_assignments (
        citizen_id, assignment_type, deposit_instance_id, assigned_on_turn_number
      )
      select cid, 'deposit', p_target_id, v_turn_number
        from unnest (p_citizen_ids) as cid;

    elsif p_assignment_type = 'husbandry' then
      insert into public.citizen_assignments (
        citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number
      )
      select cid, 'husbandry', p_target_id, v_turn_number
        from unnest (p_citizen_ids) as cid;

    elsif p_assignment_type = 'culling' then
      insert into public.citizen_assignments (
        citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number
      )
      select cid, 'culling', p_target_id, v_turn_number
        from unnest (p_citizen_ids) as cid;

    elsif p_assignment_type = 'trade_route' then
      insert into public.citizen_assignments (
        citizen_id, assignment_type, trade_route_id, trade_route_end, assigned_on_turn_number
      )
      select cid, 'trade_route', p_target_id, p_trade_route_end, v_turn_number
        from unnest (p_citizen_ids) as cid;
    end if;
  end if;

  assigned_count := cardinality (p_citizen_ids);
  replaced_count := coalesce (v_replaced_count, 0);
  return next;
end;
$$;

revoke all on function public.set_per_target_assignment (uuid, text, uuid, uuid[], text)
from
  public;

grant
execute on function public.set_per_target_assignment (uuid, text, uuid, uuid[], text) to authenticated;
