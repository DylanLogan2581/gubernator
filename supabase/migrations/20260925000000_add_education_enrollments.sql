-- Migration: add_education_enrollments
-- #1103: per-citizen school enrollment. Existing job/deposit assignment RPCs
-- are count-based and auto-pick citizens, which does not fit education --
-- WHO studies matters, so enrollment is an explicit per-citizen action.
--
-- education_enrollments: one row per enrolled citizen (unique on citizen_id
-- -- a citizen attends at most one school at a time). progress_turns tracks
-- turns spent at the current target_level_id; the simulation-side turn
-- engine that advances progress_turns and promotes citizens on completion is
-- out of scope for this issue.
--
-- enroll_citizen / unenroll_citizen are the only write path (RLS grants
-- SELECT to world members only, mirroring the nation_offices pattern).
-- unenroll_citizen deletes the row outright -- progress loss is deliberate,
-- discourages churn.
--
-- Bulk assignment RPCs (set_bulk_standard_job_assignment,
-- set_per_target_bulk_assignment) are extended at the bottom of this
-- migration so enrolled citizens are excluded from their unassigned-NPC
-- picking pools. Note: this is a different mechanism than #1081's
-- officeholder handling -- officeholders stay assignable and are zeroed out
-- at simulation time instead, since dismissing an office should restore
-- contribution without reassignment. Enrollment instead removes the citizen
-- from the selectable pool entirely, since a student should not be handed a
-- job while enrolled.
-- ---------------------------------------------------------------------------
-- education_enrollments
-- ---------------------------------------------------------------------------
create table public.education_enrollments (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  settlement_building_id uuid not null references public.settlement_buildings (id) on delete cascade,
  citizen_id uuid not null references public.citizens (id) on delete cascade,
  target_level_id uuid not null references public.education_levels (id) on delete restrict,
  progress_turns integer not null default 0,
  enrolled_turn_number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint education_enrollments_citizen_unique unique (citizen_id),
  constraint education_enrollments_progress_turns_non_negative check (progress_turns >= 0)
);

create index education_enrollments_world_id_idx on public.education_enrollments (world_id);

create index education_enrollments_settlement_building_id_idx on public.education_enrollments (settlement_building_id);

create trigger education_enrollments_set_updated_at before
update on public.education_enrollments for each row
execute function public.set_updated_at ();

alter table public.education_enrollments enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies -- SELECT world members; writes via RPCs only (no insert /
-- update / delete policy for authenticated, mirrors nation_offices).
-- ---------------------------------------------------------------------------
create policy "education_enrollments_select_world_access" on public.education_enrollments for
select
  to authenticated using (public.has_world_access (world_id));

-- ---------------------------------------------------------------------------
-- enroll_citizen: enrolls a specific citizen into a specific school building
-- at the next education level above their current rank.
--
-- Error contract:
--   P0002 (no_data_found)          -- building/citizen not found
--   42501 (insufficient_privilege) -- caller does not manage the settlement
--   22023 (invalid_parameter_value)-- world is archived
--   P0001 (raise_exception)        -- building not active, building is not a
--                                     school, citizen not alive, citizen not
--                                     in this settlement, already enrolled,
--                                     at capacity, nothing left to learn
-- ---------------------------------------------------------------------------
create or replace function public.enroll_citizen (p_settlement_building_id uuid, p_citizen_id uuid) returns setof public.education_enrollments language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id           uuid;
  v_settlement_id      uuid;
  v_building_state     text;
  v_education_config   jsonb;
  v_turn_number        integer;
  v_citizen_settlement uuid;
  v_citizen_status     text;
  v_citizen_rank       integer;
  v_teaches_up_to_id   uuid;
  v_teaches_up_to_rank integer;
  v_student_capacity   integer;
  v_current_enrolled   integer;
  v_target_level_id    uuid;
  v_result             public.education_enrollments;
begin
  if p_settlement_building_id is null or p_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select s.id, n.world_id, sb.state, bbt.education_config_json
    into v_settlement_id, v_world_id, v_building_state, v_education_config
    from public.settlement_buildings sb
    join public.settlements s on s.id = sb.settlement_id
    join public.nations n on n.id = s.nation_id
    join public.building_blueprint_tiers bbt on bbt.id = sb.current_tier_id
   where sb.id = p_settlement_building_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (v_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.' using errcode = '22023';
  end if;

  if v_building_state <> 'active' then
    raise exception 'settlement building is not active' using errcode = 'P0001';
  end if;

  if v_education_config is null then
    raise exception 'settlement building is not configured as a school' using errcode = 'P0001';
  end if;

  select c.settlement_id, c.status, el.rank
    into v_citizen_settlement, v_citizen_status, v_citizen_rank
    from public.citizens c
    left join public.education_levels el on el.id = c.education_level_id
   where c.id = p_citizen_id;

  if v_citizen_status is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_citizen_status <> 'alive' then
    raise exception 'citizen is not alive' using errcode = 'P0001';
  end if;

  if v_citizen_settlement is null or v_citizen_settlement <> v_settlement_id then
    raise exception 'citizen does not belong to this settlement' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.education_enrollments where citizen_id = p_citizen_id) then
    raise exception 'citizen is already enrolled in a school' using errcode = 'P0001';
  end if;

  v_student_capacity := (v_education_config ->> 'student_capacity')::integer;

  select count(*)::integer
    into v_current_enrolled
    from public.education_enrollments
   where settlement_building_id = p_settlement_building_id;

  if v_current_enrolled >= v_student_capacity then
    raise exception 'settlement building is at student capacity' using errcode = 'P0001';
  end if;

  v_teaches_up_to_id := (v_education_config ->> 'teaches_up_to_level_id')::uuid;

  select rank
    into v_teaches_up_to_rank
    from public.education_levels
   where id = v_teaches_up_to_id;

  if v_teaches_up_to_rank is null or coalesce(v_citizen_rank, 0) >= v_teaches_up_to_rank then
    raise exception 'Nothing left to learn here' using errcode = 'P0001';
  end if;

  select id
    into v_target_level_id
    from public.education_levels
   where world_id = v_world_id
     and rank > coalesce(v_citizen_rank, 0)
   order by rank asc
   limit 1;

  select w.current_turn_number
    into v_turn_number
    from public.worlds w
   where w.id = v_world_id;

  insert into public.education_enrollments (
    world_id, settlement_building_id, citizen_id, target_level_id, enrolled_turn_number
  ) values (
    v_world_id, p_settlement_building_id, p_citizen_id, v_target_level_id, v_turn_number
  )
  returning * into v_result;

  return next v_result;
