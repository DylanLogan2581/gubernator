-- pgTAP tests for §C34: apply_turn_transition settlement snapshot writes.
-- Run with: npx supabase test db
--
-- UUID prefix map (all c3-prefixed ranges, unique to this file):
--   c3100000 = users        c3200000 = worlds
--   c3300000 = nations      c3400000 = settlements
begin;

select
  plan (5);

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
    'c3100000-0000-0000-0000-000000000001',
    'attss-superadmin@example.com',
    'x',
    now(),
    '{"username":"attss_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'c3100000-0000-0000-0000-000000000001';

-- Three worlds:
--   World 1 (turn 3): single-settlement field-value test
--   World 2 (turn 5): two-settlement count test
--   World 3 (turn 7): idempotency / ON CONFLICT test
insert into
  public.worlds (
    id,
    name,
    owner_id,
    current_turn_number,
    visibility,
    status
  )
values
  (
    'c3200000-0000-0000-0000-000000000001',
    'ATTSS Single Settlement World',
    'c3100000-0000-0000-0000-000000000001',
    3,
    'private',
    'active'
  ),
  (
    'c3200000-0000-0000-0000-000000000002',
    'ATTSS Multi Settlement World',
    'c3100000-0000-0000-0000-000000000001',
    5,
    'private',
    'active'
  ),
  (
    'c3200000-0000-0000-0000-000000000003',
    'ATTSS Idempotency World',
    'c3100000-0000-0000-0000-000000000001',
    7,
    'private',
    'active'
  );

-- Nations (one per world)
insert into
  public.nations (id, world_id, name)
values
  (
    'c3300000-0000-0000-0000-000000000001',
    'c3200000-0000-0000-0000-000000000001',
    'ATTSS Nation 1'
  ),
  (
    'c3300000-0000-0000-0000-000000000002',
    'c3200000-0000-0000-0000-000000000002',
    'ATTSS Nation 2'
  ),
  (
    'c3300000-0000-0000-0000-000000000003',
    'c3200000-0000-0000-0000-000000000003',
    'ATTSS Nation 3'
  );

-- Settlements
insert into
  public.settlements (id, nation_id, name)
values
  -- World 1: one settlement
  (
    'c3400000-0000-0000-0000-000000000001',
    'c3300000-0000-0000-0000-000000000001',
    'ATTSS Settlement 1'
  ),
  -- World 2: two settlements
  (
    'c3400000-0000-0000-0000-000000000002',
    'c3300000-0000-0000-0000-000000000002',
    'ATTSS Settlement 2'
  ),
  (
    'c3400000-0000-0000-0000-000000000003',
    'c3300000-0000-0000-0000-000000000002',
    'ATTSS Settlement 3'
  ),
  -- World 3: one settlement
  (
    'c3400000-0000-0000-0000-000000000004',
    'c3300000-0000-0000-0000-000000000003',
    'ATTSS Settlement 4'
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
    'c3300000-0000-0000-0000-000000000001',
    'c3200000-0000-0000-0000-000000000001',
    3,
    4,
    'c3100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'c3300000-0000-0000-0000-000000000002',
    'c3200000-0000-0000-0000-000000000002',
    5,
    6,
    'c3100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'c3300000-0000-0000-0000-000000000003',
    'c3200000-0000-0000-0000-000000000003',
    7,
    8,
    'c3100000-0000-0000-0000-000000000001',
    'running'
  );

