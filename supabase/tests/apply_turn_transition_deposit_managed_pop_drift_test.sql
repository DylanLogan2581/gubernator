-- pgTAP tests for §H10a & §H10b: apply_turn_transition deposit & managed-pop
-- currentCountBefore re-validation (issue #670).
--
-- Simulates concurrent drift by manually updating deposit resource quantities
-- or managed-population counts between transition creation and RPC call,
-- verifying that a mismatch raises P0001 hint=state_drifted.
--
-- Run with: npx supabase test db
--
-- UUID prefix map (all f3-prefixed ranges, unique to this file):
--   f3100000 = users              f3200000 = worlds
--   f3300000 = transitions        f3400000 = nations
--   f3500000 = settlements        f3600000 = resources
--   f3700000 = deposit_instances  f3800000 = managed_population_instances
begin;

select
  plan (8);

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
    'f3100000-0000-0000-0000-000000000001',
    'atdmpd-superadmin@example.com',
    'x',
    now(),
    '{"username":"atdmpd_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'f3100000-0000-0000-0000-000000000001';

-- World 1: deposit drift scenario
-- World 2: deposit clean scenario
-- World 3: managed-pop drift scenario
-- World 4: managed-pop clean scenario
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'f3200000-0000-0000-0000-000000000001',
    'ATDMPD Deposit Drift World',
    3,
    'private',
    'active'
  ),
  (
    'f3200000-0000-0000-0000-000000000002',
    'ATDMPD Deposit Clean World',
    3,
    'private',
    'active'
  ),
  (
    'f3200000-0000-0000-0000-000000000003',
    'ATDMPD ManagedPop Drift World',
    3,
    'private',
    'active'
  ),
  (
    'f3200000-0000-0000-0000-000000000004',
    'ATDMPD ManagedPop Clean World',
    3,
    'private',
    'active'
  );

-- One nation per world
insert into
  public.nations (id, world_id, name)
values
  (
    'f3400000-0000-0000-0000-000000000001',
    'f3200000-0000-0000-0000-000000000001',
    'ATDMPD Nation 1'
  ),
  (
    'f3400000-0000-0000-0000-000000000002',
    'f3200000-0000-0000-0000-000000000002',
    'ATDMPD Nation 2'
  ),
  (
    'f3400000-0000-0000-0000-000000000003',
    'f3200000-0000-0000-0000-000000000003',
    'ATDMPD Nation 3'
  ),
  (
    'f3400000-0000-0000-0000-000000000004',
    'f3200000-0000-0000-0000-000000000004',
    'ATDMPD Nation 4'
  );

-- One settlement per world
insert into
  public.settlements (id, nation_id, name)
values
  (
    'f3500000-0000-0000-0000-000000000001',
    'f3400000-0000-0000-0000-000000000001',
    'ATDMPD Settlement 1'
  ),
  (
    'f3500000-0000-0000-0000-000000000002',
    'f3400000-0000-0000-0000-000000000002',
    'ATDMPD Settlement 2'
  ),
  (
    'f3500000-0000-0000-0000-000000000003',
    'f3400000-0000-0000-0000-000000000003',
    'ATDMPD Settlement 3'
  ),
  (
    'f3500000-0000-0000-0000-000000000004',
    'f3400000-0000-0000-0000-000000000004',
    'ATDMPD Settlement 4'
  );

-- Resources
insert into
  public.resources (id, world_id, name, slug, base_stockpile_cap)
values
  (
    'f3600000-0000-0000-0000-000000000001',
    'f3200000-0000-0000-0000-000000000001',
    'ATDMPD Wood',
    'atdmpd-wood',
    1000
  ),
  (
    'f3600000-0000-0000-0000-000000000002',
    'f3200000-0000-0000-0000-000000000002',
    'ATDMPD Stone',
    'atdmpd-stone',
    1000
  ),
  (
    'f3600000-0000-0000-0000-000000000003',
    'f3200000-0000-0000-0000-000000000003',
    'ATDMPD Iron',
    'atdmpd-iron',
    1000
  ),
  (
    'f3600000-0000-0000-0000-000000000004',
    'f3200000-0000-0000-0000-000000000004',
    'ATDMPD Gold',
    'atdmpd-gold',
    1000
  );

