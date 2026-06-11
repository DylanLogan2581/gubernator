-- pgTAP tests for §C30: apply_turn_transition deposit and managed population patches.
-- Run with: npx supabase test db
--
-- UUID prefix map (all a7-prefixed ranges, unique to this file):
--   a7100000 = users            a7200000 = worlds
--   a7300000 = nations          a7400000 = settlements
--   a7500000 = resources        a7600000 = job_definitions
--   a7700000 = deposit_types    a7800000 = deposit_instances
--   a7900000 = deposit_instance_resources
--   a7a00000 = managed_population_types
--   a7b00000 = managed_population_instances
--   a7c00000 = citizens
begin;

select
  plan (12);

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
    'a7100000-0000-0000-0000-000000000001',
    'attdmp-superadmin@example.com',
    'x',
    now(),
    '{"username":"attdmp_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'a7100000-0000-0000-0000-000000000001';

-- Five worlds — one per scenario, all at turn 3:
--   World 1: deposit extraction decrement (partial, no depletion)
--   World 2: deposit depletion + worker unassignment
--   World 3: managed population growth
--   World 4: managed population decline
--   World 5: managed population extinction + worker unassignment
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'a7200000-0000-0000-0000-000000000001',
    'ATTDMP Extraction World',
    3,
    'private',
    'active'
  ),
  (
    'a7200000-0000-0000-0000-000000000002',
    'ATTDMP Depletion World',
    3,
    'private',
    'active'
  ),
  (
    'a7200000-0000-0000-0000-000000000003',
    'ATTDMP Growth World',
    3,
    'private',
    'active'
  ),
  (
    'a7200000-0000-0000-0000-000000000004',
    'ATTDMP Decline World',
    3,
    'private',
    'active'
  ),
  (
    'a7200000-0000-0000-0000-000000000005',
    'ATTDMP Extinction World',
    3,
    'private',
    'active'
  );

-- One nation per world
insert into
  public.nations (id, world_id, name)
values
  (
    'a7300000-0000-0000-0000-000000000001',
    'a7200000-0000-0000-0000-000000000001',
    'ATTDMP Nation 1'
  ),
  (
    'a7300000-0000-0000-0000-000000000002',
    'a7200000-0000-0000-0000-000000000002',
    'ATTDMP Nation 2'
  ),
  (
    'a7300000-0000-0000-0000-000000000003',
    'a7200000-0000-0000-0000-000000000003',
    'ATTDMP Nation 3'
  ),
  (
    'a7300000-0000-0000-0000-000000000004',
    'a7200000-0000-0000-0000-000000000004',
    'ATTDMP Nation 4'
  ),
  (
    'a7300000-0000-0000-0000-000000000005',
    'a7200000-0000-0000-0000-000000000005',
    'ATTDMP Nation 5'
  );

-- One settlement per world
insert into
  public.settlements (id, nation_id, name)
values
  (
    'a7400000-0000-0000-0000-000000000001',
    'a7300000-0000-0000-0000-000000000001',
    'ATTDMP Settlement 1'
  ),
  (
    'a7400000-0000-0000-0000-000000000002',
    'a7300000-0000-0000-0000-000000000002',
    'ATTDMP Settlement 2'
  ),
  (
    'a7400000-0000-0000-0000-000000000003',
    'a7300000-0000-0000-0000-000000000003',
    'ATTDMP Settlement 3'
  ),
  (
    'a7400000-0000-0000-0000-000000000004',
    'a7300000-0000-0000-0000-000000000004',
    'ATTDMP Settlement 4'
  ),
  (
    'a7400000-0000-0000-0000-000000000005',
    'a7300000-0000-0000-0000-000000000005',
    'ATTDMP Settlement 5'
  );

-- Resources for deposit worlds (1 & 2): one resource per world
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'a7500000-0000-0000-0000-000000000001',
    'a7200000-0000-0000-0000-000000000001',
    'ATTDMP Ore 1',
    'attdmp-ore-1'
  ),
  (
    'a7500000-0000-0000-0000-000000000002',
    'a7200000-0000-0000-0000-000000000002',
    'ATTDMP Ore 2',
    'attdmp-ore-2'
  );

-- job_definitions: deposit jobs for worlds 1 & 2
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'a7600000-0000-0000-0000-000000000001',
    'a7200000-0000-0000-0000-000000000001',
    'ATTDMP Mining 1',
    'attdmp-mining-1',
    'deposit'
  ),
  (
    'a7600000-0000-0000-0000-000000000002',
    'a7200000-0000-0000-0000-000000000002',
    'ATTDMP Mining 2',
    'attdmp-mining-2',
    'deposit'
  );

