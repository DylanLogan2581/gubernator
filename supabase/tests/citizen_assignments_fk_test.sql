-- pgTAP tests for public.citizen_assignments foreign key constraints and the
-- trade_route_end trigger. Run with: npx supabase test db
--
-- Focus:
--   • Each FK column rejects a non-existent target.
--   • job_definitions ON DELETE RESTRICT prevents deleting a referenced job.
--   • construction_projects, deposit_instances, managed_population_instances,
--     trade_routes ON DELETE CASCADE removes the dependent assignment.
--   • trade_route_end is required when assignment_type = 'trade_route'.
--   • trade_route_end mismatch (citizen settlement vs route endpoint) rejected.
begin;

select
  plan (21);

-- ---------------------------------------------------------------------------
-- Fixtures (inserted as migration owner; RLS does not apply here)
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
    'e1000000-0000-0000-0000-000000000001',
    'fk-test-owner@example.com',
    'x',
    now(),
    '{"username":"fk_test_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'e1000000-0000-0000-0000-000000000002',
    'FK Test World',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000002',
    'FK Test Nation'
  );

-- Two settlements: origin and destination for trade_route tests.
insert into
  public.settlements (id, nation_id, name)
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'FK Origin Settlement'
  ),
  (
    'e3000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'FK Destination Settlement'
  );

-- Citizen at origin settlement (used for all assignment tests).
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
    'e4000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000002',
    'e3000000-0000-0000-0000-000000000001',
    'npc',
    'FK Test Citizen',
    'alive'
  );

-- Job definition for standard_job tests.
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'e5000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000002',
    'FK Test Job',
    'fk-test-job',
    'standard',
    5
  );

-- Building blueprint + tier + construction_project for construction tests.
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'e6000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000002',
    'FK Test Blueprint',
    'fk-test-blueprint'
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
    'e6000000-0000-0000-0000-000000000002',
    'e6000000-0000-0000-0000-000000000001',
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
    'e7000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000002',
    'queued',
    1
  );

-- Deposit type + instance for deposit tests.
-- deposit_types.job_id FK is DEFERRABLE INITIALLY DEFERRED, so any UUID works
-- here; the constraint is never checked because this transaction is rolled back.
insert into
  public.deposit_types (
    id,
    world_id,
    name,
    slug,
    job_id,
    output_units_per_worker
  )
values
  (
    'e8000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000002',
    'FK Test Deposit Type',
    'fk-test-deposit-type',
    'ecffffff-ffff-ffff-ffff-000000000001',
    1
  );

insert into
  public.deposit_instances (id, settlement_id, deposit_type_id, status, name)
values
  (
    'e8000000-0000-0000-0000-000000000002',
    'e3000000-0000-0000-0000-000000000001',
    'e8000000-0000-0000-0000-000000000001',
    'active',
    'FK Test Deposit'
  );

-- Managed population type + instance for husbandry/culling tests.
-- husbandry_job_id and culling_job_id FKs are DEFERRABLE INITIALLY DEFERRED.
-- They must be distinct (immediate CHECK constraint).
insert into
  public.managed_population_types (
    id,
    world_id,
    name,
    slug,
    husbandry_job_id,
    culling_job_id,
    husbandry_workers_per_n_animals
  )
values
  (
    'e9000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000002',
    'FK Test Pop Type',
    'fk-test-pop-type',
    'ecffffff-ffff-ffff-ffff-000000000002',
    'ecffffff-ffff-ffff-ffff-000000000003',
    5
  );

insert into
  public.managed_population_instances (
    id,
    settlement_id,
    managed_population_type_id,
    name,
    current_count,
    status
  )
values
  (
    'e9000000-0000-0000-0000-000000000002',
    'e3000000-0000-0000-0000-000000000001',
    'e9000000-0000-0000-0000-000000000001',
    'FK Test Herd',
    100,
    'active'
  );

-- Resource + trade_route for trade_route tests.
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'ea000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000002',
    'FK Test Resource',
    'fk-test-resource'
  );

insert into
  public.trade_routes (
    id,
    origin_settlement_id,
    destination_settlement_id,
    status,
    proposed_by_citizen_id,
    origin_approval_status,
    destination_approval_status
  )
values
  (
    'eb000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000002',
    'proposed',
    'e4000000-0000-0000-0000-000000000001',
    'pending',
    'pending'
  );

insert into
  public.trade_route_legs (
    trade_route_id,
    direction,
    resource_id,
    quantity_per_transition
  )
values
  (
    'eb000000-0000-0000-0000-000000000001',
    'send',
    'ea000000-0000-0000-0000-000000000001',
    10
  );

-- ===========================================================================
-- FK REJECTION: each FK column rejects a non-existent target id.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, job_id, assigned_on_turn_number
    ) values (
      'e4000000-0000-0000-0000-000000000001',
      'standard_job',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      1
    )
  $test$,
    '23503',
    null,
    'job_id FK rejects non-existent job_definitions row'
  );

select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, construction_project_id, assigned_on_turn_number
    ) values (
      'e4000000-0000-0000-0000-000000000001',
      'construction_project',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      1
    )
  $test$,
    '23503',
    null,
    'construction_project_id FK rejects non-existent construction_projects row'
  );

select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, deposit_instance_id, assigned_on_turn_number
    ) values (
      'e4000000-0000-0000-0000-000000000001',
      'deposit',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      1
    )
  $test$,
    '23503',
    null,
    'deposit_instance_id FK rejects non-existent deposit_instances row'
  );