-- Job definitions for deposits
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'f3700000-0000-0000-0000-000000000020',
    'f3200000-0000-0000-0000-000000000001',
    'ATDMPD Forestry',
    'atdmpd-forestry',
    'standard',
    10
  ),
  (
    'f3700000-0000-0000-0000-000000000021',
    'f3200000-0000-0000-0000-000000000002',
    'ATDMPD Quarrying',
    'atdmpd-quarrying',
    'standard',
    10
  ),
  (
    'f3700000-0000-0000-0000-000000000022',
    'f3200000-0000-0000-0000-000000000003',
    'ATDMPD Mining',
    'atdmpd-mining',
    'standard',
    10
  ),
  (
    'f3700000-0000-0000-0000-000000000023',
    'f3200000-0000-0000-0000-000000000004',
    'ATDMPD Vaulting',
    'atdmpd-vaulting',
    'standard',
    10
  );

-- Deposit types
insert into
  public.deposit_types (
    id,
    world_id,
    name,
    slug,
    job_id,
    worker_inputs_json,
    output_units_per_worker
  )
values
  (
    'f3700000-0000-0000-0000-000000000001',
    'f3200000-0000-0000-0000-000000000001',
    'ATDMPD Forest',
    'atdmpd-forest',
    'f3700000-0000-0000-0000-000000000020',
    '[]'::jsonb,
    1
  ),
  (
    'f3700000-0000-0000-0000-000000000002',
    'f3200000-0000-0000-0000-000000000002',
    'ATDMPD Quarry',
    'atdmpd-quarry',
    'f3700000-0000-0000-0000-000000000021',
    '[]'::jsonb,
    1
  ),
  (
    'f3700000-0000-0000-0000-000000000003',
    'f3200000-0000-0000-0000-000000000003',
    'ATDMPD Mine',
    'atdmpd-mine',
    'f3700000-0000-0000-0000-000000000022',
    '[]'::jsonb,
    1
  ),
  (
    'f3700000-0000-0000-0000-000000000004',
    'f3200000-0000-0000-0000-000000000004',
    'ATDMPD Vault',
    'atdmpd-vault',
    'f3700000-0000-0000-0000-000000000023',
    '[]'::jsonb,
    1
  );

-- Job definitions for managed population types (husbandry and culling)
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'f3700000-0000-0000-0000-000000000010',
    'f3200000-0000-0000-0000-000000000003',
    'ATDMPD Soldier Husbandry',
    'atdmpd-soldier-husbandry',
    'husbandry'
  ),
  (
    'f3700000-0000-0000-0000-000000000011',
    'f3200000-0000-0000-0000-000000000003',
    'ATDMPD Soldier Culling',
    'atdmpd-soldier-culling',
    'culling'
  ),
  (
    'f3700000-0000-0000-0000-000000000012',
    'f3200000-0000-0000-0000-000000000004',
    'ATDMPD Cleric Husbandry',
    'atdmpd-cleric-husbandry',
    'husbandry'
  ),
  (
    'f3700000-0000-0000-0000-000000000013',
    'f3200000-0000-0000-0000-000000000004',
    'ATDMPD Cleric Culling',
    'atdmpd-cleric-culling',
    'culling'
  );

-- Managed population types
insert into
  public.managed_population_types (
    id,
    world_id,
    name,
    slug,
    husbandry_job_id,
    culling_job_id,
    husbandry_workers_per_n_animals,
    growth_rate
  )
values
  (
    'f3800000-0000-0000-0000-000000000001',
    'f3200000-0000-0000-0000-000000000003',
    'ATDMPD Soldiers',
    'atdmpd-soldiers',
    'f3700000-0000-0000-0000-000000000010',
    'f3700000-0000-0000-0000-000000000011',
    1,
    0.05
  ),
  (
    'f3800000-0000-0000-0000-000000000002',
    'f3200000-0000-0000-0000-000000000004',
    'ATDMPD Clerics',
    'atdmpd-clerics',
    'f3700000-0000-0000-0000-000000000012',
    'f3700000-0000-0000-0000-000000000013',
    1,
    0.05
  );

