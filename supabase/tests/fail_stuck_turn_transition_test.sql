-- pgTAP tests for fail_stuck_turn_transition RPC (issue #679).
-- Tests recovery path for turn transitions wedged in 'running' state by
-- persistent pre-apply validation failure.
--
-- Run with: npx supabase test db
--
-- UUID prefix map (all f6-prefixed ranges, unique to this file):
--   f6100000 = users        f6200000 = worlds
--   f6300000 = transitions  f6400000 = nations
--   f6500000 = settlements  f6600000 = resources
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
    'f6100000-0000-0000-0000-000000000001',
    'fsttr-superadmin@example.com',
    'x',
    now(),
    '{"username":"fsttr_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'f6100000-0000-0000-0000-000000000001';

-- World with a running transition (wedged by pre-apply validation failure)
insert into
  public.worlds (
    id,
    name,
    current_turn_number,
    visibility,
    status,
    owner_id
  )
values
  (
    'f6200000-0000-0000-0000-000000000001',
    'FSTTR Stuck World',
    5,
    'private',
    'active',
    'f6100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f6400000-0000-0000-0000-000000000001',
    'f6200000-0000-0000-0000-000000000001',
    'FSTTR Nation 1'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f6500000-0000-0000-0000-000000000001',
    'f6400000-0000-0000-0000-000000000001',
    'FSTTR Settlement 1'
  );

insert into
  public.resources (id, world_id, name, slug, base_stockpile_cap)
values
  (
    'f6600000-0000-0000-0000-000000000001',
    'f6200000-0000-0000-0000-000000000001',
    'FSTTR Test Resource',
    'fsttr-test-resource',
    1000
  );

-- Wedged running transition (from turn 5 → 6, but pre-apply validation failed)
insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status,
    started_at
  )
values
  (
    'f6300000-0000-0000-0000-000000000001',
    'f6200000-0000-0000-0000-000000000001',
    5,
    6,
    'f6100000-0000-0000-0000-000000000001',
    'running',
    now() - interval '2 hours'
  );

-- ===========================================================================
-- All tests run as service_role
-- ===========================================================================
set
  local role service_role;

-- ===========================================================================
-- TEST 1: fail_stuck_turn_transition marks transition as failed
-- ===========================================================================
select
  is (
    (
      select
        status
      from
        public.turn_transitions
      where
        id = 'f6300000-0000-0000-0000-000000000001'
    ),
    'running',
    'precondition: transition starts in running status'
  );

select
  lives_ok (
    $test$
    select public.fail_stuck_turn_transition(
      'f6200000-0000-0000-0000-000000000001',
      'f6300000-0000-0000-0000-000000000001'
    );
    $test$,
    'fail_stuck_turn_transition RPC succeeds'
  );

-- ===========================================================================
-- TEST 2: transition status is now 'failed'
-- ===========================================================================
select
  is (
    (
      select
        status
      from
        public.turn_transitions
      where
        id = 'f6300000-0000-0000-0000-000000000001'
    ),
    'failed',
    'transition marked as failed'
  );

-- ===========================================================================
-- TEST 3: finished_at timestamp is set
-- ===========================================================================
select
  isnt (
    (
      select
        finished_at
      from
        public.turn_transitions
      where
        id = 'f6300000-0000-0000-0000-000000000001'
    ),
    null,
    'finished_at timestamp is set'
  );

-- ===========================================================================
-- TEST 4: world current_turn_number unchanged (not advanced)
-- ===========================================================================
select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = 'f6200000-0000-0000-0000-000000000001'
    ),
    5,
    'world turn did not advance (still at turn 5)'
  );

-- ===========================================================================
-- TEST 5: RPC rejects if transition not in running status
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.fail_stuck_turn_transition(
      'f6200000-0000-0000-0000-000000000001',
      'f6300000-0000-0000-0000-000000000001'
    );
    $test$,
    'P0001',
    null,
    'RPC rejects transition not in running status'
  );

-- ===========================================================================
-- TEST 6: RPC rejects if transition not found
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.fail_stuck_turn_transition(
      'f6200000-0000-0000-0000-000000000001',
      'f6300000-0000-0000-0000-000000000099'
    );
    $test$,
    'P0001',
    null,
    'RPC rejects missing transition'
  );

-- ===========================================================================
-- TEST 7: RPC rejects if world turn has advanced past transition from_turn
-- (safety check: transition is stale if world has moved forward)
-- ===========================================================================
-- Create another wedged transition
insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status,
    started_at
  )
values
  (
    'f6300000-0000-0000-0000-000000000002',
    'f6200000-0000-0000-0000-000000000001',
    3,
    4,
    'f6100000-0000-0000-0000-000000000001',
    'running',
    now() - interval '3 hours'
  );

-- Now advance world turn (simulating that this transition is truly stale)
update public.worlds
set
  current_turn_number = 6
where
  id = 'f6200000-0000-0000-0000-000000000001';

select
  throws_ok (
    $test$
    select public.fail_stuck_turn_transition(
      'f6200000-0000-0000-0000-000000000001',
      'f6300000-0000-0000-0000-000000000002'
    );
    $test$,
    'P0001',
    null,
    'RPC rejects stale transition (world turn advanced past from_turn)'
  );

-- ===========================================================================
-- TEST 8: RPC rejects if world archived
-- ===========================================================================
-- Create yet another world in archived state
insert into
  public.worlds (
    id,
    name,
    current_turn_number,
    visibility,
    status,
    owner_id,
    archived_at
  )
values
  (
    'f6200000-0000-0000-0000-000000000002',
    'FSTTR Archived World',
    5,
    'private',
    'archived',
    'f6100000-0000-0000-0000-000000000001',
    now()
  );

insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status,
    started_at
  )
values
  (
    'f6300000-0000-0000-0000-000000000003',
    'f6200000-0000-0000-0000-000000000002',
    5,
    6,
    'f6100000-0000-0000-0000-000000000001',
    'running',
    now() - interval '1 hour'
  );

select
  throws_ok (
    $test$
    select public.fail_stuck_turn_transition(
      'f6200000-0000-0000-0000-000000000002',
      'f6300000-0000-0000-0000-000000000003'
    );
    $test$,
    'P0001',
    null,
    'RPC rejects archived world'
  );

select
  finish ();

rollback;
