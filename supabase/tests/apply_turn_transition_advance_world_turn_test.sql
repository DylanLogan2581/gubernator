-- pgTAP tests for §C35: apply_turn_transition world-turn advance and
-- settlement readiness reset.
-- Run with: npx supabase test db
--
-- UUID prefix map (all d5-prefixed ranges, unique to this file):
--   d5100000 = users        d5200000 = worlds
--   d5300000 = nations      d5400000 = settlements
--   d5500000 = citizens
begin;

select
  plan (9);

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
    'd5100000-0000-0000-0000-000000000001',
    'attawt-superadmin@example.com',
    'x',
    now(),
    '{"username":"attawt_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'd5100000-0000-0000-0000-000000000001';

-- Four worlds, one per scenario:
--   World 1 (turn 3): world-turn advance + result JSON
--   World 2 (turn 5): settlement readiness reset (two settlements)
--   World 3 (turn 7): transition finalisation + readiness_summary_jsonb
--   World 4 (turn 9): double-call safety
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
    'd5200000-0000-0000-0000-000000000001',
    'ATTAWT World 1',
    'd5100000-0000-0000-0000-000000000001',
    3,
    'private',
    'active'
  ),
  (
    'd5200000-0000-0000-0000-000000000002',
    'ATTAWT World 2',
    'd5100000-0000-0000-0000-000000000001',
    5,
    'private',
    'active'
  ),
  (
    'd5200000-0000-0000-0000-000000000003',
    'ATTAWT World 3',
    'd5100000-0000-0000-0000-000000000001',
    7,
    'private',
    'active'
  ),
  (
    'd5200000-0000-0000-0000-000000000004',
    'ATTAWT World 4',
    'd5100000-0000-0000-0000-000000000001',
    9,
    'private',
    'active'
  );

-- Nations (one per world)
insert into
  public.nations (id, world_id, name)
values
  (
    'd5300000-0000-0000-0000-000000000001',
    'd5200000-0000-0000-0000-000000000001',
    'ATTAWT Nation 1'
  ),
  (
    'd5300000-0000-0000-0000-000000000002',
    'd5200000-0000-0000-0000-000000000002',
    'ATTAWT Nation 2'
  ),
  (
    'd5300000-0000-0000-0000-000000000003',
    'd5200000-0000-0000-0000-000000000003',
    'ATTAWT Nation 3'
  ),
  (
    'd5300000-0000-0000-0000-000000000004',
    'd5200000-0000-0000-0000-000000000004',
    'ATTAWT Nation 4'
  );

-- Settlements
insert into
  public.settlements (id, nation_id, name)
values
  -- World 1: one settlement
  (
    'd5400000-0000-0000-0000-000000000001',
    'd5300000-0000-0000-0000-000000000001',
    'ATTAWT Settlement 1'
  ),
  -- World 2: two settlements with contrasting auto_ready_enabled values
  (
    'd5400000-0000-0000-0000-000000000002',
    'd5300000-0000-0000-0000-000000000002',
    'ATTAWT Settlement 2A'
  ),
  (
    'd5400000-0000-0000-0000-000000000003',
    'd5300000-0000-0000-0000-000000000002',
    'ATTAWT Settlement 2B'
  ),
  -- World 3: one settlement
  (
    'd5400000-0000-0000-0000-000000000004',
    'd5300000-0000-0000-0000-000000000003',
    'ATTAWT Settlement 3'
  ),
  -- World 4: one settlement
  (
    'd5400000-0000-0000-0000-000000000005',
    'd5300000-0000-0000-0000-000000000004',
    'ATTAWT Settlement 4'
  );

-- NPC citizen used as ready_set_by_citizen_id on settlement 2A
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status
  )
values
  (
    'd5500000-0000-0000-0000-000000000001',
    'd5200000-0000-0000-0000-000000000002',
    'd5400000-0000-0000-0000-000000000002',
    'npc',
    'ATTAWT Citizen',
    'alive'
  );

-- Prepare settlement 2A: auto_ready_enabled=true, manually marked not-ready with
-- ready_set_at and ready_set_by_citizen_id set so we can verify they are cleared.
update public.settlements
set
  auto_ready_enabled = true,
  is_ready_current_turn = false,
  ready_set_at = now(),
  ready_set_by_citizen_id = 'd5500000-0000-0000-0000-000000000001'
where
  id = 'd5400000-0000-0000-0000-000000000002';

