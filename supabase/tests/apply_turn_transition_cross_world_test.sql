-- pgTAP tests for §C36: apply_turn_transition cross-world payload guard.
-- Verifies that every payload key rejects foreign (cross-world) entity IDs
-- with P0001 so a world admin of World A cannot mutate entities in World B.
-- Run with: npx supabase test db
--
-- UUID prefix map (all e1-prefixed ranges, unique to this file):
--   e1100000 = users
--   e1200000 = worlds
--   e1300000 = nations
--   e1400000 = settlements
--   e1500000 = resources
--   e1600000 = building_blueprints
--   e1610000 = building_blueprint_tiers
--   e1700000 = construction_projects
--   e1800000 = settlement_buildings
--   e1900000 = job_definitions (mining, husbandry, culling for World B)
--   e1910000 = deposit_types
--   e1920000 = deposit_instances
--   e1a00000 = managed_population_types
--   e1a10000 = managed_population_instances
--   e1b00000 = trade_routes
--   e1c00000 = citizens
begin;

select
  plan (13);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- Users:
--   e1100000-0001 = super admin (world owner for both worlds)
--   e1100000-0002 = world admin of World A only (the adversarial caller)
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
    'e1100000-0000-0000-0000-000000000001',
    'attcw-superadmin@example.com',
    'x',
    now(),
    '{"username":"attcw_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1100000-0000-0000-0000-000000000002',
    'attcw-wadmin-a@example.com',
    'x',
    now(),
    '{"username":"attcw_wadmin_a"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e1100000-0000-0000-0000-000000000001';

-- Worlds:
--   World A (turn 5, active): the world the attacker is admin of
--   World B (turn 5, active): the foreign world whose entities should be protected
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'e1200000-0000-0000-0000-000000000001',
    'ATTCW World A',
    5,
    'private',
    'active'
  ),
  (
    'e1200000-0000-0000-0000-000000000002',
    'ATTCW World B',
    5,
    'private',
    'active'
  );

-- World admin for World A only (not World B)
insert into
  public.world_admins (world_id, user_id)
values
  (
    'e1200000-0000-0000-0000-000000000001',
    'e1100000-0000-0000-0000-000000000002'
  );

-- Nations
insert into
  public.nations (id, world_id, name)
values
  (
    'e1300000-0000-0000-0000-000000000001',
    'e1200000-0000-0000-0000-000000000001',
    'ATTCW Nation A'
  ),
  (
    'e1300000-0000-0000-0000-000000000002',
    'e1200000-0000-0000-0000-000000000002',
    'ATTCW Nation B'
  );

-- Settlements:
--   A1: in World A — used for happy-path calls and as valid baseline
--   B1, B2: in World B — targets for the cross-world attack
insert into
  public.settlements (id, nation_id, name)
values
  (
    'e1400000-0000-0000-0000-000000000001',
    'e1300000-0000-0000-0000-000000000001',
    'ATTCW Settlement A1'
  ),
  (
    'e1400000-0000-0000-0000-000000000002',
    'e1300000-0000-0000-0000-000000000002',
    'ATTCW Settlement B1'
  ),
  (
    'e1400000-0000-0000-0000-000000000003',
    'e1300000-0000-0000-0000-000000000002',
    'ATTCW Settlement B2'
  );

-- Resources:
--   A1: in World A
--   B1: in World B (foreign resource used in stockpileDeltas test)
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'e1500000-0000-0000-0000-000000000001',
    'e1200000-0000-0000-0000-000000000001',
    'ATTCW Grain A',
    'attcw-grain-a'
  ),
  (
    'e1500000-0000-0000-0000-000000000002',
    'e1200000-0000-0000-0000-000000000002',
    'ATTCW Grain B',
    'attcw-grain-b'
  );

-- Building blueprint + tier in World B (needed for construction project and building FKs)
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'e1600000-0000-0000-0000-000000000001',
    'e1200000-0000-0000-0000-000000000002',
    'ATTCW Granary B',
    'attcw-granary-b'
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
    'e1610000-0000-0000-0000-000000000001',
    'e1600000-0000-0000-0000-000000000001',
    1,
    10
  );

-- Construction project in World B's settlement B1
insert into
  public.construction_projects (
    id,
    settlement_id,
    building_blueprint_id,
    target_tier_id,
    status,
    queue_position,
    progress_worker_turns
  )
values
  (
    'e1700000-0000-0000-0000-000000000001',
    'e1400000-0000-0000-0000-000000000002',
    'e1600000-0000-0000-0000-000000000001',
    'e1610000-0000-0000-0000-000000000001',
    'in_progress',
    1,
    5
  );

-- Settlement building in World B's settlement B1
insert into
  public.settlement_buildings (
    id,
    settlement_id,
    building_blueprint_id,
    current_tier_id,
    state,
    missed_upkeep_count,
    activated_on_turn_number
  )
