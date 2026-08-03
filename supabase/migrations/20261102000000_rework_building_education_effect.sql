-- Migration: rework_building_education_effect
-- #1170: education stops being a bespoke building_blueprint_tiers column
-- (education_config_json) and becomes a tagged entry in the generic
-- effects_json array, alongside job_capacity_increase / etc. This also
-- introduces:
--   - level RANGES: an explicit list of { from_level_id, to_level_id, turns }
--     transitions instead of a single teaches_up_to_level_id + one flat
--     turns_per_level. from_level_id null means "starting from no
--     education" (citizens.education_level_id null / rank 0). "Teaches up
--     to X" is expressed as the full chain of consecutive transitions from
--     null through X; "only teaches X -> Y" is a single entry, which lets a
--     tier exclude uneducated citizens by omitting the null -> first-level
--     transition.
--   - teacher_capacity (max teachers) replacing student_capacity; students
--     are derived as teacher_capacity * students_per_teacher.
--   - a dedicated 'teacher' job type. teacher_job_id must reference a job of
--     job_type = 'teacher'. Teacher jobs are assigned the same way standard
--     jobs are (set_bulk_standard_job_assignment / job counts), so job_type
--     gating that previously special-cased ('standard', 'construction') is
--     widened to include 'teacher' wherever it governs that shared
--     count-based assignment path.
-- ---------------------------------------------------------------------------
-- job_definitions: add the 'teacher' job type
-- ---------------------------------------------------------------------------
alter table public.job_definitions
drop constraint job_definitions_job_type_check;

alter table public.job_definitions
add constraint job_definitions_job_type_check check (
  job_type in (
    'standard',
    'construction',
    'deposit',
    'husbandry',
    'culling',
    'trader',
    'teacher'
  )
);

alter table public.job_definitions
drop constraint job_definitions_base_capacity_check;

alter table public.job_definitions
add constraint job_definitions_base_capacity_check check (
  (
    job_type in ('standard', 'construction', 'teacher')
    and base_capacity is not null
  )
  or (
    job_type not in ('standard', 'construction', 'teacher')
    and base_capacity is null
  )
);

-- ---------------------------------------------------------------------------
-- is_valid_tier_effects_array: add the 'education' discriminated type.
--   { type: 'education', teacher_job_id: uuid, teacher_capacity: int > 0,
--     students_per_teacher: int > 0,
--     levels: [{ from_level_id: uuid | null, to_level_id: uuid, turns: int > 0 }, ...] }
-- No 'amount' field (unlike the other four types). teacher_job_id must
-- reference an active job of job_type = 'teacher' in the same world.
-- from_level_id / to_level_id must reference education_levels in the same
-- world (from_level_id null is allowed -- "no education"), to_level's rank
-- must exceed from_level's rank (or be any rank when from_level_id is
-- null), levels[] must not repeat a from_level_id, and at most one
-- 'education' entry is allowed per tier.
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_tier_effects_array (arr jsonb, p_world_id uuid) returns boolean language plpgsql stable
set
  search_path = '' as $$
