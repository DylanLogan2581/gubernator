-- pgTAP tests for the turn_jobs queue and claim model (issue #1277).
--
-- Covers: exclusive claim, stale-heartbeat re-claim, idempotent completion,
-- one active job per world, retry/retire semantics, and the worker-only
-- grant posture.
--
-- Run with: npx supabase test db
--
-- UUID prefix map (all a7-prefixed ranges, unique to this file):
--   a7100000 = users        a7200000 = worlds
--   a7300000 = transitions  a7400000 = jobs
begin;

select
  plan (27);

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
    'tjq-superadmin@example.com',
    'x',
    now(),
    '{"username":"tjq_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'a7100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'a7200000-0000-0000-0000-000000000001',
    'TJQ World One',
    5,
    'active'
  ),
  (
    'a7200000-0000-0000-0000-000000000002',
    'TJQ World Two',
    9,
    'active'
  );

-- World two carries a running transition, so it must refuse a new enqueue.
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
    'a7300000-0000-0000-0000-000000000001',
    'a7200000-0000-0000-0000-000000000002',
    9,
    10,
    'a7100000-0000-0000-0000-000000000001',
    'running',
    now()
  );

-- ===========================================================================
-- Structure
-- ===========================================================================
select
  has_table ('public', 'turn_jobs', 'turn_jobs table exists');

select
  ok (
    (
      select
        relrowsecurity
      from
        pg_class
      where
        oid = 'public.turn_jobs'::regclass
    ),
    'row level security is enabled on turn_jobs'
  );

select
  has_index (
    'public',
    'turn_jobs',
    'turn_jobs_one_active_per_world_idx',
    'partial unique index enforces one active job per world'
  );

-- The queue is worker/system-only: no table grants to client roles.
select
  is_empty (
    $test$
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'turn_jobs'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    $test$,
    'authenticated/anon have no write grants on turn_jobs'
  );

-- The claim protocol is worker-only. Asserted on the ACL rather than by
-- calling it as authenticated: a permission-denied function call crashes the
-- local Postgres build, which would take the whole test run down.
select
  ok (
    not has_function_privilege(
      'authenticated',
      'public.claim_turn_job(text, interval)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.complete_turn_job(uuid, text)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.fail_turn_job(uuid, text, text)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.heartbeat_turn_job(uuid, text, uuid)',
      'execute'
    ),
    'the claim protocol is not executable by authenticated'
  );

select
  ok (
    has_function_privilege(
      'service_role',
      'public.claim_turn_job(text, interval)',
      'execute'
    ),
    'the claim protocol is executable by service_role'
  );

-- ===========================================================================
-- Enqueue (admin path)
-- ===========================================================================
set
  local role authenticated;

select
  set_config(
    'request.jwt.claims',
    '{"sub":"a7100000-0000-0000-0000-000000000001","role":"authenticated"}',
    true
  );

select
  isnt (
    public.enqueue_turn_job ('a7200000-0000-0000-0000-000000000001', 5),
    null,
    'enqueue_turn_job returns a job id for a super admin'
  );

-- Idempotent: a second enqueue returns the SAME active job, not a new row.
select
  is (
    (
      select
        count(*)::int
      from
        public.turn_jobs
      where
        world_id = 'a7200000-0000-0000-0000-000000000001'
    ),
    1,
    'precondition: exactly one job enqueued for world one'
  );

select
  is (
    public.enqueue_turn_job ('a7200000-0000-0000-0000-000000000001', 5),
    (
      select
        id
      from
        public.turn_jobs
      where
        world_id = 'a7200000-0000-0000-0000-000000000001'
    ),
    're-enqueue returns the existing active job (one active turn per world)'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.turn_jobs
      where
        world_id = 'a7200000-0000-0000-0000-000000000001'
    ),
    1,
    're-enqueue did not create a second job row'
  );

select
  throws_ok (
    $test$
    select public.enqueue_turn_job('a7200000-0000-0000-0000-000000000001', 4)
    $test$,
    'P0001',
    null,
    'enqueue_turn_job rejects a stale expected turn number'
  );

-- One active turn per world: the running transition on world two (inserted in
-- the fixtures) blocks enqueue.
select
  throws_ok (
    $test$
    select public.enqueue_turn_job('a7200000-0000-0000-0000-000000000002', 9)
    $test$,
    'P0001',
    null,
    'enqueue_turn_job refuses while a turn transition is running for the world'
  );