values
  (
    'e1800000-0000-0000-0000-000000000001',
    'e1400000-0000-0000-0000-000000000002',
    'e1600000-0000-0000-0000-000000000001',
    'e1610000-0000-0000-0000-000000000001',
    'active',
    0,
    1
  );

-- Job definitions in World B (backing deposit_type and managed_population_type FKs)
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'e1900000-0000-0000-0000-000000000001',
    'e1200000-0000-0000-0000-000000000002',
    'ATTCW Mining B',
    'attcw-mining-b',
    'deposit'
  ),
  (
    'e1900000-0000-0000-0000-000000000002',
    'e1200000-0000-0000-0000-000000000002',
    'ATTCW Husbandry B',
    'attcw-husbandry-b',
    'husbandry'
  ),
  (
    'e1900000-0000-0000-0000-000000000003',
    'e1200000-0000-0000-0000-000000000002',
    'ATTCW Culling B',
    'attcw-culling-b',
    'culling'
  );

-- Deposit type in World B
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
    'e1910000-0000-0000-0000-000000000001',
    'e1200000-0000-0000-0000-000000000002',
    'ATTCW Ore B',
    'attcw-ore-b',
    'e1900000-0000-0000-0000-000000000001',
    1
  );

-- Deposit instance in World B's settlement B1
insert into
  public.deposit_instances (
    id,
    settlement_id,
    deposit_type_id,
    name,
    status,
    max_workers
  )
values
  (
    'e1920000-0000-0000-0000-000000000001',
    'e1400000-0000-0000-0000-000000000002',
    'e1910000-0000-0000-0000-000000000001',
    'ATTCW Quarry B',
    'active',
    5
  );

-- Managed population type in World B
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
    'e1a00000-0000-0000-0000-000000000001',
    'e1200000-0000-0000-0000-000000000002',
    'ATTCW Flock Type B',
    'attcw-flock-type-b',
    'e1900000-0000-0000-0000-000000000002',
    'e1900000-0000-0000-0000-000000000003',
    5
  );

-- Managed population instance in World B's settlement B1
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
    'e1a10000-0000-0000-0000-000000000001',
    'e1400000-0000-0000-0000-000000000002',
    'e1a00000-0000-0000-0000-000000000001',
    'ATTCW Flock B',
    10,
    'active'
  );

-- Citizens in World B (needed for trade route proposer and citizen payload tests)
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
    'e1c00000-0000-0000-0000-000000000001',
    'e1200000-0000-0000-0000-000000000002',
    'e1400000-0000-0000-0000-000000000002',
    'npc',
    'ATTCW Citizen B1',
    'alive'
  ),
  (
    'e1c00000-0000-0000-0000-000000000002',
    'e1200000-0000-0000-0000-000000000002',
    'e1400000-0000-0000-0000-000000000002',
    'npc',
    'ATTCW Citizen B2',
    'alive'
  );

-- Trade route in World B: Settlement B1 → Settlement B2
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
    'e1b00000-0000-0000-0000-000000000001',
    'e1400000-0000-0000-0000-000000000002',
    'e1400000-0000-0000-0000-000000000003',
    'active',
    'e1c00000-0000-0000-0000-000000000001',
    'approved',
    'approved'
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
    'e1b00000-0000-0000-0000-000000000001',
    'send',
    'e1500000-0000-0000-0000-000000000002',
    10
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
    'e1300000-0000-0000-0000-000000000001',
    'e1200000-0000-0000-0000-000000000001',
    5,
    6,
    'e1100000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- All tests run as service_role; payload still targets World A
-- ===========================================================================
set
  local role service_role;

-- ===========================================================================
-- TEST 1: stockpileDeltas — foreign settlementId rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'e1200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'stockpileDeltas',
        jsonb_build_array(
          jsonb_build_object(
            'settlementId', 'e1400000-0000-0000-0000-000000000002',
            'resourceId',   'e1500000-0000-0000-0000-000000000001',
            'quantityBefore', 0,
            'quantityAfter',  10
          )
        )
      ),
      'e1300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'stockpileDeltas: foreign settlementId raises P0001'
  );

-- ===========================================================================
-- TEST 2: constructionUpdates — foreign projectId rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'e1200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'constructionUpdates',
        jsonb_build_array(
          jsonb_build_object(
            'projectId', 'e1700000-0000-0000-0000-000000000001',
            'status',    'in_progress',
            'progressWorkerTurns', 6
          )
        )
      ),
      'e1300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'constructionUpdates: foreign projectId raises P0001'
  );