begin
  if arr is null or jsonb_typeof (arr) != 'array' then
    return false;
  end if;

  -- Validate shape of every element
  if exists (
    select
      1
    from
      jsonb_array_elements (arr) as e (entry)
    where
      jsonb_typeof (e.entry) != 'object'
      or not (e.entry ? 'type')
      or jsonb_typeof (e.entry -> 'type') != 'string'
      or not (e.entry ->> 'type') = any (
        array[
          'job_capacity_increase',
          'passive_resource_production',
          'resource_storage_increase',
          'population_cap_increase',
          'education'
        ]
      )
      -- every type except 'education' requires a numeric amount
      or (
        (e.entry ->> 'type') != 'education'
        and (
          not (e.entry ? 'amount')
          or jsonb_typeof (e.entry -> 'amount') != 'number'
        )
      )
      -- job_capacity_increase: requires job_id string; no extra keys
      or (
        (e.entry ->> 'type') = 'job_capacity_increase'
        and (
          not (e.entry ? 'job_id')
          or jsonb_typeof (e.entry -> 'job_id') != 'string'
          or (e.entry - '{type,job_id,amount}'::text[]) != '{}'::jsonb
        )
      )
      -- passive_resource_production: requires resource_id string; no extra keys
      or (
        (e.entry ->> 'type') = 'passive_resource_production'
        and (
          not (e.entry ? 'resource_id')
          or jsonb_typeof (e.entry -> 'resource_id') != 'string'
          or (e.entry - '{type,resource_id,amount}'::text[]) != '{}'::jsonb
        )
      )
      -- resource_storage_increase: requires resource_id string; no extra keys
      or (
        (e.entry ->> 'type') = 'resource_storage_increase'
        and (
          not (e.entry ? 'resource_id')
          or jsonb_typeof (e.entry -> 'resource_id') != 'string'
          or (e.entry - '{type,resource_id,amount}'::text[]) != '{}'::jsonb
        )
      )
      -- population_cap_increase: only type and amount allowed
      or (
        (e.entry ->> 'type') = 'population_cap_increase'
        and (e.entry - '{type,amount}'::text[]) != '{}'::jsonb
      )
      -- education: teacher_job_id, teacher_capacity, students_per_teacher,
      -- levels[] (non-empty, no duplicate from_level_id); no extra keys
      or (
        (e.entry ->> 'type') = 'education'
        and (
          not (e.entry ? 'teacher_job_id')
          or jsonb_typeof (e.entry -> 'teacher_job_id') != 'string'
          or not (e.entry ? 'teacher_capacity')
          or jsonb_typeof (e.entry -> 'teacher_capacity') != 'number'
          or (e.entry ->> 'teacher_capacity')::numeric <= 0
          or (e.entry ->> 'teacher_capacity')::numeric != floor ((e.entry ->> 'teacher_capacity')::numeric)
          or not (e.entry ? 'students_per_teacher')
          or jsonb_typeof (e.entry -> 'students_per_teacher') != 'number'
          or (e.entry ->> 'students_per_teacher')::numeric <= 0
          or (e.entry ->> 'students_per_teacher')::numeric != floor ((e.entry ->> 'students_per_teacher')::numeric)
          or not (e.entry ? 'levels')
          or jsonb_typeof (e.entry -> 'levels') != 'array'
          or jsonb_array_length (e.entry -> 'levels') = 0
          or (e.entry - '{type,teacher_job_id,teacher_capacity,students_per_teacher,levels}'::text[]) != '{}'::jsonb
          or exists (
            select
              1
            from
              jsonb_array_elements (e.entry -> 'levels') as lvl (item)
            where
              jsonb_typeof (lvl.item) != 'object'
              or not (lvl.item ? 'from_level_id')
              or jsonb_typeof (lvl.item -> 'from_level_id') not in ('string', 'null')
              or not (lvl.item ? 'to_level_id')
              or jsonb_typeof (lvl.item -> 'to_level_id') != 'string'
              or not (lvl.item ? 'turns')
              or jsonb_typeof (lvl.item -> 'turns') != 'number'
              or (lvl.item ->> 'turns')::numeric <= 0
              or (lvl.item ->> 'turns')::numeric != floor ((lvl.item ->> 'turns')::numeric)
              or (lvl.item - '{from_level_id,to_level_id,turns}'::text[]) != '{}'::jsonb
          )
          or (
            select
              count(*)
            from
              jsonb_array_elements (e.entry -> 'levels') as lvl (item)
          ) != (
            select
              count(distinct coalesce (lvl.item ->> 'from_level_id', '__none__'))
            from
              jsonb_array_elements (e.entry -> 'levels') as lvl (item)
          )
        )
      )
  ) then
    return false;
  end if;

  -- At most one education effect per tier
  if (
    select
      count(*)
    from
      jsonb_array_elements (arr) as e (entry)
    where
      (e.entry ->> 'type') = 'education'
  ) > 1 then
    return false;
  end if;

  -- Validate resource_id references for resource-based effect types
  if exists (
    select
      1
    from
      jsonb_array_elements (arr) as e (entry)
    where
      (e.entry ->> 'type') in ('passive_resource_production', 'resource_storage_increase')
      and not exists (
        select
          1
        from
          public.resources r
        where
          r.id = (e.entry ->> 'resource_id')::uuid
          and r.world_id = p_world_id
          and not r.is_trashed
      )
  ) then
    return false;
  end if;

  -- Validate job_id references for job_capacity_increase effects
  if exists (
    select
      1
    from
      jsonb_array_elements (arr) as e (entry)
    where
      (e.entry ->> 'type') = 'job_capacity_increase'
      and not exists (
        select
          1
        from
          public.job_definitions j
        where
          j.id = (e.entry ->> 'job_id')::uuid
          and j.world_id = p_world_id
          and not j.is_trashed
      )
  ) then
    return false;
  end if;

  -- teacher_job_id must reference an active teacher-type job in this world
  if exists (
    select
      1
    from
      jsonb_array_elements (arr) as e (entry)
    where
      (e.entry ->> 'type') = 'education'
      and not exists (
        select
          1
        from
          public.job_definitions j
        where
          j.id = (e.entry ->> 'teacher_job_id')::uuid
          and j.world_id = p_world_id
          and not j.is_trashed
          and j.job_type = 'teacher'
      )
  ) then
    return false;
  end if;

  -- levels[] from_level_id / to_level_id must reference education_levels in
  -- this world, and to_level's rank must exceed from_level's rank (or any
  -- rank, when from_level_id is null)
  if exists (
    select
      1
    from
      jsonb_array_elements (arr) as e (entry)
      cross join lateral jsonb_array_elements (e.entry -> 'levels') as lvl (item)
      left join public.education_levels fl on fl.id = (lvl.item ->> 'from_level_id')::uuid
      and fl.world_id = p_world_id
      left join public.education_levels tl on tl.id = (lvl.item ->> 'to_level_id')::uuid
      and tl.world_id = p_world_id
    where
      (e.entry ->> 'type') = 'education'
      and (
        tl.id is null
        or (
          lvl.item ->> 'from_level_id' is not null
          and fl.id is null
        )
        or tl.rank <= coalesce (fl.rank, 0)
      )
  ) then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: migrate existing education_config_json into an 'education'
