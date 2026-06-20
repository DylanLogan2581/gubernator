-- pgTAP tests for adjustment_amount in settlement_turn_resource_snapshots.
-- Verifies that internal_apply_turn_transition_stockpile_deltas computes
-- adjustment_amount correctly and that per-turn flow components reconcile to
-- the actual quantity delta (including admin edits between turns).
--
-- Acceptance criteria (issue #891):
--   AC1: adjustment_amount = 0 when no prior snapshot exists (first turn).
--   AC2: adjustment_amount = quantity_before[N] - quantity_after[N-1] when an
--        admin edit occurred between turns.
--   AC3: Cross-turn reconciliation holds:
--          quantity_after[N] - quantity_after[N-1]
--          = produced[N] - consumed[N] + trade_in[N] - trade_out[N] + adjustment[N]
--   AC4: adjustment_amount surfaces in nation_turn_resource_aggregates view.
--
-- UUID prefix map (unique to this file):
--   dc100000 = users          dc200000 = worlds
--   dc300000 = nations        dc400000 = settlements
--   dc500000 = resources      dc600000 = turn_transitions
begin;

select
  plan (4);

-- ---------------------------------------------------------------------------
-- Fixtures (running as postgres / superuser — bypasses RLS)
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
    'dc100000-0000-0000-0000-000000000001',
    'rsadj-admin@example.com',
    'x',
    now(),
    '{"username":"rsadjust_admin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'dc100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'dc200000-0000-0000-0000-000000000001',
    'RSAdj World',
    4,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'dc200000-0000-0000-0000-000000000001',
    'dc100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'dc300000-0000-0000-0000-000000000001',
    'dc200000-0000-0000-0000-000000000001',
    'RSAdj Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'dc400000-0000-0000-0000-000000000001',
    'dc300000-0000-0000-0000-000000000001',
    'RSAdj Settlement'
  );

-- Resource with a high cap so clamping never triggers in these tests.
insert into
  public.resources (id, world_id, name, slug, base_stockpile_cap)
values
  (
    'dc500000-0000-0000-0000-000000000001',
    'dc200000-0000-0000-0000-000000000001',
    'RSAdj Grain',
    'rsadj-grain',
    100000
  );

-- Two consecutive turn transitions.
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
    'dc600000-0000-0000-0000-000000000001',
    'dc200000-0000-0000-0000-000000000001',
    2,
    3,
    'dc100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'dc600000-0000-0000-0000-000000000002',
    'dc200000-0000-0000-0000-000000000001',
    3,
    4,
    'dc100000-0000-0000-0000-000000000001',
    'running'
  );

-- ---------------------------------------------------------------------------
-- Turn 3 transition: no prior snapshot → adjustment_amount must be 0.
-- Payload: quantityBefore=50, produced=60, consumed=10, quantityAfter=100.
-- ---------------------------------------------------------------------------
select
  public.internal_apply_turn_transition_stockpile_deltas (
    'dc600000-0000-0000-0000-000000000001',
    'dc200000-0000-0000-0000-000000000001',
    3,
    jsonb_build_object(
      'stockpileDeltas',
      jsonb_build_array(
        jsonb_build_object(
          'settlementId',
          'dc400000-0000-0000-0000-000000000001',
          'resourceId',
          'dc500000-0000-0000-0000-000000000001',
          'quantityBefore',
          50,
          'quantityAfter',
          100,
          'produced',
          60,
          'consumed',
          10,
          'tradeIn',
          0,
          'tradeOut',
          0
        )
      )
    )
  );

-- AC1: first turn → adjustment_amount = 0
select
  is (
    (
      select
        adjustment_amount
      from
        public.settlement_turn_resource_snapshots
      where
        settlement_id = 'dc400000-0000-0000-0000-000000000001'
        and resource_id = 'dc500000-0000-0000-0000-000000000001'
        and turn_number = 3
    ),
    0::numeric(18, 4),
    'AC1: adjustment_amount = 0 for first snapshot (no prior turn)'
  );

-- ---------------------------------------------------------------------------
-- Simulate admin edit between turns: stockpile jumped from 100 to 150.
-- Turn 4 transition: quantityBefore=150 (reflects admin edit), produced=10,
-- consumed=5, quantityAfter=155. Expected adjustment_amount = 150 - 100 = 50.
-- ---------------------------------------------------------------------------
select
  public.internal_apply_turn_transition_stockpile_deltas (
    'dc600000-0000-0000-0000-000000000002',
    'dc200000-0000-0000-0000-000000000001',
    4,
    jsonb_build_object(
      'stockpileDeltas',
      jsonb_build_array(
        jsonb_build_object(
          'settlementId',
          'dc400000-0000-0000-0000-000000000001',
          'resourceId',
          'dc500000-0000-0000-0000-000000000001',
          'quantityBefore',
          150,
          'quantityAfter',
          155,
          'produced',
          10,
          'consumed',
          5,
          'tradeIn',
          0,
          'tradeOut',
          0
        )
      )
    )
  );

-- AC2: adjustment_amount = 150 - 100 = 50 (captures the admin edit)
select
  is (
    (
      select
        adjustment_amount
      from
        public.settlement_turn_resource_snapshots
      where
        settlement_id = 'dc400000-0000-0000-0000-000000000001'
        and resource_id = 'dc500000-0000-0000-0000-000000000001'
        and turn_number = 4
    ),
    50::numeric(18, 4),
    'AC2: adjustment_amount equals admin edit delta (quantity_before - prev quantity_after)'
  );

-- AC3: cross-turn reconciliation:
--   quantity_after[4] - quantity_after[3] = produced[4] - consumed[4] + adjustment[4]
--   155 - 100 = 10 - 5 + 50 = 55 ✓
select
  is (
    (
      select
        (
          curr.quantity_after - prev.quantity_after = curr.produced_amount - curr.consumed_amount + curr.trade_in_amount - curr.trade_out_amount + curr.adjustment_amount
        )
      from
        public.settlement_turn_resource_snapshots curr
        join public.settlement_turn_resource_snapshots prev on prev.settlement_id = curr.settlement_id
        and prev.resource_id = curr.resource_id
        and prev.turn_number = curr.turn_number - 1
      where
        curr.settlement_id = 'dc400000-0000-0000-0000-000000000001'
        and curr.resource_id = 'dc500000-0000-0000-0000-000000000001'
        and curr.turn_number = 4
    ),
    true,
    'AC3: quantity_after delta equals produced - consumed + trade + adjustment across turns'
  );

-- AC4: adjustment_amount surfaces in nation_turn_resource_aggregates view.
-- Turn 4 has one settlement with adjustment_amount = 50; view must sum it.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dc100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        adjustment_amount
      from
        public.nation_turn_resource_aggregates
      where
        world_id = 'dc200000-0000-0000-0000-000000000001'
        and nation_id = 'dc300000-0000-0000-0000-000000000001'
        and resource_id = 'dc500000-0000-0000-0000-000000000001'
        and turn_number = 4
    ),
    50::numeric,
    'AC4: adjustment_amount appears in nation_turn_resource_aggregates'
  );

reset role;

select
  *
from
  finish ();

rollback;
