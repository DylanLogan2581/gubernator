-- pgTAP tests for Task 1.4 retention index hygiene.
-- See 20261124000000_retention_index_hygiene.sql.
-- Run with: npx supabase test db
--
-- Tests cover:
-- - citizen_memories_world_occurred_turn_idx exists (covers the
--   internal_prune_world_retention world_id + occurred_on_turn_number
--   predicate, previously uncovered since the only prior index led with
--   citizen_id).
-- - turn_log_entries_world_id_idx is dropped (redundant single-column index;
--   turn_log_entries_world_category_idx (world_id, log_category) is a
--   non-partial composite index whose leading column already covers any
--   world_id-only query).
-- - settlement_turn_snapshots_world_transition_idx is NOT dropped: it is
--   actively used by getTransitionOutcome
--   (src/features/turns/queries/turnTransitionOutcomeQueries.ts), which
--   filters settlement_turn_snapshots by .eq("world_id", ...).eq("turn_transition_id",
--   ...). No notifications(world_id, created_at) index is added: pruning of
--   notifications became transition-based in Task 1.2
--   (generated_in_transition_id in (...)), already served by the existing
--   notifications_generated_in_transition_id_idx.
begin;

select
  plan (3);

-- ===========================================================================
-- Test 1: citizen_memories_world_occurred_turn_idx exists.
-- ===========================================================================
select
  ok (
    exists (
      select
        1
      from
        pg_indexes
      where
        schemaname = 'public'
        and tablename = 'citizen_memories'
        and indexname = 'citizen_memories_world_occurred_turn_idx'
    ),
    'Index citizen_memories_world_occurred_turn_idx exists on citizen_memories'
  );

-- ===========================================================================
-- Test 2: turn_log_entries_world_id_idx is dropped (redundant).
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        pg_indexes
      where
        schemaname = 'public'
        and tablename = 'turn_log_entries'
        and indexname = 'turn_log_entries_world_id_idx'
    ),
    0,
    'turn_log_entries_world_id_idx is dropped as redundant'
  );

-- ===========================================================================
-- Test 3: settlement_turn_snapshots_world_transition_idx is kept.
-- ===========================================================================
select
  ok (
    exists (
      select
        1
      from
        pg_indexes
      where
        schemaname = 'public'
        and tablename = 'settlement_turn_snapshots'
        and indexname = 'settlement_turn_snapshots_world_transition_idx'
    ),
    'settlement_turn_snapshots_world_transition_idx is kept (still used by getTransitionOutcome)'
  );

select
  *
from
  finish ();

rollback;