-- ---------------------------------------------------------------------------
-- Authenticate as super admin so the RPC's auth check passes
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c3100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- World 1 — single settlement: population breakdown and summary JSON round-trip
-- ===========================================================================
select
  public.apply_turn_transition (
    'c3200000-0000-0000-0000-000000000001',
    3,
    jsonb_build_object(
      'settlementSnapshots',
      jsonb_build_array(
        jsonb_build_object(
          'settlementId',
          'c3400000-0000-0000-0000-000000000001',
          'turnNumber',
          4,
          'aliveTotal',
          120,
          'aliveNpc',
          115,
          'alivePc',
          5,
          'populationCap',
          200,
          'birthCount',
          3,
          'deathCount',
          1,
          'starvationDeathsCount',
          0,
          'homelessDeathsCount',
          1,
          'partnershipsFormedCount',
          2,
          'managedPopulationSummary',
          jsonb_build_array(
            jsonb_build_object(
              'instanceId',
              'c3400000-0000-0000-0000-000000000099',
              'currentCount',
              40
            )
          ),
          'buildingSummary',
          jsonb_build_object(
            'active',
            5,
            'suspended',
            1,
            'auto_deconstructed',
            0,
            'manually_deconstructed',
            0
          ),
          'tradeSummary',
          jsonb_build_array(
            jsonb_build_object(
              'tradeRouteId',
              'c3400000-0000-0000-0000-000000000098',
              'delivered',
              true,
              'quantityTransferred',
              50
            )
          ),
          'warnings',
          jsonb_build_object(
            'depletedDepositIds',
            jsonb_build_array('c3400000-0000-0000-0000-000000000097'),
            'pausedProjectIds',
            jsonb_build_array()
          )
        )
      )
    ),
    'c3300000-0000-0000-0000-000000000001'::uuid
  );

-- Test 1: one snapshot row was inserted for the settlement
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_snapshots sts
        inner join public.turn_transitions tt on tt.id = sts.turn_transition_id
      where
        tt.world_id = 'c3200000-0000-0000-0000-000000000001'
        and sts.settlement_id = 'c3400000-0000-0000-0000-000000000001'
    ),
    1,
    'single settlement produces exactly one snapshot row'
  );

-- Test 2: population breakdown fields match engine output
select
  is (
    (
      select
        row (
          sts.population_total,
          sts.population_npc,
          sts.population_player_character,
          sts.population_cap,
          sts.birth_count,
          sts.death_count,
          sts.starvation_deaths_count,
          sts.homeless_deaths_count,
          sts.partnerships_formed_count
        )
      from
        public.settlement_turn_snapshots sts
        inner join public.turn_transitions tt on tt.id = sts.turn_transition_id
      where
        tt.world_id = 'c3200000-0000-0000-0000-000000000001'
        and sts.settlement_id = 'c3400000-0000-0000-0000-000000000001'
    ),
    row (120, 115, 5, 200, 3, 1, 0, 1, 2),
    'population breakdown fields match engine output'
  );

-- Test 3: summary JSON values round-trip correctly
select
  is (
    (
      select
        row (
          sts.managed_populations_summary_json,
          sts.buildings_summary_json,
          sts.trade_summary_json,
          sts.warnings_summary_json
        )
      from
        public.settlement_turn_snapshots sts
        inner join public.turn_transitions tt on tt.id = sts.turn_transition_id
      where
        tt.world_id = 'c3200000-0000-0000-0000-000000000001'
        and sts.settlement_id = 'c3400000-0000-0000-0000-000000000001'
    ),
    row (
      '[{"instanceId":"c3400000-0000-0000-0000-000000000099","currentCount":40}]'::jsonb,
      '{"active":5,"suspended":1,"auto_deconstructed":0,"manually_deconstructed":0}'::jsonb,
      '[{"tradeRouteId":"c3400000-0000-0000-0000-000000000098","delivered":true,"quantityTransferred":50}]'::jsonb,
      '{"depletedDepositIds":["c3400000-0000-0000-0000-000000000097"],"pausedProjectIds":[]}'::jsonb
    ),
    'summary JSON values round-trip correctly'
  );