reset role;

select
  set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- Claim protocol (worker path)
-- ===========================================================================
set
  local role service_role;

select
  is (
    (public.claim_turn_job ('worker-a') ->> 'worldId')::uuid,
    'a7200000-0000-0000-0000-000000000001'::uuid,
    'worker-a claims the pending job'
  );

-- Exclusive claim: the job is no longer claimable while its heartbeat is fresh,
-- so a second, concurrent claimer gets nothing rather than the same job.
select
  is (
    public.claim_turn_job ('worker-b'),
    null,
    'a second claimer cannot take an already-claimed job'
  );

select
  is (
    (
      select
        claimed_by
      from
        public.turn_jobs
      where
        world_id = 'a7200000-0000-0000-0000-000000000001'
    ),
    'worker-a',
    'the job is still owned by the first claimer'
  );

select
  ok (
    public.heartbeat_turn_job (
      (
        select
          id
        from
          public.turn_jobs
        where
          world_id = 'a7200000-0000-0000-0000-000000000001'
      ),
      'worker-a',
      null
    ),
    'the claimant can heartbeat its job'
  );

select
  ok (
    not public.heartbeat_turn_job (
      (
        select
          id
        from
          public.turn_jobs
        where
          world_id = 'a7200000-0000-0000-0000-000000000001'
      ),
      'worker-b',
      null
    ),
    'a non-claimant cannot heartbeat the job'
  );

-- ===========================================================================
-- Crash recovery: a stale heartbeat makes the claim re-claimable, and the
-- crashed worker is fenced out afterwards.
-- ===========================================================================
update public.turn_jobs
set
  heartbeat_at = now() - interval '30 minutes'
where
  world_id = 'a7200000-0000-0000-0000-000000000001';

select
  is (
    public.claim_turn_job ('worker-b') ->> 'claimedBy',
    'worker-b',
    'a crashed claim (stale heartbeat) is re-claimable'
  );

select
  is (
    (
      select
        attempts
      from
        public.turn_jobs
      where
        world_id = 'a7200000-0000-0000-0000-000000000001'
    ),
    2,
    're-claim increments attempts'
  );

select
  ok (
    not public.complete_turn_job (
      (
        select
          id
        from
          public.turn_jobs
        where
          world_id = 'a7200000-0000-0000-0000-000000000001'
      ),
      'worker-a'
    ),
    'the fenced-out crashed worker cannot complete the re-claimed job'
  );

-- ===========================================================================
-- Idempotent completion
-- ===========================================================================
select
  ok (
    public.complete_turn_job (
      (
        select
          id
        from
          public.turn_jobs
        where
          world_id = 'a7200000-0000-0000-0000-000000000001'
      ),
      'worker-b'
    ),
    'the current claimant completes the job'
  );

select
  ok (
    not public.complete_turn_job (
      (
        select
          id
        from
          public.turn_jobs
        where
          world_id = 'a7200000-0000-0000-0000-000000000001'
      ),
      'worker-b'
    ),
    'completing an already-completed job is a no-op (no double-apply)'
  );

select
  is (
    (
      select
        status
      from
        public.turn_jobs
      where
        world_id = 'a7200000-0000-0000-0000-000000000001'
    ),
    'completed',
    'the completed job stays completed'
  );

-- ===========================================================================
-- Retry / retire semantics
-- ===========================================================================
insert into
  public.turn_jobs (id, world_id, from_turn_number, max_attempts)
values
  (
    'a7400000-0000-0000-0000-000000000001',
    'a7200000-0000-0000-0000-000000000002',
    9,
    2
  );

select
  is (
    public.claim_turn_job ('worker-c') ->> 'jobId',
    'a7400000-0000-0000-0000-000000000001',
    'a completed world job frees the slot for the next job'
  );

select
  is (
    public.fail_turn_job (
      'a7400000-0000-0000-0000-000000000001',
      'worker-c',
      'boom'
    ),
    'pending',
    'failing below max_attempts returns the job to pending for retry'
  );

select
  lives_ok (
    $test$
    select public.claim_turn_job('worker-c')
    $test$,
    'the retried job is claimable again'
  );

select
  is (
    public.fail_turn_job (
      'a7400000-0000-0000-0000-000000000001',
      'worker-c',
      'boom again'
    ),
    'failed',
    'failing at max_attempts retires the job as failed'
  );

select
  *
from
  finish ();

rollback;