-- Deposit instances for worlds 1 & 2
insert into
  public.deposit_instances (id, settlement_id, deposit_type_id, name, status)
values
  (
    'f3700000-0000-0000-0000-000000000001',
    'f3500000-0000-0000-0000-000000000001',
    'f3700000-0000-0000-0000-000000000001',
    'ATDMPD Forest 1',
    'active'
  ),
  (
    'f3700000-0000-0000-0000-000000000002',
    'f3500000-0000-0000-0000-000000000002',
    'f3700000-0000-0000-0000-000000000002',
    'ATDMPD Quarry 1',
    'active'
  );

-- Deposit instance resources (each deposit has one resource: wood or stone)
insert into
  public.deposit_instance_resources (
    id,
    deposit_instance_id,
    resource_id,
    initial_quantity,
    remaining_quantity
  )
values
  (
    'f3700000-0000-0000-0000-000000000011',
    'f3700000-0000-0000-0000-000000000001',
    'f3600000-0000-0000-0000-000000000001',
    100,
    100
  ),
  (
    'f3700000-0000-0000-0000-000000000012',
    'f3700000-0000-0000-0000-000000000002',
    'f3600000-0000-0000-0000-000000000002',
    100,
    100
  );

-- Managed population instances for worlds 3 & 4
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
    'f3800000-0000-0000-0000-000000000001',
    'f3500000-0000-0000-0000-000000000003',
    'f3800000-0000-0000-0000-000000000001',
    'ATDMPD Soldiers 1',
    50,
    'active'
  ),
  (
    'f3800000-0000-0000-0000-000000000002',
    'f3500000-0000-0000-0000-000000000004',
    'f3800000-0000-0000-0000-000000000002',
    'ATDMPD Clerics 1',
    50,
    'active'
  );

-- Pre-created running transitions
insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status
  )
values
  (
    'f3300000-0000-0000-0000-000000000001',
    'f3200000-0000-0000-0000-000000000001',
    3,
    4,
    'f3100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'f3300000-0000-0000-0000-000000000002',
    'f3200000-0000-0000-0000-000000000002',
    3,
    4,
    'f3100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'f3300000-0000-0000-0000-000000000003',
    'f3200000-0000-0000-0000-000000000003',
    3,
    4,
    'f3100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'f3300000-0000-0000-0000-000000000004',
    'f3200000-0000-0000-0000-000000000004',
    3,
    4,
    'f3100000-0000-0000-0000-000000000001',
    'running'
  );

-- ---------------------------------------------------------------------------
-- Simulate concurrent drift: admin mutates deposit between state-load and RPC
-- ---------------------------------------------------------------------------
update public.deposit_instance_resources
set
  remaining_quantity = 75
where
  deposit_instance_id = 'f3700000-0000-0000-0000-000000000001'
  and resource_id = 'f3600000-0000-0000-0000-000000000001';

-- Simulate concurrent drift: admin mutates managed-pop between state-load and RPC
update public.managed_population_instances
set
  current_count = 75
where
  id = 'f3800000-0000-0000-0000-000000000001';

-- ===========================================================================
-- All tests run as service_role
-- ===========================================================================
set
  local role service_role;

-- ===========================================================================
-- TEST 1: deposit drift detected — payload claims remainingQuantityBefore = 100
-- but live value is 75
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'f3200000-0000-0000-0000-000000000001',
      3,
      jsonb_build_object(
        'depositUpdates',
        jsonb_build_array(
          jsonb_build_object(
            'depositInstanceId', 'f3700000-0000-0000-0000-000000000001',
            'toStatus', null,
            'resourceDeltas',
            jsonb_build_array(
              jsonb_build_object(
                'resourceId', 'f3600000-0000-0000-0000-000000000001',
                'delta', -5,
                'remainingQuantityBefore', 100
              )
            )
          )
        )
      ),
      'f3300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'deposit drift detected: stale remainingQuantityBefore raises P0001'
  );

