-- pgTAP tests for §C28: apply_turn_transition stockpile delta + snapshot writes.
-- Run with: npx supabase test db
--
-- UUID prefix map (all a5-prefixed ranges, unique to this file):
--   a5100000 = users        a5200000 = worlds
--   a5300000 = transitions  a5400000 = nations
--   a5500000 = settlements  a5600000 = resources
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
    'a5100000-0000-0000-0000-000000000001',
    'attsd-superadmin@example.com',
    'x',
    now(),
    '{"username":"attsd_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'a5100000-0000-0000-0000-000000000001';

-- Four worlds — each used by one scenario:
--   World 1 (turn 5): single-delta test
--   World 2 (turn 5): multi-resource batch test
--   World 3 (turn 5): server-side clamp test
--   World 4 (turn 8): ON CONFLICT idempotency test
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'a5200000-0000-0000-0000-000000000001',
    'ATTSD Single Delta World',
    5,
    'private',
    'active'
  ),
  (
    'a5200000-0000-0000-0000-000000000002',
    'ATTSD Multi Resource World',
    5,
    'private',
    'active'
  ),
  (
    'a5200000-0000-0000-0000-000000000003',
    'ATTSD Clamp World',
    5,
    'private',
    'active'
  ),
  (
    'a5200000-0000-0000-0000-000000000004',
    'ATTSD Idempotency World',
    8,
    'private',
    'active'
  );

-- One nation per world
insert into
  public.nations (id, world_id, name)
values
  (
    'a5400000-0000-0000-0000-000000000001',
    'a5200000-0000-0000-0000-000000000001',
    'ATTSD Nation 1'
  ),
  (
    'a5400000-0000-0000-0000-000000000002',
    'a5200000-0000-0000-0000-000000000002',
    'ATTSD Nation 2'
  ),
  (
    'a5400000-0000-0000-0000-000000000003',
    'a5200000-0000-0000-0000-000000000003',
    'ATTSD Nation 3'
  ),
  (
    'a5400000-0000-0000-0000-000000000004',
    'a5200000-0000-0000-0000-000000000004',
    'ATTSD Nation 4'
  );

-- One settlement per world (stockpiles seeded by resource INSERT trigger below)
insert into
  public.settlements (id, nation_id, name)
values
  (
    'a5500000-0000-0000-0000-000000000001',
    'a5400000-0000-0000-0000-000000000001',
    'ATTSD Settlement 1'
  ),
  (
    'a5500000-0000-0000-0000-000000000002',
    'a5400000-0000-0000-0000-000000000002',
    'ATTSD Settlement 2'
  ),
  (
    'a5500000-0000-0000-0000-000000000003',
    'a5400000-0000-0000-0000-000000000003',
    'ATTSD Settlement 3'
  ),
  (
    'a5500000-0000-0000-0000-000000000004',
    'a5400000-0000-0000-0000-000000000004',
    'ATTSD Settlement 4'
  );

-- Resources — seed triggers fire on INSERT, creating zero-quantity stockpile rows
-- Resource 0001: World 1, cap 1000 (single-delta test)
-- Resource 0002: World 2 A, cap 1000 (multi-resource test)
-- Resource 0003: World 2 B, cap 1000 (multi-resource test)
-- Resource 0004: World 3, cap 100  (clamp test — quantityAfter will exceed cap)
-- Resource 0005: World 4, cap 1000 (idempotency test)
insert into
  public.resources (id, world_id, name, slug, base_stockpile_cap)
values
  (
    'a5600000-0000-0000-0000-000000000001',
    'a5200000-0000-0000-0000-000000000001',
    'ATTSD Grain',
    'attsd-grain',
    1000
  ),
  (
    'a5600000-0000-0000-0000-000000000002',
    'a5200000-0000-0000-0000-000000000002',
    'ATTSD Iron',
    'attsd-iron',
    1000
  ),
  (
    'a5600000-0000-0000-0000-000000000003',
    'a5200000-0000-0000-0000-000000000002',
    'ATTSD Timber',
    'attsd-timber',
    1000
  ),
  (
    'a5600000-0000-0000-0000-000000000004',
    'a5200000-0000-0000-0000-000000000003',
    'ATTSD Salt',
    'attsd-salt',
    100
  ),
  (
    'a5600000-0000-0000-0000-000000000005',
    'a5200000-0000-0000-0000-000000000004',
    'ATTSD Stone',
    'attsd-stone',
    1000
  );