-- job_definitions: husbandry + culling jobs for worlds 3, 4, 5
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'a7600000-0000-0000-0000-000000000003',
    'a7200000-0000-0000-0000-000000000003',
    'ATTDMP Husbandry 3',
    'attdmp-husbandry-3',
    'husbandry'
  ),
  (
    'a7600000-0000-0000-0000-000000000004',
    'a7200000-0000-0000-0000-000000000003',
    'ATTDMP Culling 3',
    'attdmp-culling-3',
    'culling'
  ),
  (
    'a7600000-0000-0000-0000-000000000005',
    'a7200000-0000-0000-0000-000000000004',
    'ATTDMP Husbandry 4',
    'attdmp-husbandry-4',
    'husbandry'
  ),
  (
    'a7600000-0000-0000-0000-000000000006',
    'a7200000-0000-0000-0000-000000000004',
    'ATTDMP Culling 4',
    'attdmp-culling-4',
    'culling'
  ),
  (
    'a7600000-0000-0000-0000-000000000007',
    'a7200000-0000-0000-0000-000000000005',
    'ATTDMP Husbandry 5',
    'attdmp-husbandry-5',
    'husbandry'
  ),
  (
    'a7600000-0000-0000-0000-000000000008',
    'a7200000-0000-0000-0000-000000000005',
    'ATTDMP Culling 5',
    'attdmp-culling-5',
    'culling'
  );

-- deposit_types: one per deposit world
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
    'a7700000-0000-0000-0000-000000000001',
    'a7200000-0000-0000-0000-000000000001',
    'ATTDMP Iron Vein 1',
    'attdmp-iron-vein-1',
    'a7600000-0000-0000-0000-000000000001',
    10
  ),
  (
    'a7700000-0000-0000-0000-000000000002',
    'a7200000-0000-0000-0000-000000000002',
    'ATTDMP Iron Vein 2',
    'attdmp-iron-vein-2',
    'a7600000-0000-0000-0000-000000000002',
    10
  );

-- deposit_instances: world 1 (partial extraction), world 2 (will deplete)
insert into
  public.deposit_instances (id, settlement_id, deposit_type_id, name, status)
values
  (
    'a7800000-0000-0000-0000-000000000001',
    'a7400000-0000-0000-0000-000000000001',
    'a7700000-0000-0000-0000-000000000001',
    'ATTDMP Vein 1',
    'active'
  ),
  (
    'a7800000-0000-0000-0000-000000000002',
    'a7400000-0000-0000-0000-000000000002',
    'a7700000-0000-0000-0000-000000000002',
    'ATTDMP Vein 2',
    'active'
  );

-- deposit_instance_resources: world 1 (initial=100, remaining=100), world 2 (initial=50, remaining=50)
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
    'a7900000-0000-0000-0000-000000000001',
    'a7800000-0000-0000-0000-000000000001',
    'a7500000-0000-0000-0000-000000000001',
    100,
    100
  ),
  (
    'a7900000-0000-0000-0000-000000000002',
    'a7800000-0000-0000-0000-000000000002',
    'a7500000-0000-0000-0000-000000000002',
    50,
    50
  );

-- managed_population_types: one per managed-pop world (3, 4, 5)
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
    'a7a00000-0000-0000-0000-000000000003',
    'a7200000-0000-0000-0000-000000000003',
    'ATTDMP Cattle 3',
    'attdmp-cattle-3',
    'a7600000-0000-0000-0000-000000000003',
    'a7600000-0000-0000-0000-000000000004',
    10,
    0.1
  ),
  (
    'a7a00000-0000-0000-0000-000000000004',
    'a7200000-0000-0000-0000-000000000004',
    'ATTDMP Cattle 4',
    'attdmp-cattle-4',
    'a7600000-0000-0000-0000-000000000005',
    'a7600000-0000-0000-0000-000000000006',
    10,
    0.1
  ),
  (
    'a7a00000-0000-0000-0000-000000000005',
    'a7200000-0000-0000-0000-000000000005',
    'ATTDMP Cattle 5',
    'attdmp-cattle-5',
    'a7600000-0000-0000-0000-000000000007',
    'a7600000-0000-0000-0000-000000000008',
    10,
    0.1
  );

-- managed_population_instances
--   World 3: count=100, status=active  (will grow by +20)
--   World 4: count=100, status=active  (will decline by -10)
--   World 5: count=5,   status=active  (will go extinct, countDelta=-5)
insert into
  public.managed_population_instances (
    id,
    settlement_id,
    managed_population_type_id,
    name,
    current_count,
    configured_cull_quantity,
    status
  )
