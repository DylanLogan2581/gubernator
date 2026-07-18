-- pgTAP tests for the partitioning of public.turn_log_entries (Task 1.6b).
-- Covers:
--   * the table is LIST-partitioned (by world_id)
--   * ensure_turn_log_partition + insert routes rows to the correct per-world
--     partition (tableoid::regclass)
--   * append-only write-posture holds on CHILD partitions (DEFAULT and a
--     runtime-created world partition): authenticated has no INSERT/UPDATE/
--     DELETE, but retains SELECT
--   * RLS SELECT is still enforced (member sees, non-member does not)
--   * the validate_turn_log_entry_scope BEFORE trigger still fires on the
--     partitioned parent (a cross-scope nation_id still raises)
--
-- UUID range (unique to this file): e1=users e2=worlds e3=nations
--   e4=settlements e5=turn_transitions
begin;

select
  plan (10);

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
    'e1000000-0000-0000-0000-000000000001',
    'tlp-admin@example.com',
    'x',
    now(),
    '{"username":"tlp_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'tlp-outsider@example.com',
    'x',
    now(),
    '{"username":"tlp_outsider"}'::jsonb,
    now(),
    now()
  );

-- World A (member's) and World B (outsider's, source of a cross-scope nation).
insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'e2000000-0000-0000-0000-00000000000a',
    'Turn Log Partition World A',
    5,
    'active'
  ),
  (
    'e2000000-0000-0000-0000-00000000000b',
    'Turn Log Partition World B',
    5,
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e2000000-0000-0000-0000-00000000000a',
    'e1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-00000000000a',
    'e2000000-0000-0000-0000-00000000000a',
    'Nation A'
  ),
  (
    'e3000000-0000-0000-0000-00000000000b',
    'e2000000-0000-0000-0000-00000000000b',
    'Nation B'
  );

-- Create the world A partition the way the turn engine does, then insert a row
-- directly (postgres role bypasses RLS/grants, mirroring the SECURITY DEFINER
-- RPC). turn_transition_id is NULL so the MATCH SIMPLE composite FK is skipped.
select
  public.ensure_turn_log_partition ('e2000000-0000-0000-0000-00000000000a');

insert into
  public.turn_log_entries (
    id,
    turn_transition_id,
    world_id,
    log_category,
    payload_jsonb
  )
values
  (
    'e6000000-0000-0000-0000-00000000000a',
    null,
    'e2000000-0000-0000-0000-00000000000a',
    'transition.completed',
    '{"message":"world A"}'::jsonb
  );

-- ===========================================================================
-- Structural: table is partitioned by LIST
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        pg_partitioned_table
      where
        partrelid = 'public.turn_log_entries'::regclass
    ),
    1,
    'turn_log_entries is a partitioned table'
  );

select
  is (
    (
      select
        partstrat::text
      from
        pg_partitioned_table
      where
        partrelid = 'public.turn_log_entries'::regclass
    ),
    'l',
    'partition strategy is LIST (by world_id)'
  );

-- ===========================================================================
-- Routing: the world A row lands in its dedicated per-world partition
-- ===========================================================================
select
  is (
    (
      select
        tableoid::regclass
      from
        public.turn_log_entries
      where
        id = 'e6000000-0000-0000-0000-00000000000a'
    ),
    (
      'public.turn_log_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '')
    )::regclass,
    'world A row routes to its dedicated per-world partition'
  );

-- ===========================================================================
-- Append-only posture must hold on CHILD partitions, not just the parent.
-- Child partitions are ordinary public tables and keep Supabase's default broad
-- authenticated write grants unless explicitly revoked.
-- ===========================================================================
select
  ok (
    not has_table_privilege(
      'authenticated',
      'public.turn_log_entries_p_default',
      'INSERT'
    )
    and not has_table_privilege(
      'authenticated',
      'public.turn_log_entries_p_default',
      'UPDATE'
    )
    and not has_table_privilege(
      'authenticated',
      'public.turn_log_entries_p_default',
      'DELETE'
    ),
    'DEFAULT partition denies direct authenticated INSERT/UPDATE/DELETE (append-only)'
  );

select
  ok (
    not has_table_privilege(
      'authenticated',
      (
        'public.turn_log_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '')
      ),
      'INSERT'
    )
    and not has_table_privilege(
      'authenticated',
      (
        'public.turn_log_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '')
      ),
      'UPDATE'
    )
    and not has_table_privilege(
      'authenticated',
      (
        'public.turn_log_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '')
      ),
      'DELETE'
    ),
    'runtime-created world partition denies direct authenticated INSERT/UPDATE/DELETE (append-only)'
  );

select
  ok (
    has_table_privilege(
      'authenticated',
      (
        'public.turn_log_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '')
      ),
      'SELECT'
    ),
    'runtime-created world partition still grants authenticated SELECT'
  );

-- ===========================================================================
-- RLS SELECT still enforced through the partitioned parent
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.turn_log_entries
      where
        world_id = 'e2000000-0000-0000-0000-00000000000a'
    ),
    'world admin (member) can read world A turn log entries'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_log_entries
      where
        world_id = 'e2000000-0000-0000-0000-00000000000a'
    ),
    0,
    'non-member cannot read world A turn log entries (RLS SELECT enforced)'
  );

reset role;

-- ===========================================================================
-- The validate_turn_log_entry_scope BEFORE trigger still fires on the
-- partitioned parent: a partition-routed insert whose nation_id belongs to a
-- DIFFERENT world must still raise check_violation (23514).
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.turn_log_entries (
      turn_transition_id,
      world_id,
      nation_id,
      log_category
    )
    values (
      null,
      'e2000000-0000-0000-0000-00000000000a',
      'e3000000-0000-0000-0000-00000000000b',
      'transition.cross_scope'
    )
  $test$,
    '23514',
    null,
    'validate-scope trigger fires on partitioned insert: cross-world nation_id raises'
  );

-- A valid same-world nation_id inserts cleanly (routes to world A partition).
select
  lives_ok (
    $test$
    insert into public.turn_log_entries (
      turn_transition_id,
      world_id,
      nation_id,
      log_category
    )
    values (
      null,
      'e2000000-0000-0000-0000-00000000000a',
      'e3000000-0000-0000-0000-00000000000a',
      'transition.in_scope'
    )
  $test$,
    'validate-scope trigger permits a same-world nation_id on the partitioned table'
  );

select
  finish ();

rollback;