end;
$$;

revoke all on function public.enroll_citizen (uuid, uuid)
from
  public;

grant
execute on function public.enroll_citizen (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- unenroll_citizen: removes an enrollment outright (progress lost).
--
-- Error contract:
--   P0002 (no_data_found)          -- enrollment not found
--   42501 (insufficient_privilege) -- caller does not manage the settlement
--   22023 (invalid_parameter_value)-- world is archived
-- ---------------------------------------------------------------------------
create or replace function public.unenroll_citizen (p_enrollment_id uuid) returns setof public.education_enrollments language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_world_id      uuid;
  v_result        public.education_enrollments;
begin
  if p_enrollment_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select sb.settlement_id, n.world_id
    into v_settlement_id, v_world_id
    from public.education_enrollments ee
    join public.settlement_buildings sb on sb.id = ee.settlement_building_id
    join public.settlements s on s.id = sb.settlement_id
    join public.nations n on n.id = s.nation_id
   where ee.id = p_enrollment_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (v_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.' using errcode = '22023';
  end if;

  delete from public.education_enrollments
  where id = p_enrollment_id
  returning * into v_result;

  return next v_result;
end;
$$;

revoke all on function public.unenroll_citizen (uuid)
from
  public;

grant
execute on function public.unenroll_citizen (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Exclude enrolled citizens from bulk-assignment NPC picking pools.
-- Redefined in full from each function's latest prior definition, with
-- "and not exists (select 1 from public.education_enrollments ee where
-- ee.citizen_id = c.id)" added to every unassigned-NPC selection query
-- (capacity checks and picking CTEs alike).
-- ---------------------------------------------------------------------------
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

  -- Archived world guard
  if public.world_is_archived(v_world_id) then
    raise exception 'world is archived' using errcode = 'P0001';
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

  if v_job_type not in ('standard', 'construction') then
    raise exception 'job type must be standard or construction' using errcode = 'P0001';
  end if;

  -- Capacity check (both standard and construction have base_capacity)
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

  -- Current count depends on job type
  if v_job_type = 'construction' then
    -- Pool count: all construction_project assignments in the settlement
    select count (*)::integer
      into v_current_count
      from public.citizen_assignments ca
      join public.citizens c on c.id = ca.citizen_id
     where ca.assignment_type = 'construction_project'
       and c.settlement_id    = p_settlement_id;
  else
    -- Standard: count by job_id
    select count (*)::integer
      into v_current_count
      from public.citizen_assignments ca
      join public.citizens c on c.id = ca.citizen_id
     where ca.assignment_type = 'standard_job'
       and ca.job_id          = p_job_id
       and c.settlement_id    = p_settlement_id;
  end if;

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
         and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
    ) < v_delta then
      raise exception 'insufficient unassigned NPCs available'
        using errcode = 'P0001';
    end if;

    -- Deterministic-random within the transaction: seed with fractional epoch
    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    if v_job_type = 'construction' then
      -- Pool members: assignment_type = construction_project, job_id = null
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
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
        select sn.id, 'construction_project', null, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;
    else
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
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
    end if;

    v_removed_ids := array[]::uuid[];

  else
    -- Lower: remove citizens in deterministic-random order
    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    if v_job_type = 'construction' then
      select array_agg (t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
            join public.citizens c on c.id = ca.citizen_id
           where ca.assignment_type = 'construction_project'
             and c.settlement_id    = p_settlement_id
           order by random () asc
           limit (v_current_count - p_target_count)
        ) t;
    else
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
    end if;

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
  -- Lock deposit_instances row to prevent concurrent modifications.
  -- -----------------------------------------------------------------------
  if p_assignment_type = 'deposit' then

    select di.settlement_id, di.status, di.max_workers
      into v_target_settlement, v_target_status, v_max_workers
      from public.deposit_instances di
     where di.id = p_target_id
     for update;

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
  -- Lock managed_population_instances row to prevent concurrent modifications.
  -- -----------------------------------------------------------------------
  elsif p_assignment_type in ('husbandry', 'culling') then

    select mpi.settlement_id, mpi.status
      into v_target_settlement, v_target_status
      from public.managed_population_instances mpi
     where mpi.id = p_target_id
     for update;

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
  -- Lock trade_routes row to prevent concurrent modifications.
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
       )
     for update;

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
         and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
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
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
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
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
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
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
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
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
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
