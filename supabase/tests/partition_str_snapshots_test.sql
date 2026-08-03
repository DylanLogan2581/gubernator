-- pgTAP tests for the partitioning of public.settlement_turn_resource_snapshots
-- (Task 1.6a). Covers:
--   * the table is LIST-partitioned (by world_id)
--   * ensure_str_snapshot_partitions + insert routes rows to the correct
--     per-world / per-100-turn-window sub-partition
--   * ON CONFLICT ON CONSTRAINT dedup still works on the partitioned parent
--   * RLS SELECT is still enforced (member sees, non-member does not)
--   * RETENTION REGRESSION: internal_prune_batch_delete, when pruning one
--     world's old turn-window, must NOT delete another world's rows or the same
--     world's kept window. This fails on the pre-fix ctid-only delete (ctid is
--     not unique across partitions) and passes with the (tableoid, ctid) fix.
--
-- UUID ranges (unique to this file):
--   f1xxxxxx = users   f2xxxxxx = worlds   f3xxxxxx = nations
--   f4xxxxxx = settlements   f5xxxxxx = turn_transitions   f6xxxxxx = resources
begin;

select
  plan (13);

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
    'f1000000-0000-0000-0000-000000000001',
    'part-admin@example.com',
    'x',
    now(),
    '{"username":"part_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000003',
    'part-outsider@example.com',
    'x',
    now(),
    '{"username":"part_outsider"}'::jsonb,
    now(),
    now()
  );

-- World A (the pruned world) and World B (must stay untouched).
insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'f2000000-0000-0000-0000-00000000000a',
    'Partition World A',
    210,
    'active'
  ),
  (
    'f2000000-0000-0000-0000-00000000000b',
    'Partition World B',
    50,
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f2000000-0000-0000-0000-00000000000a',
    'f1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f3000000-0000-0000-0000-00000000000a',
    'f2000000-0000-0000-0000-00000000000a',
    'Nation A'
  ),
  (
    'f3000000-0000-0000-0000-00000000000b',
    'f2000000-0000-0000-0000-00000000000b',
    'Nation B'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f4000000-0000-0000-0000-00000000000a',
    'f3000000-0000-0000-0000-00000000000a',
    'Settlement A'
  ),
  (
    'f4000000-0000-0000-0000-00000000000b',
    'f3000000-0000-0000-0000-00000000000b',
    'Settlement B'
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'f6000000-0000-0000-0000-00000000000a',
    'f2000000-0000-0000-0000-00000000000a',
    'Part Grain A',
    'part-grain-a'
  ),
  (
    'f6000000-0000-0000-0000-00000000000b',
    'f2000000-0000-0000-0000-00000000000b',
    'Part Grain B',
    'part-grain-b'
  );

insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status,
    finished_at
  )
values
  (
    'f5000000-0000-0000-0000-00000000000b',
    'f2000000-0000-0000-0000-00000000000b',
    4,
    5,
    'f1000000-0000-0000-0000-000000000001',
    'completed',
    now()
  );

-- Create partitions the way the turn engine does, then insert rows directly
-- (postgres role bypasses RLS/grants, mirroring the SECURITY DEFINER RPC).
select
  public.ensure_str_snapshot_partitions ('f2000000-0000-0000-0000-00000000000a', 5);

select
  public.ensure_str_snapshot_partitions ('f2000000-0000-0000-0000-00000000000a', 150);

select
  public.ensure_str_snapshot_partitions ('f2000000-0000-0000-0000-00000000000b', 5);

insert into
  public.settlement_turn_resource_snapshots (
    turn_transition_id,
    world_id,
    settlement_id,
    resource_id,
    turn_number,
    quantity_before,
    quantity_after
  )
values
  -- World A: window 0 (turn 5, will be pruned) and window 1 (turn 150, kept).
  (
    null,
    'f2000000-0000-0000-0000-00000000000a',
    'f4000000-0000-0000-0000-00000000000a',
    'f6000000-0000-0000-0000-00000000000a',
    5,
    100.0,
    90.0
  ),
  (
    null,
    'f2000000-0000-0000-0000-00000000000a',
    'f4000000-0000-0000-0000-00000000000a',
    'f6000000-0000-0000-0000-00000000000a',
    150,
    70.0,
    60.0
  ),
  -- World B: window 0 (turn 5). Must survive a World A prune.
  (
    null,
    'f2000000-0000-0000-0000-00000000000b',
    'f4000000-0000-0000-0000-00000000000b',
    'f6000000-0000-0000-0000-00000000000b',
    5,
    30.0,
    20.0
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
        partrelid = 'public.settlement_turn_resource_snapshots'::regclass
    ),
    1,
    'settlement_turn_resource_snapshots is a partitioned table'
  );

select
  is (
    (
      select
        partstrat::text
      from
        pg_partitioned_table
      where
        partrelid = 'public.settlement_turn_resource_snapshots'::regclass
    ),
    'l',
    'partition strategy is LIST (by world_id)'
  );

-- ===========================================================================
-- Routing: rows land in the expected per-world / per-window sub-partition
-- ===========================================================================
select
  is (
    (
      select
        tableoid::regclass
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'f2000000-0000-0000-0000-00000000000a'
        and turn_number = 150
    ),
    (
      'public.str_snap_w_' || replace('f2000000-0000-0000-0000-00000000000a', '-', '') || '_t100'
    )::regclass,
    'world A turn 150 routes to its window-1 (t100) sub-partition'
  );

