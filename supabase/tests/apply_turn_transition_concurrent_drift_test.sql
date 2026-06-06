-- pgTAP tests for §H9: apply_turn_transition stockpile quantityBefore re-validation.
-- Simulates concurrent drift by manually updating a stockpile between transition
-- creation and the RPC call, verifying that a mismatch raises P0001.
-- Run with: npx supabase test db
--
-- UUID prefix map (all f3-prefixed ranges, unique to this file):
--   f3100000 = users        f3200000 = worlds
--   f3300000 = transitions  f3400000 = nations
--   f3500000 = settlements  f3600000 = resources
begin;

select
  plan (4);

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
    'attcd-superadmin@example.com',
    'x',
    now(),
    '{"username":"attcd_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'f3100000-0000-0000-0000-000000000001';

-- World 1: drift scenario — stockpile is mutated before RPC; expect P0001
-- World 2: clean scenario — stockpile matches payload; expect success
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'f3200000-0000-0000-0000-000000000001',
    'ATTCD Drift World',
    3,
    'private',
    'active'
  ),
  (
    'f3200000-0000-0000-0000-000000000002',
    'ATTCD Clean World',
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
    'ATTCD Nation 1'
  ),
  (
    'f3400000-0000-0000-0000-000000000002',
    'f3200000-0000-0000-0000-000000000002',
    'ATTCD Nation 2'
  );

-- One settlement per world (stockpiles seeded by resource INSERT trigger)
insert into
  public.settlements (id, nation_id, name)
values
  (
    'f3500000-0000-0000-0000-000000000001',
    'f3400000-0000-0000-0000-000000000001',
    'ATTCD Settlement 1'
  ),
  (
    'f3500000-0000-0000-0000-000000000002',
    'f3400000-0000-0000-0000-000000000002',
    'ATTCD Settlement 2'
  );

-- Resources — seed triggers fire on INSERT, creating zero-quantity stockpile rows
insert into
  public.resources (id, world_id, name, slug, base_stockpile_cap)
values
  (
    'f3600000-0000-0000-0000-000000000001',
    'f3200000-0000-0000-0000-000000000001',
    'ATTCD Grain',
    'attcd-grain',
    1000
  ),
  (
    'f3600000-0000-0000-0000-000000000002',
    'f3200000-0000-0000-0000-000000000002',
    'ATTCD Iron',
    'attcd-iron',
    1000
  );

-- Pre-created running transitions (as start_turn_transition would create them)
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
  );

-- ---------------------------------------------------------------------------
-- Simulate concurrent drift: an admin deducts grain from World 1's stockpile
-- between state-load and the RPC call.  The engine computed quantityBefore = 0
-- (from the state load), but an admin has since set quantity = 40.
-- ---------------------------------------------------------------------------
update public.settlement_resource_stockpiles
set
  quantity = 40
where
  settlement_id = 'f3500000-0000-0000-0000-000000000001'
  and resource_id = 'f3600000-0000-0000-0000-000000000001';

-- ===========================================================================
-- All tests run as super admin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f3100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- TEST 1: drift detected — payload claims quantityBefore = 0 but live value is 40
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'f3200000-0000-0000-0000-000000000001',
      3,
      jsonb_build_object(
        'stockpileDeltas',
        jsonb_build_array(
          jsonb_build_object(
            'settlementId',   'f3500000-0000-0000-0000-000000000001',
            'resourceId',     'f3600000-0000-0000-0000-000000000001',
            'quantityBefore', 0,
            'quantityAfter',  50,
            'produced',       50,
            'consumed',       0,
            'tradeIn',        0,
            'tradeOut',       0
          )
        )
      ),
      'f3300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'drift detected: stale quantityBefore raises P0001'
  );

-- ===========================================================================
-- TEST 2: transition status remains 'running' after drift rejection
-- (drift check is outside the failure-capture block, so the transition is
-- not marked 'failed' — it stays 'running' to allow retry with fresh state)
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
    'drift rejection: transition status remains running (not failed)'
  );

-- ===========================================================================
-- TEST 3: stockpile not overwritten after drift rejection
-- ===========================================================================
select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'f3500000-0000-0000-0000-000000000001'
        and resource_id = 'f3600000-0000-0000-0000-000000000001'
    ),
    40::numeric(18, 4),
    'drift rejection: stockpile quantity unchanged (concurrent change preserved)'
  );

-- ===========================================================================
-- TEST 4: no drift — payload quantityBefore matches live value; succeeds
-- World 2 stockpile starts at 0 (seed default) and payload claims 0 — no mismatch
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.apply_turn_transition(
      'f3200000-0000-0000-0000-000000000002',
      3,
      jsonb_build_object(
        'stockpileDeltas',
        jsonb_build_array(
          jsonb_build_object(
            'settlementId',   'f3500000-0000-0000-0000-000000000002',
            'resourceId',     'f3600000-0000-0000-0000-000000000002',
            'quantityBefore', 0,
            'quantityAfter',  25,
            'produced',       25,
            'consumed',       0,
            'tradeIn',        0,
            'tradeOut',       0
          )
        )
      ),
      'f3300000-0000-0000-0000-000000000002'::uuid
    )
    $test$,
    'no drift: matching quantityBefore raises no exception'
  );

reset role;

rollback;
