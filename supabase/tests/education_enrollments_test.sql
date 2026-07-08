-- pgTAP tests for public.education_enrollments, public.enroll_citizen,
-- public.unenroll_citizen (#1103): guards (capacity, wrong settlement, dead,
-- double-enroll, nothing-left-to-learn), RLS, and exclusion of enrolled
-- citizens from set_bulk_standard_job_assignment's NPC picking pool.
-- Run with: npx supabase test db
begin;

select
  plan (14);

-- ---------------------------------------------------------------------------
-- Fixtures
--   ee1xxxxx = auth.users     ee2xxxxx = worlds
--   ee3xxxxx = nations        ee4xxxxx = settlements
--   ee5xxxxx = building_blueprints  ee6xxxxx = building_blueprint_tiers
--   ee7xxxxx = settlement_buildings ee8xxxxx = education_levels
--   ee9xxxxx = citizens        eea0xxxx = job_definitions
-- ---------------------------------------------------------------------------
insert into
  auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  )
values
  (
    'ee100000-0000-0000-0000-000000000001',
    'ee-admin@example.com',
    'x',
    now(),
    '{"username":"ee_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'ee100000-0000-0000-0000-000000000002',
    'ee-outsider@example.com',
    'x',
    now(),
    '{"username":"ee_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, current_turn_number)
values
  (
    'ee200000-0000-0000-0000-000000000001',
    'Enrollments World',
    'private',
    'active',
    7
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ee200000-0000-0000-0000-000000000001',
    'ee100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ee300000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'Enrollments Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ee400000-0000-0000-0000-000000000001',
    'ee300000-0000-0000-0000-000000000001',
    'Enrollments Settlement'
  ),
  (
    'ee400000-0000-0000-0000-000000000002',
    'ee300000-0000-0000-0000-000000000001',
    'Enrollments Other Settlement'
  );

insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'ee500000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'Schoolhouse',
    'ee-schoolhouse'
  ),
  (
    'ee500000-0000-0000-0000-000000000002',
    'ee200000-0000-0000-0000-000000000001',
    'Barracks',
    'ee-barracks'
  );

insert into
  public.education_levels (id, world_id, name, rank)
values
  (
    'ee800000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'Basic',
    1
  ),
  (
    'ee800000-0000-0000-0000-000000000002',
    'ee200000-0000-0000-0000-000000000001',
    'Skilled',
    2
  );

-- Tier 1: school, capacity 1, teaches up to Basic (rank 1).
-- Tier 2: not a school (null config) -- used by the non-school building.
insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    education_config_json
  )
values
  (
    'ee600000-0000-0000-0000-000000000001',
    'ee500000-0000-0000-0000-000000000001',
    1,
    (
      '{"teaches_up_to_level_id": "ee800000-0000-0000-0000-000000000001", "student_capacity": 1, "turns_per_level": 4, "teacher_job_id": "00000000-0000-0000-0000-000000000000", "students_per_teacher": 5}'
    )::jsonb
  ),
  (
    'ee600000-0000-0000-0000-000000000002',
    'ee500000-0000-0000-0000-000000000002',
    1,
    null
  );

insert into
  public.settlement_buildings (
    id,
    settlement_id,
    building_blueprint_id,
    current_tier_id,
    state,
    activated_on_turn_number
  )
values
  (
    'ee700000-0000-0000-0000-000000000001',
    'ee400000-0000-0000-0000-000000000001',
    'ee500000-0000-0000-0000-000000000001',
    'ee600000-0000-0000-0000-000000000001',
    'active',
    1
  ),
  (
    'ee700000-0000-0000-0000-000000000002',
    'ee400000-0000-0000-0000-000000000001',
    'ee500000-0000-0000-0000-000000000002',
    'ee600000-0000-0000-0000-000000000002',
    'active',
    1
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    education_level_id,
    death_cause_category
  )