-- effects_json entry per schooled tier.
--
-- Assumption (recorded per #1170 -- no existing seed/prod data references a
-- job as teacher_job_id for any purpose other than staffing that school, so
-- every such job is converted to job_type = 'teacher'): must happen before
-- the effects_json backfill UPDATE below, since that update re-fires
-- validate_building_tier_json, which now requires teacher_job_id to
-- reference a job_type = 'teacher' job.
-- ---------------------------------------------------------------------------
update public.job_definitions j
set
  job_type = 'teacher'
where
  exists (
    select
      1
    from
      public.building_blueprint_tiers bbt
    where
      bbt.education_config_json is not null
      and (bbt.education_config_json ->> 'teacher_job_id')::uuid = j.id
  );

do $backfill$
declare
  v_tier record;
  v_config jsonb;
  v_teaches_up_to_id uuid;
  v_student_capacity integer;
  v_turns_per_level integer;
  v_teacher_job_id uuid;
  v_students_per_teacher integer;
  v_teacher_capacity integer;
  v_teaches_up_to_rank integer;
  v_prev_level_id uuid;
  v_levels jsonb;
  v_level record;
begin
  for v_tier in
    select bbt.id, bbt.education_config_json, bbt.effects_json, bb.world_id
    from public.building_blueprint_tiers bbt
    join public.building_blueprints bb on bb.id = bbt.building_blueprint_id
    where bbt.education_config_json is not null
  loop
    v_config := v_tier.education_config_json;
    v_teaches_up_to_id := (v_config ->> 'teaches_up_to_level_id')::uuid;
    v_student_capacity := (v_config ->> 'student_capacity')::integer;
    v_turns_per_level := greatest (coalesce ((v_config ->> 'turns_per_level')::integer, 1), 1);
    v_teacher_job_id := (v_config ->> 'teacher_job_id')::uuid;
    v_students_per_teacher := greatest (coalesce ((v_config ->> 'students_per_teacher')::integer, 1), 1);
    v_teacher_capacity := greatest (
      ceil (coalesce (v_student_capacity, 1)::numeric / v_students_per_teacher::numeric)::integer,
      1
    );

    select rank into v_teaches_up_to_rank
    from public.education_levels
    where id = v_teaches_up_to_id;

    v_levels := '[]'::jsonb;
    v_prev_level_id := null;

    if v_teaches_up_to_rank is not null then
      for v_level in
        select id, rank
        from public.education_levels
        where world_id = v_tier.world_id
          and rank <= v_teaches_up_to_rank
        order by rank asc
      loop
        v_levels := v_levels || jsonb_build_array (
          jsonb_build_object (
            'from_level_id', v_prev_level_id,
            'to_level_id', v_level.id,
            'turns', v_turns_per_level
          )
        );
        v_prev_level_id := v_level.id;
      end loop;
    end if;

    if jsonb_array_length (v_levels) > 0 then
      update public.building_blueprint_tiers
      set effects_json = coalesce (v_tier.effects_json, '[]'::jsonb) || jsonb_build_array (
        jsonb_build_object (
          'type', 'education',
          'teacher_job_id', v_teacher_job_id,
          'teacher_capacity', v_teacher_capacity,
          'students_per_teacher', v_students_per_teacher,
          'levels', v_levels
        )
      )
      where id = v_tier.id;
    end if;
  end loop;
end;
$backfill$;