select
  is (
    (
      select
        tableoid::regclass
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'f2000000-0000-0000-0000-00000000000b'
        and turn_number = 5
    ),
    (
      'public.str_snap_w_' || replace('f2000000-0000-0000-0000-00000000000b', '-', '') || '_t0'
    )::regclass,
    'world B turn 5 routes to its window-0 (t0) sub-partition'
  );

-- ===========================================================================
-- Append-only posture must hold on CHILD partitions, not just the parent.
-- Child partitions are ordinary public tables and keep Supabase's default broad
-- authenticated write grants unless explicitly revoked; combined with the child
-- insert policy (world admin OR super admin) a world admin could otherwise POST
-- directly to a partition and fabricate snapshot rows, bypassing the RPC.
-- ===========================================================================
select
  ok (
    not has_table_privilege(
      'authenticated',
      'public.settlement_turn_resource_snapshots_p_default',
      'INSERT'
    )
    and not has_table_privilege(
      'authenticated',
      'public.settlement_turn_resource_snapshots_p_default',
      'UPDATE'
    )
    and not has_table_privilege(
      'authenticated',
      'public.settlement_turn_resource_snapshots_p_default',
      'DELETE'
    ),
    'DEFAULT partition denies direct authenticated INSERT/UPDATE/DELETE (append-only)'
  );

select
  ok (
    not has_table_privilege(
      'authenticated',
      (
        'public.str_snap_w_' || replace('f2000000-0000-0000-0000-00000000000a', '-', '') || '_t100'
      ),
      'INSERT'
    )
    and not has_table_privilege(
      'authenticated',
      (
        'public.str_snap_w_' || replace('f2000000-0000-0000-0000-00000000000a', '-', '') || '_t100'
      ),
      'UPDATE'
    )
    and not has_table_privilege(
      'authenticated',
      (
        'public.str_snap_w_' || replace('f2000000-0000-0000-0000-00000000000a', '-', '') || '_t100'
      ),
      'DELETE'
    ),
    'runtime-created sub-partition denies direct authenticated INSERT/UPDATE/DELETE (append-only)'
  );

-- ===========================================================================
-- ON CONFLICT dedup still works on the partitioned parent
-- ===========================================================================
insert into
  public.settlement_turn_resource_snapshots (
    turn_transition_id,
    world_id,
    settlement_id,
    resource_id,
    turn_number,
    quantity_before,
    quantity_after
  )
values
  (
    'f5000000-0000-0000-0000-00000000000b',
    'f2000000-0000-0000-0000-00000000000b',
    'f4000000-0000-0000-0000-00000000000b',
    'f6000000-0000-0000-0000-00000000000b',
    5,
    30.0,
    20.0
  );

insert into
  public.settlement_turn_resource_snapshots (
    turn_transition_id,
    world_id,
    settlement_id,
    resource_id,
    turn_number,
    quantity_before,
    quantity_after
  )
values
  (
    'f5000000-0000-0000-0000-00000000000b',
    'f2000000-0000-0000-0000-00000000000b',
    'f4000000-0000-0000-0000-00000000000b',
    'f6000000-0000-0000-0000-00000000000b',
    5,
    999.0,
    888.0
  )
on conflict on constraint settlement_turn_resource_snapshots_unique do nothing;

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_resource_snapshots
      where
        turn_transition_id = 'f5000000-0000-0000-0000-00000000000b'
    ),
    1,
    'ON CONFLICT ON CONSTRAINT dedup keeps a duplicate insert a no-op'
  );

-- ===========================================================================
-- RLS SELECT still enforced
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'f2000000-0000-0000-0000-00000000000a'
    ),
    'world admin (member) can read world A resource snapshots'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'f2000000-0000-0000-0000-00000000000a'
    ),
    0,
    'non-member cannot read world A resource snapshots (RLS SELECT enforced)'
  );

reset role;

-- ===========================================================================
-- RETENTION REGRESSION (the ctid-across-partitions fix)
-- Prune World A's window-0 (turn_number < 100). Exactly one row qualifies
-- (World A turn 5). World B's rows and World A's kept turn-150 row must remain.
-- ===========================================================================
select
  is (
    public.internal_prune_batch_delete (
      'public.settlement_turn_resource_snapshots'::regclass,
      format(
        'world_id = %L and turn_number < 100',
        'f2000000-0000-0000-0000-00000000000a'
      ),
      1000,
      false
    ),
    1,
    'pruning world A turn<100 deletes exactly its one window-0 row (not sibling-partition rows)'
  );

select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'f2000000-0000-0000-0000-00000000000a'
        and turn_number = 150
    ),
    'world A kept window (turn 150) survives the prune'
  );

-- Count (not just existence): world B has two turn-5 rows (the NULL-transition
-- routing row and the deduped real-transition row). The pre-fix ctid-only delete
-- drops the one whose ctid collides with world A's pruned row, so this must be a
-- strict count assertion to catch the cross-world over-deletion.
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'f2000000-0000-0000-0000-00000000000b'
    ),
    2,
    'world B rows are entirely untouched by a world A prune'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'f2000000-0000-0000-0000-00000000000a'
        and turn_number = 5
    ),
    'world A window-0 row (turn 5) was pruned'
  );

select
  finish ();

rollback;