values
  (
    'ee900000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'ee400000-0000-0000-0000-000000000001',
    'npc',
    'Student One',
    'alive',
    null,
    null
  ),
  (
    'ee900000-0000-0000-0000-000000000002',
    'ee200000-0000-0000-0000-000000000001',
    'ee400000-0000-0000-0000-000000000002',
    'npc',
    'Wrong Settlement',
    'alive',
    null,
    null
  ),
  (
    'ee900000-0000-0000-0000-000000000003',
    'ee200000-0000-0000-0000-000000000001',
    'ee400000-0000-0000-0000-000000000001',
    'npc',
    'Dead Student',
    'dead',
    null,
    'unknown'
  ),
  (
    'ee900000-0000-0000-0000-000000000004',
    'ee200000-0000-0000-0000-000000000001',
    'ee400000-0000-0000-0000-000000000001',
    'npc',
    'Already Skilled',
    'alive',
    'ee800000-0000-0000-0000-000000000002',
    null
  ),
  (
    'ee900000-0000-0000-0000-000000000005',
    'ee200000-0000-0000-0000-000000000001',
    'ee400000-0000-0000-0000-000000000001',
    'npc',
    'Capacity Filler',
    'alive',
    null,
    null
  ),
  (
    'ee900000-0000-0000-0000-000000000006',
    'ee200000-0000-0000-0000-000000000001',
    'ee400000-0000-0000-0000-000000000001',
    'npc',
    'Available Worker',
    'alive',
    null,
    null
  );

insert into
  public.job_definitions (
    id,
    world_id,
    name,
    slug,
    job_type,
    base_capacity,
    is_trashed
  )
values
  (
    'eea00000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'Enrollments Farming',
    'ee-farming',
    'standard',
    5,
    false
  );

-- Pre-assign Already Skilled and Capacity Filler to the job so they are
-- absent from the "unassigned NPC" pool from the start -- they exist only to
-- exercise enroll_citizen guards (rank ceiling, capacity) and must not
-- contaminate the later bulk-assignment exclusion test.
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    job_id,
    assigned_on_turn_number
  )
values
  (
    'ee900000-0000-0000-0000-000000000004',
    'standard_job',
    'eea00000-0000-0000-0000-000000000001',
    1
  ),
  (
    'ee900000-0000-0000-0000-000000000005',
    'standard_job',
    'eea00000-0000-0000-0000-000000000001',
    1
  );

-- ===========================================================================
-- enroll_citizen: wrong settlement is rejected.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ee100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.enroll_citizen(
      'ee700000-0000-0000-0000-000000000001'::uuid,
      'ee900000-0000-0000-0000-000000000002'::uuid
    )
  $test$,
    'P0001',
    'citizen does not belong to this settlement',
    'a citizen from a different settlement cannot be enrolled'
  );

-- ===========================================================================
-- enroll_citizen: dead citizen is rejected.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.enroll_citizen(
      'ee700000-0000-0000-0000-000000000001'::uuid,
      'ee900000-0000-0000-0000-000000000003'::uuid
    )
  $test$,
    'P0001',
    'citizen is not alive',
    'a dead citizen cannot be enrolled'
  );

-- ===========================================================================
-- enroll_citizen: building that is not a school is rejected.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.enroll_citizen(
      'ee700000-0000-0000-0000-000000000002'::uuid,
      'ee900000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    'P0001',
    'settlement building is not configured as a school',
    'enrolling into a non-school building is rejected'
  );

-- ===========================================================================
-- enroll_citizen: citizen already at/above the tier's teaches_up_to level is
-- rejected with the "nothing left to learn" message.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.enroll_citizen(
      'ee700000-0000-0000-0000-000000000001'::uuid,
      'ee900000-0000-0000-0000-000000000004'::uuid
    )
  $test$,
    'P0001',
    'Nothing left to learn here',
    'a citizen already at or above the tier ceiling cannot be enrolled'
  );

-- ===========================================================================
-- enroll_citizen: successful enrollment fills the one seat of capacity.
-- ===========================================================================
select
  public.enroll_citizen (
    'ee700000-0000-0000-0000-000000000001'::uuid,
    'ee900000-0000-0000-0000-000000000001'::uuid
  );