-- ===========================================================================
-- TEST 3: buildingsCreated — foreign settlementId rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'e1200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'buildingsCreated',
        jsonb_build_array(
          jsonb_build_object(
            'settlementId',        'e1400000-0000-0000-0000-000000000002',
            'buildingBlueprintId', 'e1600000-0000-0000-0000-000000000001',
            'currentTierId',       'e1610000-0000-0000-0000-000000000001'
          )
        )
      ),
      'e1300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'buildingsCreated: foreign settlementId raises P0001'
  );

-- ===========================================================================
-- TEST 4: buildingStateChanges — foreign buildingId rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'e1200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'buildingStateChanges',
        jsonb_build_array(
          jsonb_build_object(
            'buildingId',        'e1800000-0000-0000-0000-000000000001',
            'state',             'suspended',
            'missedUpkeepCount', 1
          )
        )
      ),
      'e1300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'buildingStateChanges: foreign buildingId raises P0001'
  );

-- ===========================================================================
-- TEST 5: depositUpdates — foreign depositInstanceId rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'e1200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'depositUpdates',
        jsonb_build_array(
          jsonb_build_object(
            'depositInstanceId', 'e1920000-0000-0000-0000-000000000001',
            'resourceDeltas',    '[]'::jsonb,
            'toStatus',          null
          )
        )
      ),
      'e1300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'depositUpdates: foreign depositInstanceId raises P0001'
  );

-- ===========================================================================
-- TEST 6: managedPopulationUpdates — foreign managedPopulationInstanceId rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'e1200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'managedPopulationUpdates',
        jsonb_build_array(
          jsonb_build_object(
            'managedPopulationInstanceId', 'e1a10000-0000-0000-0000-000000000001',
            'countDelta',                  1,
            'toStatus',                    null
          )
        )
      ),
      'e1300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'managedPopulationUpdates: foreign managedPopulationInstanceId raises P0001'
  );

-- ===========================================================================
-- TEST 7: tradeRouteOutcomes — foreign tradeRouteId rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'e1200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'tradeRouteOutcomes',
        jsonb_build_array(
          jsonb_build_object(
            'tradeRouteId', 'e1b00000-0000-0000-0000-000000000001',
            'toStatus',     'paused',
            'pauseReason',  'shortfall'
          )
        )
      ),
      'e1300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'tradeRouteOutcomes: foreign tradeRouteId raises P0001'
  );

-- ===========================================================================
-- TEST 8: bornOnTurnBackfill — foreign citizenId rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'e1200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'bornOnTurnBackfill',
        jsonb_build_array(
          jsonb_build_object(
            'citizenId',         'e1c00000-0000-0000-0000-000000000001',
            'bornOnTurnNumber',  1
          )
        )
      ),
      'e1300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'bornOnTurnBackfill: foreign citizenId raises P0001'
  );

-- ===========================================================================
-- TEST 9: citizenBirths — foreign settlementId rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'e1200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'citizenBirths',
        jsonb_build_array(
          jsonb_build_object(
            'settlementId',      'e1400000-0000-0000-0000-000000000002',
            'name',              'Baby B',
            'sex',               'male',
            'bornOnTurnNumber',  5,
            'parentACitizenId',  null,
            'parentBCitizenId',  null
          )
        )
      ),
      'e1300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'citizenBirths: foreign settlementId raises P0001'
  );

-- ===========================================================================
-- TEST 10: citizenDeaths — foreign citizenId rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'e1200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'citizenDeaths',
        jsonb_build_array(
          jsonb_build_object(
            'citizenId',          'e1c00000-0000-0000-0000-000000000001',
            'deathCauseCategory', 'starvation',
            'deathCause',         'no food'
          )
        )
      ),
      'e1300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'citizenDeaths: foreign citizenId raises P0001'
  );

-- ===========================================================================
-- TEST 11: partnershipChanges — foreign citizenAId rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'e1200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'partnershipChanges',
        jsonb_build_array(
          jsonb_build_object(
            'citizenAId',          'e1c00000-0000-0000-0000-000000000001',
            'citizenBId',          'e1c00000-0000-0000-0000-000000000002',
            'toStatus',            'active',
            'formedOnTurnNumber',  5,
            'endedOnTurnNumber',   null
          )
        )
      ),
      'e1300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'partnershipChanges: foreign citizenAId raises P0001'
  );

-- ===========================================================================
-- TEST 12: assignmentClears — foreign citizenId rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'e1200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'assignmentClears',
        jsonb_build_array(
          jsonb_build_object(
            'citizenId', 'e1c00000-0000-0000-0000-000000000001'
          )
        )
      ),
      'e1300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'assignmentClears: foreign citizenId raises P0001'
  );

-- ===========================================================================
-- TEST 13: happy path — empty payload for World A succeeds
-- Guard must not reject empty or in-world payloads.
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.apply_turn_transition(
      'e1200000-0000-0000-0000-000000000001',
      5,
      '{}'::jsonb,
      'e1300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'empty payload for World A succeeds without cross-world rejection'
  );

reset role;

rollback;