-- Pre-seeded running transition for idempotency test (World 4, turn 8 → 9)
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
    'a5300000-0000-0000-0000-000000000001',
    'a5200000-0000-0000-0000-000000000004',
    8,
    9,
    'a5100000-0000-0000-0000-000000000001',
    'running'
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
    'a5300000-0000-0000-0000-000000000002',
    'a5200000-0000-0000-0000-000000000001',
    5,
    6,
    'a5100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'a5300000-0000-0000-0000-000000000003',
    'a5200000-0000-0000-0000-000000000002',
    5,
    6,
    'a5100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'a5300000-0000-0000-0000-000000000004',
    'a5200000-0000-0000-0000-000000000003',
    5,
    6,
    'a5100000-0000-0000-0000-000000000001',
    'running'
  );

-- Pre-seeded snapshot for idempotency test — simulates a partial run that already
-- wrote this row; ON CONFLICT DO NOTHING should suppress the duplicate on retry.
insert into
  public.settlement_turn_resource_snapshots (
    turn_transition_id,
    world_id,
    settlement_id,
    resource_id,
    turn_number,
    quantity_before,
    quantity_after,
    produced_amount,
    consumed_amount,
    trade_in_amount,
    trade_out_amount
  )
values
  (
    'a5300000-0000-0000-0000-000000000001',
    'a5200000-0000-0000-0000-000000000004',
    'a5500000-0000-0000-0000-000000000004',
    'a5600000-0000-0000-0000-000000000005',
    8,
    0,
    10,
    10,
    0,
    0,
    0
  );

-- ===========================================================================
-- All tests run as super admin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a5100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- TEST SCENARIO 1: single stockpile delta — updates stockpile and writes one snapshot row
-- ===========================================================================
select
  public.apply_turn_transition (
    'a5200000-0000-0000-0000-000000000001',
    5,
    jsonb_build_object(
      'stockpileDeltas',
      jsonb_build_array(
        jsonb_build_object(
          'settlementId',
          'a5500000-0000-0000-0000-000000000001',
          'resourceId',
          'a5600000-0000-0000-0000-000000000001',
          'quantityBefore',
          0,
          'quantityAfter',
          50,
          'produced',
          50,
          'consumed',
          0,
          'tradeIn',
          0,
          'tradeOut',
          0
        )
      )
    ),
    'a5300000-0000-0000-0000-000000000002'::uuid
  );

select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'a5500000-0000-0000-0000-000000000001'
        and resource_id = 'a5600000-0000-0000-0000-000000000001'
    ),
    50::numeric(18, 4),
    'single delta: settlement_resource_stockpiles.quantity updated to 50'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_resource_snapshots s
        join public.turn_transitions tt on tt.id = s.turn_transition_id
      where
        tt.world_id = 'a5200000-0000-0000-0000-000000000001'
        and s.settlement_id = 'a5500000-0000-0000-0000-000000000001'
        and s.resource_id = 'a5600000-0000-0000-0000-000000000001'
    ),
    1,
    'single delta: one settlement_turn_resource_snapshots row written'
  );

select
  is (
    (
      select
        quantity_before
      from
        public.settlement_turn_resource_snapshots s
        join public.turn_transitions tt on tt.id = s.turn_transition_id
      where
        tt.world_id = 'a5200000-0000-0000-0000-000000000001'
        and s.settlement_id = 'a5500000-0000-0000-0000-000000000001'
        and s.resource_id = 'a5600000-0000-0000-0000-000000000001'
    ),
    0::numeric(18, 4),
    'single delta: snapshot quantity_before = 0'
  );

select
  is (
    (
      select
        quantity_after
      from
        public.settlement_turn_resource_snapshots s
        join public.turn_transitions tt on tt.id = s.turn_transition_id
      where
        tt.world_id = 'a5200000-0000-0000-0000-000000000001'
        and s.settlement_id = 'a5500000-0000-0000-0000-000000000001'
        and s.resource_id = 'a5600000-0000-0000-0000-000000000001'
    ),
    50::numeric(18, 4),
    'single delta: snapshot quantity_after = 50'
  );

select
  is (
    (
      select
        produced_amount
      from
        public.settlement_turn_resource_snapshots s
        join public.turn_transitions tt on tt.id = s.turn_transition_id
      where
        tt.world_id = 'a5200000-0000-0000-0000-000000000001'
        and s.settlement_id = 'a5500000-0000-0000-0000-000000000001'
        and s.resource_id = 'a5600000-0000-0000-0000-000000000001'
    ),
    50::numeric(18, 4),
    'single delta: snapshot produced_amount = 50'
  );