select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number
    ) values (
      'e4000000-0000-0000-0000-000000000001',
      'husbandry',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      1
    )
  $test$,
    '23503',
    null,
    'managed_population_instance_id FK rejects non-existent managed_population_instances row'
  );

select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, trade_route_id, trade_route_end, assigned_on_turn_number
    ) values (
      'e4000000-0000-0000-0000-000000000001',
      'trade_route',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      'origin',
      1
    )
  $test$,
    '23503',
    null,
    'trade_route_id FK rejects non-existent trade_routes row'
  );

-- ===========================================================================
-- RESTRICT: deleting a job_definitions row that an assignment references fails.
-- ===========================================================================
select
  lives_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, job_id, assigned_on_turn_number
    ) values (
      'e4000000-0000-0000-0000-000000000001',
      'standard_job',
      'e5000000-0000-0000-0000-000000000001',
      1
    )
  $test$,
    'valid standard_job assignment referencing job_definitions inserts'
  );

select
  throws_ok (
    $test$
    delete from public.job_definitions
    where id = 'e5000000-0000-0000-0000-000000000001'
  $test$,
    '23503',
    null,
    'deleting a job_definition referenced by an assignment is restricted'
  );

-- Clean up the standard_job assignment before cascade tests.
delete from public.citizen_assignments
where
  citizen_id = 'e4000000-0000-0000-0000-000000000001';

-- ===========================================================================
-- CASCADE: deleting the target row removes the dependent assignment.
-- ===========================================================================
-- construction_project cascade
select
  lives_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, construction_project_id, assigned_on_turn_number
    ) values (
      'e4000000-0000-0000-0000-000000000001',
      'construction_project',
      'e7000000-0000-0000-0000-000000000001',
      1
    )
  $test$,
    'valid construction_project assignment inserts'
  );

select
  lives_ok (
    $test$
    delete from public.construction_projects
    where id = 'e7000000-0000-0000-0000-000000000001'
  $test$,
    'deleting a construction_project cascades'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments
      where
        citizen_id = 'e4000000-0000-0000-0000-000000000001'
    ),
    0,
    'construction_project cascade removed the dependent assignment'
  );

-- deposit_instance cascade
select
  lives_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, deposit_instance_id, assigned_on_turn_number
    ) values (
      'e4000000-0000-0000-0000-000000000001',
      'deposit',
      'e8000000-0000-0000-0000-000000000002',
      1
    )
  $test$,
    'valid deposit assignment inserts'
  );

select
  lives_ok (
    $test$
    delete from public.deposit_instances
    where id = 'e8000000-0000-0000-0000-000000000002'
  $test$,
    'deleting a deposit_instance cascades'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments
      where
        citizen_id = 'e4000000-0000-0000-0000-000000000001'
    ),
    0,
    'deposit_instance cascade removed the dependent assignment'
  );

-- managed_population_instance cascade
select
  lives_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number
    ) values (
      'e4000000-0000-0000-0000-000000000001',
      'husbandry',
      'e9000000-0000-0000-0000-000000000002',
      1
    )
  $test$,
    'valid husbandry assignment inserts'
  );

select
  lives_ok (
    $test$
    delete from public.managed_population_instances
    where id = 'e9000000-0000-0000-0000-000000000002'
  $test$,
    'deleting a managed_population_instance cascades'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments
      where
        citizen_id = 'e4000000-0000-0000-0000-000000000001'
    ),
    0,
    'managed_population_instance cascade removed the dependent assignment'
  );

-- ===========================================================================
-- TRADE_ROUTE_END: required for trade_route assignments; mismatch rejected.
-- ===========================================================================
-- trade_route assignment without trade_route_end fails check constraint.
select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, trade_route_id, assigned_on_turn_number
    ) values (
      'e4000000-0000-0000-0000-000000000001',
      'trade_route',
      'eb000000-0000-0000-0000-000000000001',
      1
    )
  $test$,
    '23514',
    null,
    'trade_route assignment without trade_route_end is rejected'
  );

-- trade_route_end = 'destination' while citizen is at origin is rejected.
select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, trade_route_id, trade_route_end, assigned_on_turn_number
    ) values (
      'e4000000-0000-0000-0000-000000000001',
      'trade_route',
      'eb000000-0000-0000-0000-000000000001',
      'destination',
      1
    )
  $test$,
    '23514',
    null,
    'trade_route_end mismatch between citizen settlement and route endpoint is rejected'
  );

-- trade_route cascade: valid assignment with correct trade_route_end, then
-- delete the route and verify the assignment is removed.
select
  lives_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, trade_route_id, trade_route_end, assigned_on_turn_number
    ) values (
      'e4000000-0000-0000-0000-000000000001',
      'trade_route',
      'eb000000-0000-0000-0000-000000000001',
      'origin',
      1
    )
  $test$,
    'valid trade_route assignment with correct trade_route_end inserts'
  );

select
  lives_ok (
    $test$
    delete from public.trade_routes
    where id = 'eb000000-0000-0000-0000-000000000001'
  $test$,
    'deleting a trade_route cascades'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments
      where
        citizen_id = 'e4000000-0000-0000-0000-000000000001'
    ),
    0,
    'trade_route cascade removed the dependent assignment'
  );

select
  *
from
  finish ();

rollback;