values
  (
    'a7b00000-0000-0000-0000-000000000003',
    'a7400000-0000-0000-0000-000000000003',
    'a7a00000-0000-0000-0000-000000000003',
    'ATTDMP Herd 3',
    100,
    0,
    'active'
  ),
  (
    'a7b00000-0000-0000-0000-000000000004',
    'a7400000-0000-0000-0000-000000000004',
    'a7a00000-0000-0000-0000-000000000004',
    'ATTDMP Herd 4',
    100,
    0,
    'active'
  ),
  (
    'a7b00000-0000-0000-0000-000000000005',
    'a7400000-0000-0000-0000-000000000005',
    'a7a00000-0000-0000-0000-000000000005',
    'ATTDMP Herd 5',
    5,
    0,
    'active'
  );

-- Citizens for worlds 2 & 5 (NPC workers that will be unassigned)
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
    'a7c00000-0000-0000-0000-000000000001',
    'a7200000-0000-0000-0000-000000000002',
    'a7400000-0000-0000-0000-000000000002',
    'npc',
    'ATTDMP Miner',
    'alive'
  ),
  (
    'a7c00000-0000-0000-0000-000000000002',
    'a7200000-0000-0000-0000-000000000005',
    'a7400000-0000-0000-0000-000000000005',
    'npc',
    'ATTDMP Herder',
    'alive'
  ),
  (
    'a7c00000-0000-0000-0000-000000000003',
    'a7200000-0000-0000-0000-000000000005',
    'a7400000-0000-0000-0000-000000000005',
    'npc',
    'ATTDMP Culler',
    'alive'
  );

-- Citizen assignments:
--   World 2: miner assigned to the deposit that will deplete
--   World 5: herder (husbandry) and culler (culling) assigned to the pop that will go extinct
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    deposit_instance_id,
    assigned_on_turn_number
  )
values
  (
    'a7c00000-0000-0000-0000-000000000001',
    'deposit',
    'a7800000-0000-0000-0000-000000000002',
    3
  );

insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    managed_population_instance_id,
    assigned_on_turn_number
  )
values
  (
    'a7c00000-0000-0000-0000-000000000002',
    'husbandry',
    'a7b00000-0000-0000-0000-000000000005',
    3
  ),
  (
    'a7c00000-0000-0000-0000-000000000003',
    'culling',
    'a7b00000-0000-0000-0000-000000000005',
    3
  );

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
    'a7300000-0000-0000-0000-000000000001',
    'a7200000-0000-0000-0000-000000000001',
    3,
    4,
    'a7100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'a7300000-0000-0000-0000-000000000002',
    'a7200000-0000-0000-0000-000000000002',
    3,
    4,
    'a7100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'a7300000-0000-0000-0000-000000000003',
    'a7200000-0000-0000-0000-000000000003',
    3,
    4,
    'a7100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'a7300000-0000-0000-0000-000000000004',
    'a7200000-0000-0000-0000-000000000004',
    3,
    4,
    'a7100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'a7300000-0000-0000-0000-000000000005',
    'a7200000-0000-0000-0000-000000000005',
    3,
    4,
    'a7100000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- All tests run as service_role
-- ===========================================================================
set
  local role service_role;

-- ===========================================================================
-- TEST SCENARIO 1: extraction decrement
-- Deposit has remaining_quantity = 100. Apply delta = -30. Expect 70.
-- toStatus is null so status stays 'active' and no workers are unassigned.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a7200000-0000-0000-0000-000000000001',
    3,
    jsonb_build_object(
      'depositUpdates',
      jsonb_build_array(
        jsonb_build_object(
          'depositInstanceId',
          'a7800000-0000-0000-0000-000000000001',
          'resourceDeltas',
          jsonb_build_array(
            jsonb_build_object(
              'resourceId',
              'a7500000-0000-0000-0000-000000000001',
              'delta',
              -30
            )
          ),
          'toStatus',
          null
        )
      )
    ),
    'a7300000-0000-0000-0000-000000000001'::uuid
  );

select
  is (
    (
      select
        dir.remaining_quantity
      from
        public.deposit_instance_resources dir
      where
        dir.id = 'a7900000-0000-0000-0000-000000000001'
    ),
    70::numeric(18, 4),
    'extraction: remaining_quantity decremented from 100 to 70'
  );

-- ===========================================================================
-- TEST SCENARIO 2: depletion + worker unassignment
-- Deposit has remaining_quantity = 50. Apply delta = -50, toStatus = 'depleted'.
-- Expect remaining_quantity = 0, deposit status = 'depleted', worker assignment deleted.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a7200000-0000-0000-0000-000000000002',
    3,
    jsonb_build_object(
      'depositUpdates',
      jsonb_build_array(
        jsonb_build_object(
          'depositInstanceId',
          'a7800000-0000-0000-0000-000000000002',
          'resourceDeltas',
          jsonb_build_array(
            jsonb_build_object(
              'resourceId',
              'a7500000-0000-0000-0000-000000000002',
              'delta',
              -50
            )
          ),
          'toStatus',
          'depleted'
        )
      )
    ),
    'a7300000-0000-0000-0000-000000000002'::uuid
  );

