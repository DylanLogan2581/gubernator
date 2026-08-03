-- pgTAP tests for Task 1.3: automatic nightly retention via pg_cron.
-- Covers:
--   1. public.run_scheduled_retention() exists, loops every world, and prunes
--      each one via internal_prune_world_retention (proven with two worlds).
--   2. A cron.job row named 'nightly-retention' exists -- guarded: skipped
--      when pg_cron is not loaded in this environment (e.g. some CI images),
--      so the suite passes whether or not pg_cron is available.
--
-- UUID prefix map (cb9-prefixed range, unique to this file):
--   cb9100000 = users   cb9200000 = world A   cb9300000 = world B
--   cb9600000 = turn_transitions
begin;

select
  plan (6);

-- ---------------------------------------------------------------------------
-- Setup: one user (turn_transitions.initiated_by_user_id is not null), two
-- worlds, each at current_turn_number = 300 with no retention config row
-- (defaults apply: log_retention_turns = 200 -> cutoff = 100).
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
    'cb910000-0000-0000-0000-000000000001',
    'retention-cron@example.com',
    'x',
    now(),
    '{"username":"retention_cron_user"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'cb920000-0000-0000-0000-000000000001',
    'Retention Cron World A',
    300,
    'active'
  ),
  (
    'cb930000-0000-0000-0000-000000000001',
    'Retention Cron World B',
    300,
    'active'
  );

-- One old (to_turn_number=50, prunable) completed transition per world, each
-- carrying a turn_log_entries row.
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
    'cb960000-0000-0000-0000-00000000000a',
    'cb920000-0000-0000-0000-000000000001',
    49,
    50,
    'cb910000-0000-0000-0000-000000000001',
    'completed'
  ),
  (
    'cb960000-0000-0000-0000-00000000000b',
    'cb930000-0000-0000-0000-000000000001',
    49,
    50,
    'cb910000-0000-0000-0000-000000000001',
    'completed'
  );

insert into
  public.turn_log_entries (id, turn_transition_id, world_id, log_category)
values
  (
    gen_random_uuid(),
    'cb960000-0000-0000-0000-00000000000a',
    'cb920000-0000-0000-0000-000000000001',
    'retention_cron_test'
  ),
  (
    gen_random_uuid(),
    'cb960000-0000-0000-0000-00000000000b',
    'cb930000-0000-0000-0000-000000000001',
    'retention_cron_test'
  );

-- ---------------------------------------------------------------------------
-- Setup verification: both worlds start with 1 prunable log row.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)
      from
        public.turn_log_entries
      where
        world_id in (
          'cb920000-0000-0000-0000-000000000001',
          'cb930000-0000-0000-0000-000000000001'
        )
    ),
    2::bigint,
    'Setup: 2 old turn_log_entries rows, one per world'
  );

-- ---------------------------------------------------------------------------
-- Test: run_scheduled_retention exists.
-- ---------------------------------------------------------------------------
select
  has_function (
    'public',
    'run_scheduled_retention',
    array[]::text[],
    'public.run_scheduled_retention() exists'
  );

-- ---------------------------------------------------------------------------
-- Test: calling it prunes the old row from BOTH worlds in one pass.
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $$select public.run_scheduled_retention()$$,
    'run_scheduled_retention() executes without error'
  );

select
  is (
    (
      select
        count(*)
      from
        public.turn_log_entries
      where
        world_id = 'cb920000-0000-0000-0000-000000000001'
    ),
    0::bigint,
    'World A: old turn_log_entries row pruned by run_scheduled_retention'
  );

select
  is (
    (
      select
        count(*)
      from
        public.turn_log_entries
      where
        world_id = 'cb930000-0000-0000-0000-000000000001'
    ),
    0::bigint,
    'World B: old turn_log_entries row pruned by run_scheduled_retention'
  );

-- ---------------------------------------------------------------------------
-- Test: a nightly-retention cron.job row exists -- guarded, since pg_cron may
-- not be loadable in every environment (requires shared_preload_libraries).
--
-- The cron.job reference is issued via dynamic SQL (execute ... into) inside
-- a pg_temp function so it is only parsed/resolved when pg_cron is actually
-- loaded; a static "from cron.job" would fail to parse outright (schema
-- "cron" does not exist) whenever the extension is absent, regardless of any
-- runtime branch guarding it.
-- ---------------------------------------------------------------------------
create function pg_temp.assert_nightly_retention_cron_job () returns text language plpgsql as $$
declare
  v_count bigint;
begin
  if (
    select count(*) from pg_extension where extname = 'pg_cron'
  ) = 0 then
    return skip (1, 'pg_cron not loaded');
  end if;

  execute 'select count(*) from cron.job where jobname = $1'
    into v_count
    using 'nightly-retention';

  return is (v_count, 1::bigint, 'cron.job row nightly-retention exists');
end;
$$;

select
  pg_temp.assert_nightly_retention_cron_job ();

select
  *
from
  finish ();

rollback;