-- ===========================================================================
-- World 2 — two settlements: one snapshot row per settlement per transition
-- ===========================================================================
select
  public.apply_turn_transition (
    'c3200000-0000-0000-0000-000000000002',
    5,
    jsonb_build_object(
      'settlementSnapshots',
      jsonb_build_array(
        jsonb_build_object(
          'settlementId',
          'c3400000-0000-0000-0000-000000000002',
          'turnNumber',
          6,
          'aliveTotal',
          80,
          'aliveNpc',
          78,
          'alivePc',
          2,
          'populationCap',
          150,
          'buildingSummary',
          jsonb_build_object(
            'active',
            3,
            'suspended',
            0,
            'auto_deconstructed',
            0,
            'manually_deconstructed',
            0
          ),
          'warnings',
          jsonb_build_object(
            'depletedDepositIds',
            jsonb_build_array(),
            'pausedProjectIds',
            jsonb_build_array()
          )
        ),
        jsonb_build_object(
          'settlementId',
          'c3400000-0000-0000-0000-000000000003',
          'turnNumber',
          6,
          'aliveTotal',
          60,
          'aliveNpc',
          60,
          'alivePc',
          0,
          'populationCap',
          100,
          'buildingSummary',
          jsonb_build_object(
            'active',
            2,
            'suspended',
            0,
            'auto_deconstructed',
            0,
            'manually_deconstructed',
            0
          ),
          'warnings',
          jsonb_build_object(
            'depletedDepositIds',
            jsonb_build_array(),
            'pausedProjectIds',
            jsonb_build_array()
          )
        )
      )
    ),
    'c3300000-0000-0000-0000-000000000002'::uuid
  );

-- Test 4: two settlements produce two snapshot rows (one per settlement)
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_snapshots sts
        inner join public.turn_transitions tt on tt.id = sts.turn_transition_id
      where
        tt.world_id = 'c3200000-0000-0000-0000-000000000002'
    ),
    2,
    'two settlements produce two snapshot rows under one transition'
  );

-- ===========================================================================
-- World 3 — idempotency: a second call with the same payload inserts nothing
-- ===========================================================================
select
  public.apply_turn_transition (
    'c3200000-0000-0000-0000-000000000003',
    7,
    jsonb_build_object(
      'settlementSnapshots',
      jsonb_build_array(
        jsonb_build_object(
          'settlementId',
          'c3400000-0000-0000-0000-000000000004',
          'turnNumber',
          8,
          'aliveTotal',
          30,
          'aliveNpc',
          30,
          'alivePc',
          0,
          'populationCap',
          50,
          'buildingSummary',
          jsonb_build_object(
            'active',
            1,
            'suspended',
            0,
            'auto_deconstructed',
            0,
            'manually_deconstructed',
            0
          ),
          'warnings',
          jsonb_build_object(
            'depletedDepositIds',
            jsonb_build_array(),
            'pausedProjectIds',
            jsonb_build_array()
          )
        )
      )
    ),
    'c3300000-0000-0000-0000-000000000003'::uuid
  );

-- Manually re-insert the same snapshot to simulate a retry hitting ON CONFLICT.
-- We look up the transition id written above and attempt a duplicate insert.
-- The ON CONFLICT DO NOTHING must keep the count at 1.
-- INSERT was revoked from authenticated in 20260604000004; reset to postgres
-- so the duplicate insert can reach the ON CONFLICT path under test.
reset role;

insert into
  public.settlement_turn_snapshots (
    turn_transition_id,
    world_id,
    settlement_id,
    turn_number,
    population_total,
    population_npc,
    population_player_character,
    population_cap
  )
select
  sts.turn_transition_id,
  sts.world_id,
  sts.settlement_id,
  sts.turn_number,
  sts.population_total,
  sts.population_npc,
  sts.population_player_character,
  sts.population_cap
from
  public.settlement_turn_snapshots sts
  inner join public.turn_transitions tt on tt.id = sts.turn_transition_id
where
  tt.world_id = 'c3200000-0000-0000-0000-000000000003'
on conflict (turn_transition_id, settlement_id)
where
  turn_transition_id is not null do nothing;

-- Test 5: still exactly one row after the duplicate insert attempt
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_snapshots sts
        inner join public.turn_transitions tt on tt.id = sts.turn_transition_id
      where
        tt.world_id = 'c3200000-0000-0000-0000-000000000003'
    ),
    1,
    'ON CONFLICT DO NOTHING keeps exactly one snapshot row per settlement per transition on retry'
  );

reset role;

rollback;