-- Prepare settlement 2B: auto_ready_enabled=false, currently marked ready so we
-- can verify it is reset to false.
update public.settlements
set
  auto_ready_enabled = false,
  is_ready_current_turn = true
where
  id = 'd5400000-0000-0000-0000-000000000003';

-- ---------------------------------------------------------------------------
-- Authenticate as super admin so the RPC's auth check passes
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d5100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- World 1 — world-turn advance and result JSON
-- ===========================================================================
-- Test 1: result JSON includes currentTurnNumber = 4
select
  is (
    (
      select
        (
          public.apply_turn_transition (
            'd5200000-0000-0000-0000-000000000001',
            3,
            '{}'::jsonb
          ) ->> 'currentTurnNumber'
        )::integer
    ),
    4,
    'result JSON currentTurnNumber equals p_expected_turn_number + 1'
  );

-- Test 2: worlds.current_turn_number advances from 3 to 4 in the database
select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = 'd5200000-0000-0000-0000-000000000001'
    ),
    4,
    'worlds.current_turn_number advances exactly once to p_expected_turn_number + 1'
  );

-- ===========================================================================
-- World 2 — settlement readiness reset
-- ===========================================================================
select
  public.apply_turn_transition (
    'd5200000-0000-0000-0000-000000000002',
    5,
    '{}'::jsonb
  );

-- Test 3: settlement with auto_ready_enabled=true gets is_ready_current_turn=true
select
  is (
    (
      select
        is_ready_current_turn
      from
        public.settlements
      where
        id = 'd5400000-0000-0000-0000-000000000002'
    ),
    true,
    'settlement with auto_ready_enabled=true has is_ready_current_turn=true after reset'
  );

-- Test 4: settlement with auto_ready_enabled=false gets is_ready_current_turn=false
select
  is (
    (
      select
        is_ready_current_turn
      from
        public.settlements
      where
        id = 'd5400000-0000-0000-0000-000000000003'
    ),
    false,
    'settlement with auto_ready_enabled=false has is_ready_current_turn=false after reset'
  );

-- Test 5: ready_set_at and ready_set_by_citizen_id are cleared regardless of auto_ready_enabled
select
  is (
    (
      select
        row (ready_set_at, ready_set_by_citizen_id)
      from
        public.settlements
      where
        id = 'd5400000-0000-0000-0000-000000000002'
    ),
    row (null::timestamptz, null::uuid),
    'ready_set_at and ready_set_by_citizen_id are NULL after readiness reset'
  );

-- ===========================================================================
-- World 3 — transition finalisation and readiness_summary_jsonb
-- ===========================================================================
select
  public.apply_turn_transition (
    'd5200000-0000-0000-0000-000000000003',
    7,
    '{"readinessSummary": {"allReady": true, "readyCount": 2}}'::jsonb
  );

-- Test 6: transition row has status='completed' and finished_at IS NOT NULL
select
  is (
    (
      select
        row (tt.status, tt.finished_at is not null)
      from
        public.turn_transitions tt
      where
        tt.world_id = 'd5200000-0000-0000-0000-000000000003'
        and tt.from_turn_number = 7
    ),
    row ('completed'::text, true),
    'transition row is completed with a non-null finished_at'
  );

-- Test 7: readiness_summary_jsonb on the transition matches the payload key
select
  is (
    (
      select
        tt.readiness_summary_jsonb
      from
        public.turn_transitions tt
      where
        tt.world_id = 'd5200000-0000-0000-0000-000000000003'
        and tt.from_turn_number = 7
    ),
    '{"allReady": true, "readyCount": 2}'::jsonb,
    'readiness_summary_jsonb stores the readinessSummary from the payload'
  );

-- ===========================================================================
-- World 4 — double-call safety: first call advances turn, second call raises P0001
-- ===========================================================================
select
  public.apply_turn_transition (
    'd5200000-0000-0000-0000-000000000004',
    9,
    '{}'::jsonb
  );

-- Test 8: second call with the same p_expected_turn_number raises P0001
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'd5200000-0000-0000-0000-000000000004',
      9,
      '{}'::jsonb
    )
  $test$,
    'P0001',
    null,
    'second call with same expected_turn_number raises P0001 (stale turn — safe no-op)'
  );

-- Test 9: world current_turn_number is 10 (advanced exactly once, not twice)
select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = 'd5200000-0000-0000-0000-000000000004'
    ),
    10,
    'world current_turn_number is 10 after one successful call — advanced exactly once'
  );

reset role;

rollback;