-- ---------------------------------------------------------------------------
-- Drop the now-superseded education_config_json column
-- ---------------------------------------------------------------------------
alter table public.building_blueprint_tiers
drop constraint building_blueprint_tiers_education_config_object_check;

alter table public.building_blueprint_tiers
drop column education_config_json;

-- ---------------------------------------------------------------------------
-- enroll_citizen: re-read the school's config from the tier's effects_json
-- 'education' entry instead of education_config_json. Capacity is now
-- teacher_capacity * students_per_teacher (a static ceiling, unrelated to
-- how many teachers are actually staffed this turn -- mirrors the prior
-- student_capacity behavior). The target level is the exact transition
-- whose from_level_id matches the citizen's current education_level_id
-- (null-safe); level ranges replace the old "next rank up to teaches_up_to"
-- logic, so a school can now exclude uneducated citizens entirely by
-- omitting a null -> first-level transition.
-- ---------------------------------------------------------------------------
create or replace function public.enroll_citizen (p_settlement_building_id uuid, p_citizen_id uuid) returns setof public.education_enrollments language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id           uuid;
  v_settlement_id      uuid;
  v_building_state     text;
  v_effects            jsonb;
  v_education_entry    jsonb;
  v_turn_number        integer;
  v_citizen_settlement uuid;
  v_citizen_status     text;
  v_citizen_level_id   uuid;
  v_teacher_capacity   integer;
  v_students_per_teacher integer;
  v_capacity           integer;
  v_current_enrolled   integer;
  v_target_level_id    uuid;
  v_result             public.education_enrollments;
begin
  if p_settlement_building_id is null or p_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select s.id, n.world_id, sb.state, bbt.effects_json
    into v_settlement_id, v_world_id, v_building_state, v_effects
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

  select entry
    into v_education_entry
    from jsonb_array_elements (coalesce (v_effects, '[]'::jsonb)) as e (entry)
   where (e.entry ->> 'type') = 'education'
   limit 1;

  if v_education_entry is null then
    raise exception 'settlement building is not configured as a school' using errcode = 'P0001';
  end if;

  select c.settlement_id, c.status, c.education_level_id
    into v_citizen_settlement, v_citizen_status, v_citizen_level_id
    from public.citizens c
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

  if exists (select 1 from public.unit_soldiers where citizen_id = p_citizen_id) then
    raise exception 'citizen is enlisted as a soldier' using errcode = 'P0001';
  end if;

  v_teacher_capacity := (v_education_entry ->> 'teacher_capacity')::integer;
  v_students_per_teacher := (v_education_entry ->> 'students_per_teacher')::integer;
  v_capacity := v_teacher_capacity * v_students_per_teacher;

  perform 1
    from public.settlement_buildings
   where id = p_settlement_building_id
   for update;

  select count(*)::integer
    into v_current_enrolled
    from public.education_enrollments
   where settlement_building_id = p_settlement_building_id;

  if v_current_enrolled >= v_capacity then
    raise exception 'settlement building is at student capacity' using errcode = 'P0001';
  end if;

  select (lvl.item ->> 'to_level_id')::uuid
    into v_target_level_id
    from jsonb_array_elements (v_education_entry -> 'levels') as lvl (item)
   where (lvl.item ->> 'from_level_id') is not distinct from v_citizen_level_id::text
   limit 1;

  if v_target_level_id is null then
    raise exception 'Nothing left to learn here' using errcode = 'P0001';
  end if;

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