-- ===========================================================================
-- TEST 2: transition status remains 'running' after deposit drift rejection
-- ===========================================================================
select
  is (
    (
      select
        status
      from
        public.turn_transitions
      where
        id = 'f3300000-0000-0000-0000-000000000001'
    ),
    'running',
    'deposit drift rejection: transition status remains running (not failed)'
  );

-- ===========================================================================
-- TEST 3: deposit resource not overwritten after drift rejection
-- ===========================================================================
select
  is (
    (
      select
        remaining_quantity
      from
        public.deposit_instance_resources
      where
        deposit_instance_id = 'f3700000-0000-0000-0000-000000000001'
        and resource_id = 'f3600000-0000-0000-0000-000000000001'
    ),
    75::numeric(18, 4),
    'deposit drift rejection: remaining_quantity unchanged (concurrent change preserved)'
  );

-- ===========================================================================
-- TEST 4: no deposit drift — payload remainingQuantityBefore matches live value;
-- succeeds. World 2 deposit resource starts at 100 and payload claims 100.
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.apply_turn_transition(
      'f3200000-0000-0000-0000-000000000002',
      3,
      jsonb_build_object(
        'depositUpdates',
        jsonb_build_array(
          jsonb_build_object(
            'depositInstanceId', 'f3700000-0000-0000-0000-000000000002',
            'toStatus', null,
            'resourceDeltas',
            jsonb_build_array(
              jsonb_build_object(
                'resourceId', 'f3600000-0000-0000-0000-000000000002',
                'delta', 10,
                'remainingQuantityBefore', 100
              )
            )
          )
        )
      ),
      'f3300000-0000-0000-0000-000000000002'::uuid
    )
    $test$,
    'no deposit drift: matching remainingQuantityBefore raises no exception'
  );

-- ===========================================================================
-- TEST 5: managed-pop drift detected — payload claims currentCountBefore = 50
-- but live value is 75
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'f3200000-0000-0000-0000-000000000003',
      3,
      jsonb_build_object(
        'managedPopulationUpdates',
        jsonb_build_array(
          jsonb_build_object(
            'managedPopulationInstanceId', 'f3800000-0000-0000-0000-000000000001',
            'countDelta', 10,
            'toStatus', null,
            'currentCountBefore', 50
          )
        )
      ),
      'f3300000-0000-0000-0000-000000000003'::uuid
    )
    $test$,
    'P0001',
    null,
    'managed-pop drift detected: stale currentCountBefore raises P0001'
  );

-- ===========================================================================
-- TEST 6: transition status remains 'running' after managed-pop drift rejection
-- ===========================================================================
select
  is (
    (
      select
        status
      from
        public.turn_transitions
      where
        id = 'f3300000-0000-0000-0000-000000000003'
    ),
    'running',
    'managed-pop drift rejection: transition status remains running (not failed)'
  );

-- ===========================================================================
-- TEST 7: managed-pop current_count not overwritten after drift rejection
-- ===========================================================================
select
  is (
    (
      select
        current_count
      from
        public.managed_population_instances
      where
        id = 'f3800000-0000-0000-0000-000000000001'
    ),
    75::numeric(18, 4),
    'managed-pop drift rejection: current_count unchanged (concurrent change preserved)'
  );

-- ===========================================================================
-- TEST 8: no managed-pop drift — payload currentCountBefore matches live value;
-- succeeds. World 4 managed-pop starts at 50 and payload claims 50.
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.apply_turn_transition(
      'f3200000-0000-0000-0000-000000000004',
      3,
      jsonb_build_object(
        'managedPopulationUpdates',
        jsonb_build_array(
          jsonb_build_object(
            'managedPopulationInstanceId', 'f3800000-0000-0000-0000-000000000002',
            'countDelta', 5,
            'toStatus', null,
            'currentCountBefore', 50
          )
        )
      ),
      'f3300000-0000-0000-0000-000000000004'::uuid
    )
    $test$,
    'no managed-pop drift: matching currentCountBefore raises no exception'
  );

reset role;

rollback;
