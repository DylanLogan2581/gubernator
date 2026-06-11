-- pgTAP tests for public.citizen_assignments RLS and target-shape constraints.
-- Run with: npx supabase test db
--
-- Focus:
--   • citizen_assignments_target_shape_check requires exactly one target
--     column populated per assignment_type, and standard_job uses job_id.
--   • Read visibility mirrors public.citizens (via the existing subquery).
--   • Write access is admin-only in Epic 3.
begin;

select
  plan (14);

-- ---------------------------------------------------------------------------
-- Fixtures
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
    'd1000000-0000-0000-0000-000000000001',
    'assignments-owner@example.com',
    'x',
    now(),
    '{"username":"assignments_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'assignments-unrelated@example.com',
    'x',
    now(),
    '{"username":"assignments_unrelated"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'Assignments World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'd3000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Assignments Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd4000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000001',
    'Assignments Settlement'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status
  )
values
  (
    'd5000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000001',
    'npc',
    'Assignment Target',
    'alive'
  ),
  (
    'd5000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000001',
    'npc',
    'Second Assignment Target',
    'alive'
  );

-- job_definitions fixture: used for standard_job assignment tests.
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'd6000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Assignments Test Job',
    'assignments-test-job',
    'standard',
    10
  );

-- building_blueprint + tier + construction_project fixtures: used for the
-- world-admin construction_project assignment test.
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'd7000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Assignments Blueprint',
    'assignments-blueprint'
  );

insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    worker_turns_required
  )
values
  (
    'd8000000-0000-0000-0000-000000000001',
    'd7000000-0000-0000-0000-000000000001',
    1,
    0
  );

insert into
  public.construction_projects (
    id,
    settlement_id,
    building_blueprint_id,
    target_tier_id,
    status,
    queue_position
  )
values
  (
    'd9000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000001',
    'd7000000-0000-0000-0000-000000000001',
    'd8000000-0000-0000-0000-000000000001',
    'queued',
    1
  );

-- ===========================================================================
-- TARGET SHAPE: each assignment_type requires its dedicated target column.
-- These run as the migration owner so they exercise the table constraint,
-- not RLS.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, assigned_on_turn_number
    ) values (
      'd5000000-0000-0000-0000-000000000001', 'standard_job', 1
    )
  $test$,
    '23514',
    null,
    'standard_job requires job_id'
  );

select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, job_id, construction_project_id, assigned_on_turn_number
    ) values (
      'd5000000-0000-0000-0000-000000000001',
      'standard_job',
      'd6000000-0000-0000-0000-000000000001',
      'd9000000-0000-0000-0000-000000000001',
      1
    )
  $test$,
    '23514',
    null,
    'standard_job rejects construction_project_id'
  );

select
  lives_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, assigned_on_turn_number
    ) values (
      'd5000000-0000-0000-0000-000000000001', 'construction_project', 1
    )
  $test$,
    'construction_project pool assignment (null construction_project_id) is valid'
  );

-- Remove the pool row so subsequent tests can insert a standard_job for the
-- same citizen without hitting the primary-key constraint.
delete from public.citizen_assignments
where
  citizen_id = 'd5000000-0000-0000-0000-000000000001';

select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, assigned_on_turn_number
    ) values (
      'd5000000-0000-0000-0000-000000000001', 'deposit', 1
    )
  $test$,
    '23514',
    null,
    'deposit requires deposit_instance_id'
  );

select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, assigned_on_turn_number
    ) values (
      'd5000000-0000-0000-0000-000000000001', 'husbandry', 1
    )
  $test$,
    '23514',
    null,
    'husbandry requires managed_population_instance_id'
  );

select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, assigned_on_turn_number
    ) values (
      'd5000000-0000-0000-0000-000000000001', 'culling', 1
    )
  $test$,
    '23514',
    null,
    'culling requires managed_population_instance_id'
  );

select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, assigned_on_turn_number
    ) values (
      'd5000000-0000-0000-0000-000000000001', 'trade_route', 1
    )
  $test$,
    '23514',
    null,
    'trade_route requires trade_route_id'
  );

-- A valid standard_job insert succeeds so a subsequent test can update it
-- to a different assignment_type and confirm the constraint also fires on
-- update.
select
  lives_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, job_id, assigned_on_turn_number
    ) values (
      'd5000000-0000-0000-0000-000000000001',
      'standard_job',
      'd6000000-0000-0000-0000-000000000001',
      1
    )
  $test$,
    'standard_job with only job_id is a valid assignment shape'
  );

select
  throws_ok (
    $test$
    update public.citizen_assignments
    set assignment_type = 'deposit', job_id = null
    where citizen_id = 'd5000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'switching assignment_type without populating the matching target column is rejected'
  );

-- ===========================================================================
-- RLS: writes are admin-only; non-admins cannot insert an assignment even
-- against a citizen they can read.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, job_id, assigned_on_turn_number
    ) values (
      'd5000000-0000-0000-0000-000000000002',
      'standard_job',
      'd6000000-0000-0000-0000-000000000001',
      1
    )
  $test$,
    '42501',
    null,
    'non-admin authenticated user cannot insert assignments'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments
      where
        citizen_id = 'd5000000-0000-0000-0000-000000000001'
    ),
    0,
    'non-admin without visibility into the citizen reads no assignments'
  );

reset role;

-- ===========================================================================
-- RLS: world owner (effective world admin) can write assignments and read
-- them through the citizen visibility chain.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, construction_project_id, assigned_on_turn_number
    ) values (
      'd5000000-0000-0000-0000-000000000002',
      'construction_project',
      'd9000000-0000-0000-0000-000000000001',
      1
    )
  $test$,
    'world admin can insert a construction_project assignment'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments
      where
        citizen_id in (
          'd5000000-0000-0000-0000-000000000001',
          'd5000000-0000-0000-0000-000000000002'
        )
    ),
    2,
    'world admin can read assignments mirroring citizen visibility'
  );

select
  lives_ok (
    $test$
    delete from public.citizen_assignments
    where citizen_id = 'd5000000-0000-0000-0000-000000000002'
  $test$,
    'world admin can delete an assignment'
  );

reset role;

select
  *
from
  finish ();

rollback;