select
  is (
    (
      select
        target_level_id
      from
        public.education_enrollments
      where
        citizen_id = 'ee900000-0000-0000-0000-000000000001'
    ),
    'ee800000-0000-0000-0000-000000000001'::uuid,
    'enrolling an uneducated citizen targets the lowest level (Basic)'
  );

-- ===========================================================================
-- enroll_citizen: double-enroll is rejected.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.enroll_citizen(
      'ee700000-0000-0000-0000-000000000001'::uuid,
      'ee900000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    'P0001',
    'citizen is already enrolled in a school',
    'a citizen already enrolled cannot be enrolled again'
  );

-- ===========================================================================
-- enroll_citizen: capacity guard rejects once the tier's student_capacity
-- (1) is filled.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.enroll_citizen(
      'ee700000-0000-0000-0000-000000000001'::uuid,
      'ee900000-0000-0000-0000-000000000005'::uuid
    )
  $test$,
    'P0001',
    'settlement building is at student capacity',
    'enrollment is rejected once the school is at student capacity'
  );

reset role;

-- ===========================================================================
-- RLS: SELECT is available to world members, denied to outsiders.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ee100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.education_enrollments
      where
        settlement_building_id = 'ee700000-0000-0000-0000-000000000001'
    ),
    1,
    'a world member can select education_enrollments rows'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ee100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.education_enrollments
      where
        settlement_building_id = 'ee700000-0000-0000-0000-000000000001'
    ),
    0,
    'an outsider with no world access cannot select education_enrollments rows'
  );

reset role;

-- ===========================================================================
-- Enrolled citizens are excluded from set_bulk_standard_job_assignment's
-- unassigned-NPC picking pool. Already Skilled and Capacity Filler are
-- pre-assigned (current count = 2); Student One is enrolled (excluded);
-- the only remaining eligible NPC is Available Worker. Raising to 4
-- (delta 2, only 1 eligible) must fail; raising to 3 (delta 1) must succeed
-- and pick Available Worker.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ee100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_bulk_standard_job_assignment(
      'ee400000-0000-0000-0000-000000000001'::uuid,
      'eea00000-0000-0000-0000-000000000001'::uuid,
      4
    )
  $test$,
    'P0001',
    'insufficient unassigned NPCs available',
    'an enrolled citizen is not counted among unassigned NPCs by the bulk job assignment RPC'
  );

select
  public.set_bulk_standard_job_assignment (
    'ee400000-0000-0000-0000-000000000001'::uuid,
    'eea00000-0000-0000-0000-000000000001'::uuid,
    3
  );

select
  is (
    (
      select
        added_citizen_ids[1]
      from
        public.set_bulk_standard_job_assignment (
          'ee400000-0000-0000-0000-000000000001'::uuid,
          'eea00000-0000-0000-0000-000000000001'::uuid,
          3
        )
    ),
    null::uuid,
    'a second call at the same target count is a no-op (already at 3)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.citizen_id = 'ee900000-0000-0000-0000-000000000006'
        and ca.assignment_type = 'standard_job'
    ),
    1,
    'the bulk job assignment RPC picked the sole eligible (unenrolled) NPC'
  );

reset role;

-- ===========================================================================
-- unenroll_citizen: authority guard, then deletes the row (progress lost).
-- The enrollment id is captured as the superuser session (bypassing RLS)
-- into a GUC so the outsider role in the next block can pass a real id to
-- the authority check, mirroring nation_offices_test's dismiss pattern.
-- ===========================================================================
select
  set_config(
    'gubernator.test_enrollment_id',
    (
      select
        id::text
      from
        public.education_enrollments
      where
        citizen_id = 'ee900000-0000-0000-0000-000000000001'
    ),
    false
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ee100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.unenroll_citizen(
      current_setting('gubernator.test_enrollment_id')::uuid
    )
  $test$,
    '42501',
    null,
    'a user with no authority over the settlement cannot unenroll a citizen'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ee100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  public.unenroll_citizen (
    current_setting('gubernator.test_enrollment_id')::uuid
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.education_enrollments
      where
        citizen_id = 'ee900000-0000-0000-0000-000000000001'
    ),
    0,
    'unenroll_citizen removes the enrollment row'
  );

select
  *
from
  finish ();

rollback;