-- ===========================================================================
-- TEST SCENARIO 2: multi-resource batch — both stockpiles and snapshot rows written
-- ===========================================================================
select
  public.apply_turn_transition (
    'a5200000-0000-0000-0000-000000000002',
    5,
    jsonb_build_object(
      'stockpileDeltas',
      jsonb_build_array(
        jsonb_build_object(
          'settlementId',
          'a5500000-0000-0000-0000-000000000002',
          'resourceId',
          'a5600000-0000-0000-0000-000000000002',
          'quantityBefore',
          0,
          'quantityAfter',
          30,
          'produced',
          30,
          'consumed',
          0,
          'tradeIn',
          0,
          'tradeOut',
          0
        ),
        jsonb_build_object(
          'settlementId',
          'a5500000-0000-0000-0000-000000000002',
          'resourceId',
          'a5600000-0000-0000-0000-000000000003',
          'quantityBefore',
          0,
          'quantityAfter',
          20,
          'produced',
          15,
          'consumed',
          0,
          'tradeIn',
          5,
          'tradeOut',
          0
        )
      )
    ),
    'a5300000-0000-0000-0000-000000000003'::uuid
  );

select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'a5500000-0000-0000-0000-000000000002'
        and resource_id = 'a5600000-0000-0000-0000-000000000002'
    ),
    30::numeric(18, 4),
    'multi-resource batch: stockpile A quantity = 30'
  );

select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'a5500000-0000-0000-0000-000000000002'
        and resource_id = 'a5600000-0000-0000-0000-000000000003'
    ),
    20::numeric(18, 4),
    'multi-resource batch: stockpile B quantity = 20'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_resource_snapshots s
        join public.turn_transitions tt on tt.id = s.turn_transition_id
      where
        tt.world_id = 'a5200000-0000-0000-0000-000000000002'
        and s.settlement_id = 'a5500000-0000-0000-0000-000000000002'
    ),
    2,
    'multi-resource batch: two snapshot rows written'
  );

-- ===========================================================================
-- TEST SCENARIO 3: server-side clamp — quantity_after > effective_cap is clamped
-- Resource 0004 has base_stockpile_cap = 100; payload sends quantityAfter = 200
-- ===========================================================================
select
  public.apply_turn_transition (
    'a5200000-0000-0000-0000-000000000003',
    5,
    jsonb_build_object(
      'stockpileDeltas',
      jsonb_build_array(
        jsonb_build_object(
          'settlementId',
          'a5500000-0000-0000-0000-000000000003',
          'resourceId',
          'a5600000-0000-0000-0000-000000000004',
          'quantityBefore',
          0,
          'quantityAfter',
          200,
          'produced',
          200,
          'consumed',
          0,
          'tradeIn',
          0,
          'tradeOut',
          0
        )
      )
    ),
    'a5300000-0000-0000-0000-000000000004'::uuid
  );

select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'a5500000-0000-0000-0000-000000000003'
        and resource_id = 'a5600000-0000-0000-0000-000000000004'
    ),
    100::numeric(18, 4),
    'server-side clamp: stockpile quantity clamped to effective_cap (100)'
  );

select
  is (
    (
      select
        quantity_after
      from
        public.settlement_turn_resource_snapshots s
        join public.turn_transitions tt on tt.id = s.turn_transition_id
      where
        tt.world_id = 'a5200000-0000-0000-0000-000000000003'
        and s.settlement_id = 'a5500000-0000-0000-0000-000000000003'
        and s.resource_id = 'a5600000-0000-0000-0000-000000000004'
    ),
    100::numeric(18, 4),
    'server-side clamp: snapshot quantity_after reflects clamped value (100)'
  );

-- ===========================================================================
-- TEST SCENARIO 4: ON CONFLICT idempotency — retry with pre-existing snapshot is a no-op
-- World 4 has a pre-seeded running transition and snapshot row.
-- The call reuses the running transition, and ON CONFLICT suppresses the duplicate insert.
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.apply_turn_transition(
      'a5200000-0000-0000-0000-000000000004',
      8,
      jsonb_build_object(
        'stockpileDeltas',
        jsonb_build_array(
          jsonb_build_object(
            'settlementId', 'a5500000-0000-0000-0000-000000000004',
            'resourceId',   'a5600000-0000-0000-0000-000000000005',
            'quantityBefore', 0,
            'quantityAfter',  10,
            'produced',       10,
            'consumed',       0,
            'tradeIn',        0,
            'tradeOut',       0
          )
        )
      ),
      'a5300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'ON CONFLICT idempotency: retry with pre-existing snapshot raises no exception'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_resource_snapshots
      where
        turn_transition_id = 'a5300000-0000-0000-0000-000000000001'
        and settlement_id = 'a5500000-0000-0000-0000-000000000004'
        and resource_id = 'a5600000-0000-0000-0000-000000000005'
    ),
    1,
    'ON CONFLICT idempotency: snapshot row count remains 1 after retry (no duplicate)'
  );

reset role;

rollback;
