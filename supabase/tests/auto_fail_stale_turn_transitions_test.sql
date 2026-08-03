-- pgTAP tests for public.auto_fail_stale_turn_transitions() (issue #1404).
--
-- A turn transition whose worker stopped heartbeating is failed, so a dead
-- worker cannot freeze a world indefinitely behind the running-turn write
-- guard.
--
-- Run with: npx supabase test db
--
-- UUID prefix map (all d2-prefixed ranges, unique to this file):
--   d2100000 = users        d2200000 = worlds
--   d2400000 = turn_transitions   d2500000 = turn_jobs
begin;

select
  plan (8);

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
    'd2100000-0000-0000-0000-000000000001',
    'afstt-admin@example.com',
    'x',
    now(),
    '{"username":"afstt_admin"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'd2200000-0000-0000-0000-000000000001',
    'AFSTT Stale World',
    5,
    'active'
  ),
  (
    'd2200000-0000-0000-0000-000000000002',
    'AFSTT Live World',
    5,
    'active'
  ),
  (
    'd2200000-0000-0000-0000-000000000003',
    'AFSTT Done World',
    5,
    'active'
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
    'd2400000-0000-0000-0000-000000000001',
    'd2200000-0000-0000-0000-000000000001',
    5,
    6,
    'd2100000-0000-0000-0000-000000000001',
    'running',
    now() - interval '1 hour'
  ),
  (
    'd2400000-0000-0000-0000-000000000002',
    'd2200000-0000-0000-0000-000000000002',
    5,
    6,
    'd2100000-0000-0000-0000-000000000001',
    'running',
    now() - interval '1 hour'
  ),
  (
    'd2400000-0000-0000-0000-000000000003',
    'd2200000-0000-0000-0000-000000000003',
    5,
    6,
    'd2100000-0000-0000-0000-000000000001',
    'completed',
    now() - interval '1 hour'
  );

-- One stale heartbeat, one fresh, one already finished.
insert into
  public.turn_jobs (
    id,
    world_id,
    from_turn_number,
    turn_transition_id,
    status,
    claimed_by,
    claimed_at,
    heartbeat_at
  )
values
  (
    'd2500000-0000-0000-0000-000000000001',
    'd2200000-0000-0000-0000-000000000001',
    5,
    'd2400000-0000-0000-0000-000000000001',
    'claimed',
    'worker-a',
    now() - interval '1 hour',
    now() - interval '30 minutes'
  ),
  (
    'd2500000-0000-0000-0000-000000000002',
    'd2200000-0000-0000-0000-000000000002',
    5,
    'd2400000-0000-0000-0000-000000000002',
    'claimed',
    'worker-b',
    now() - interval '1 hour',
    now()
  ),
  (
    'd2500000-0000-0000-0000-000000000003',
    'd2200000-0000-0000-0000-000000000003',
    5,
    'd2400000-0000-0000-0000-000000000003',
    'completed',
    'worker-c',
    now() - interval '1 hour',
    now() - interval '55 minutes'
  );

-- ---------------------------------------------------------------------------
-- Behaviour
-- ---------------------------------------------------------------------------
select
  is (
    public.auto_fail_stale_turn_transitions ('10 minutes'::interval),
    1,
    'exactly one stale transition is failed'
  );

select
  is (
    (
      select
        status
      from
        public.turn_transitions
      where
        id = 'd2400000-0000-0000-0000-000000000001'
    ),
    'failed',
    'the stale transition is marked failed'
  );

select
  isnt (
    (
      select
        finished_at
      from
        public.turn_transitions
      where
        id = 'd2400000-0000-0000-0000-000000000001'
    ),
    null,
    'the stale transition records finished_at'
  );

select
  is (
    (
      select
        status
      from
        public.turn_transitions
      where
        id = 'd2400000-0000-0000-0000-000000000002'
    ),
    'running',
    'a transition with a fresh heartbeat is untouched'
  );

select
  is (
    (
      select
        status
      from
        public.turn_transitions
      where
        id = 'd2400000-0000-0000-0000-000000000003'
    ),
    'completed',
    'a finished transition is untouched'
  );

select
  is (
    public.auto_fail_stale_turn_transitions ('10 minutes'::interval),
    0,
    'a second sweep finds nothing left to fail'
  );

-- ---------------------------------------------------------------------------
-- Grants: system-only, never reachable from a client role.
-- ---------------------------------------------------------------------------
select
  ok (
    not has_function_privilege(
      'authenticated',
      'public.auto_fail_stale_turn_transitions(interval)',
      'execute'
    ),
    'authenticated cannot execute auto_fail_stale_turn_transitions'
  );

-- ---------------------------------------------------------------------------
-- The pg_cron entry exists wherever the extension is loaded.
-- ---------------------------------------------------------------------------
-- Referenced through dynamic SQL: cron.job does not exist to be parsed at all
-- where the extension is absent, which is exactly the case being tolerated.
create function pg_temp.afstt_cron_job_scheduled () returns boolean language plpgsql as $$
declare
  v_scheduled boolean;
begin
  if to_regclass('cron.job') is null then
    return true;
  end if;

  execute 'select exists (select 1 from cron.job where jobname = $1)'
    into v_scheduled
    using 'auto-fail-stale-turn-transitions';

  return v_scheduled;
end;
$$;

select
  ok (
    pg_temp.afstt_cron_job_scheduled (),
    'the five-minute cron job is scheduled where pg_cron is loaded'
  );

select
  *
from
  finish ();

rollback;