-- ---------------------------------------------------------------------------
-- Widen the 'standard'/'construction' job-type gate to include 'teacher' in
-- the two RPCs that drive the shared count-based assignment path. Bodies are
-- otherwise unchanged from their latest prior definitions
-- (20260930000000_add_unit_soldiers.sql / 20261020000000_gate_settlement_
-- standard_job_counts_world_access.sql).
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
  v_world_id                    uuid;
  v_turn_number                 integer;
  v_job_type                    text;
  v_job_is_trashed              boolean;
  v_required_education_level_id uuid;
  v_required_education_rank     integer;
  v_required_education_name     text;
  v_qualified_count             integer;
  v_capacity                    integer;
  v_current_count               integer;
  v_delta                       integer;
  v_added_ids                   uuid[] := array[]::uuid[];
  v_removed_ids                 uuid[] := array[]::uuid[];
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
  select j.job_type, j.is_trashed, j.required_education_level_id
    into v_job_type, v_job_is_trashed, v_required_education_level_id
    from public.job_definitions j
   where j.id       = p_job_id
     and j.world_id = v_world_id;

  if v_job_type is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_job_is_trashed then
    raise exception 'job is trashed' using errcode = 'P0001';
  end if;

  if v_job_type not in ('standard', 'construction', 'teacher') then
    raise exception 'job type must be standard, construction, or teacher' using errcode = 'P0001';
  end if;

  -- Capacity check (standard, construction, and teacher all have base_capacity)
  v_capacity := public.settlement_job_capacity (p_settlement_id, p_job_id);

  if p_target_count > v_capacity then
    raise exception 'target count exceeds settlement job capacity'
      using errcode = 'P0001';
  end if;

  -- Education requirement check: reject a target_count exceeding the
  -- qualified pool (alive, unenrolled, npc citizens in the settlement who
  -- meet the requirement).
  if v_required_education_level_id is not null then
    select rank, name
      into v_required_education_rank, v_required_education_name
      from public.education_levels
     where id = v_required_education_level_id;

    select count (*)::integer
      into v_qualified_count
      from public.citizens c
      join public.education_levels cel on cel.id = c.education_level_id
     where c.settlement_id = p_settlement_id
       and c.status        = 'alive'
       and c.citizen_type  = 'npc'
       and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
       and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
       and cel.rank        >= v_required_education_rank;

    if p_target_count > v_qualified_count then
      raise exception 'Only % citizens meet the education requirement (%)',
        v_qualified_count, v_required_education_name
        using errcode = 'P0001';
    end if;
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
    -- Standard / teacher: count by job_id
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
    -- Raise: add unassigned alive qualified NPCs (reject if insufficient)
    if (
      select count (*)
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
        left join public.education_levels cel on cel.id = c.education_level_id
       where c.settlement_id = p_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
         and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
         and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
         and (
           v_required_education_level_id is null
           or (cel.rank is not null and cel.rank >= v_required_education_rank)
         )
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
          left join public.education_levels cel on cel.id = c.education_level_id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
           and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
           and (
             v_required_education_level_id is null
             or (cel.rank is not null and cel.rank >= v_required_education_rank)
           )
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
          left join public.education_levels cel on cel.id = c.education_level_id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
           and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
           and (
             v_required_education_level_id is null
             or (cel.rank is not null and cel.rank >= v_required_education_rank)
           )
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

drop function public.get_settlement_standard_job_counts (uuid);

create function public.get_settlement_standard_job_counts (p_settlement_id uuid) returns table (
  job_id uuid,
  job_name text,
  job_slug text,
  world_id uuid,
  current_count integer,
  capacity integer,
  required_education_level_id uuid,
  required_education_level_name text,
  qualified_citizen_count integer
) language plpgsql stable security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  select n.world_id
    into v_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.current_user_has_world_access (v_world_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    j.id    as job_id,
    j.name  as job_name,
    j.slug  as job_slug,
    n.world_id,
    case
      when j.job_type = 'construction' then
        coalesce(
          (
            select count (*)::integer
            from   public.citizen_assignments ca
            join   public.citizens c on c.id = ca.citizen_id
            where  ca.assignment_type = 'construction_project'
              and  c.settlement_id    = p_settlement_id
              and  c.status           = 'alive'
          ),
          0
        )
      else
        coalesce(
          (
            select count (*)::integer
            from   public.citizen_assignments ca
            join   public.citizens c on c.id = ca.citizen_id
            where  ca.job_id          = j.id
              and  ca.assignment_type = 'standard_job'
              and  c.settlement_id    = p_settlement_id
              and  c.status           = 'alive'
          ),
          0
        )
    end as current_count,
    public.settlement_job_capacity (p_settlement_id, j.id) as capacity,
    j.required_education_level_id,
    rel.name as required_education_level_name,
    coalesce(
      (
        select count (*)::integer
        from   public.citizens c
        left join public.education_levels cel on cel.id = c.education_level_id
        where  c.settlement_id  = p_settlement_id
          and  c.status         = 'alive'
          and  c.citizen_type   = 'npc'
          and  not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
          and  (
            j.required_education_level_id is null
            or (cel.rank is not null and cel.rank >= rel.rank)
          )
      ),
      0
    ) as qualified_citizen_count
  from   public.job_definitions j
  join   public.settlements s on s.id  = p_settlement_id
  join   public.nations     n on n.id  = s.nation_id
  left join public.education_levels rel on rel.id = j.required_education_level_id
  where  j.world_id   = n.world_id
    and  j.job_type   in ('standard', 'construction', 'teacher')
    and  j.is_trashed = false
  order by j.name, j.id;
end;
$$;

revoke all on function public.get_settlement_standard_job_counts (uuid)
from
  public;

grant
execute on function public.get_settlement_standard_job_counts (uuid) to authenticated;