select
  is (
    (
      select
        dir.remaining_quantity
      from
        public.deposit_instance_resources dir
      where
        dir.id = 'a7900000-0000-0000-0000-000000000002'
    ),
    0::numeric(18, 4),
    'depletion: remaining_quantity decremented to 0'
  );

select
  is (
    (
      select
        di.status
      from
        public.deposit_instances di
      where
        di.id = 'a7800000-0000-0000-0000-000000000002'
    ),
    'depleted',
    'depletion: deposit status updated to depleted'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.deposit_instance_id = 'a7800000-0000-0000-0000-000000000002'
    ),
    0,
    'depletion: worker assignment deleted when deposit depletes'
  );

-- ===========================================================================
-- TEST SCENARIO 3: managed population growth
-- Population has current_count = 100. Apply countDelta = +20, toStatus = null.
-- Expect current_count = 120, status stays 'active'.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a7200000-0000-0000-0000-000000000003',
    3,
    jsonb_build_object(
      'managedPopulationUpdates',
      jsonb_build_array(
        jsonb_build_object(
          'managedPopulationInstanceId',
          'a7b00000-0000-0000-0000-000000000003',
          'countDelta',
          20,
          'toStatus',
          null
        )
      )
    ),
    'a7300000-0000-0000-0000-000000000003'::uuid
  );

select
  is (
    (
      select
        mpi.current_count
      from
        public.managed_population_instances mpi
      where
        mpi.id = 'a7b00000-0000-0000-0000-000000000003'
    ),
    120::numeric(18, 4),
    'growth: current_count increased from 100 to 120'
  );

select
  is (
    (
      select
        mpi.status
      from
        public.managed_population_instances mpi
      where
        mpi.id = 'a7b00000-0000-0000-0000-000000000003'
    ),
    'active',
    'growth: status remains active'
  );

-- ===========================================================================
-- TEST SCENARIO 4: managed population decline
-- Population has current_count = 100. Apply countDelta = -10, toStatus = null.
-- Expect current_count = 90, status stays 'active'.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a7200000-0000-0000-0000-000000000004',
    3,
    jsonb_build_object(
      'managedPopulationUpdates',
      jsonb_build_array(
        jsonb_build_object(
          'managedPopulationInstanceId',
          'a7b00000-0000-0000-0000-000000000004',
          'countDelta',
          -10,
          'toStatus',
          null
        )
      )
    ),
    'a7300000-0000-0000-0000-000000000004'::uuid
  );

select
  is (
    (
      select
        mpi.current_count
      from
        public.managed_population_instances mpi
      where
        mpi.id = 'a7b00000-0000-0000-0000-000000000004'
    ),
    90::numeric(18, 4),
    'decline: current_count decreased from 100 to 90'
  );

select
  is (
    (
      select
        mpi.status
      from
        public.managed_population_instances mpi
      where
        mpi.id = 'a7b00000-0000-0000-0000-000000000004'
    ),
    'active',
    'decline: status remains active'
  );

-- ===========================================================================
-- TEST SCENARIO 5: managed population extinction + worker unassignment
-- Population has current_count = 5. Apply countDelta = -5, toStatus = 'extinct'.
-- Expect current_count = 0, status = 'extinct', both husbandry and culling
-- worker assignments deleted.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a7200000-0000-0000-0000-000000000005',
    3,
    jsonb_build_object(
      'managedPopulationUpdates',
      jsonb_build_array(
        jsonb_build_object(
          'managedPopulationInstanceId',
          'a7b00000-0000-0000-0000-000000000005',
          'countDelta',
          -5,
          'toStatus',
          'extinct'
        )
      )
    ),
    'a7300000-0000-0000-0000-000000000005'::uuid
  );

select
  is (
    (
      select
        mpi.current_count
      from
        public.managed_population_instances mpi
      where
        mpi.id = 'a7b00000-0000-0000-0000-000000000005'
    ),
    0::numeric(18, 4),
    'extinction: current_count reduced to 0'
  );

select
  is (
    (
      select
        mpi.status
      from
        public.managed_population_instances mpi
      where
        mpi.id = 'a7b00000-0000-0000-0000-000000000005'
    ),
    'extinct',
    'extinction: status updated to extinct'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.managed_population_instance_id = 'a7b00000-0000-0000-0000-000000000005'
        and ca.assignment_type = 'husbandry'
    ),
    0,
    'extinction: husbandry worker assignment deleted when population goes extinct'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.managed_population_instance_id = 'a7b00000-0000-0000-0000-000000000005'
        and ca.assignment_type = 'culling'
    ),
    0,
    'extinction: culling worker assignment deleted when population goes extinct'
  );

reset role;

rollback;
