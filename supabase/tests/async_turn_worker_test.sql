-- pgTAP tests for the async turn worker's coordination changes (issue #1278).
--
-- Covers: the enqueue-with-transition exemption (and that it still refuses a
-- foreign running transition), the transition id landing on the job row, the
-- enqueuing user reaching the worker through claim_turn_job, and the
-- turn_transitions.progress_stage column contract.
--
-- Run with: npx supabase test db
--
-- UUID prefix map (all a8-prefixed ranges, unique to this file):
--   a8100000 = users        a8200000 = worlds
--   a8300000 = transitions  a8400000 = jobs
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
    'a8100000-0000-0000-0000-000000000001',
    'atw-superadmin@example.com',
    'x',
    now(),
    '{"username":"atw_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'a8100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'a8200000-0000-0000-0000-000000000001',
    'ATW World One',
    5,
    'active'
  ),
  (
    'a8200000-0000-0000-0000-000000000002',
    'ATW World Two',
    7,
    'active'
  );

-- The request opens its own transition before enqueueing, exactly as the
-- end-turn edge function now does.
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
    'a8300000-0000-0000-0000-000000000001',
    'a8200000-0000-0000-0000-000000000001',
    5,
    6,
    'a8100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'a8300000-0000-0000-0000-000000000002',
    'a8200000-0000-0000-0000-000000000002',
    7,
    8,
    'a8100000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- TEST 1-2: progress_stage column contract
-- ===========================================================================
select
  has_column (
    'public',
    'turn_transitions',
    'progress_stage',
    'turn_transitions has a progress_stage column'
  );

select
  throws_ok (
    $test$
    update public.turn_transitions
    set progress_stage = 'not-a-stage'
    where id = 'a8300000-0000-0000-0000-000000000001'
    $test$,
    '23514',
    null,
    'progress_stage rejects a value outside the allowed set'
  );

select
  lives_ok (
    $test$
    update public.turn_transitions
    set progress_stage = 'simulating'
    where id = 'a8300000-0000-0000-0000-000000000001'
    $test$,
    'progress_stage accepts a worker stage'
  );

-- ===========================================================================
-- TEST 4-6: enqueue_turn_job with the caller's own transition
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a8100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  isnt (
    public.enqueue_turn_job (
      'a8200000-0000-0000-0000-000000000001',
      5,
      'a8300000-0000-0000-0000-000000000001'
    ),
    null,
    'enqueue_turn_job accepts the transition the caller just started'
  );

reset role;

select
  is (
    (
      select
        tj.turn_transition_id
      from
        public.turn_jobs tj
      where
        tj.world_id = 'a8200000-0000-0000-0000-000000000001'
    ),
    'a8300000-0000-0000-0000-000000000001'::uuid,
    'the enqueued job records the transition id'
  );

select
  is (
    (
      select
        tj.enqueued_by_user_id
      from
        public.turn_jobs tj
      where
        tj.world_id = 'a8200000-0000-0000-0000-000000000001'
    ),
    'a8100000-0000-0000-0000-000000000001'::uuid,
    'the enqueued job records the enqueuing user'
  );

-- ===========================================================================
-- TEST 7: a DIFFERENT running transition still blocks the enqueue
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a8100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.enqueue_turn_job (
      'a8200000-0000-0000-0000-000000000002',
      7,
      'a8300000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'a running transition that is not the caller''s still refuses the enqueue'
  );

reset role;

-- ===========================================================================
-- TEST 8-9: claim_turn_job hands the worker what it needs for a retry
-- ===========================================================================
set
  local role service_role;

select
  is (
    (
      public.claim_turn_job ('atw-worker-1') ->> 'enqueuedByUserId'
    ),
    'a8100000-0000-0000-0000-000000000001',
    'claim_turn_job returns the enqueuing user id'
  );

reset role;

select
  is (
    (
      select
        tj.claimed_by
      from
        public.turn_jobs tj
      where
        tj.world_id = 'a8200000-0000-0000-0000-000000000001'
    ),
    'atw-worker-1',
    'the claim is recorded against the worker'
  );

select
  *
from
  finish ();

rollback;
