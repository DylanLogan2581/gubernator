-- pgTAP tests for the baseline turn snapshot backfill (issue #439).
-- Verifies that after npx supabase db reset + seed, every settlement has
-- exactly one baseline snapshot row and every (settlement, resource) pair has
-- exactly one baseline resource snapshot row, with no duplicates.
-- Run with: npx supabase test db
begin;

select
  plan (4);

-- ---------------------------------------------------------------------------
-- settlement_turn_snapshots: coverage — every settlement has a baseline row
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(distinct sts.settlement_id)::integer
      from
        public.settlement_turn_snapshots sts
      where
        sts.turn_transition_id is null
    ),
    (
      select
        count(*)::integer
      from
        public.settlements
    ),
    'every settlement has a baseline snapshot row (turn_transition_id IS NULL)'
  );

-- No duplicate baseline rows: total count == distinct settlement_id count
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_snapshots
      where
        turn_transition_id is null
    ),
    (
      select
        count(distinct settlement_id)::integer
      from
        public.settlement_turn_snapshots
      where
        turn_transition_id is null
    ),
    'no duplicate baseline snapshot rows per settlement'
  );

-- ---------------------------------------------------------------------------
-- settlement_turn_resource_snapshots: coverage — one row per stockpile pair
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_resource_snapshots
      where
        turn_transition_id is null
    ),
    (
      select
        count(*)::integer
      from
        public.settlement_resource_stockpiles
    ),
    'every (settlement, resource) stockpile pair has a baseline resource snapshot row'
  );

-- No duplicates: distinct (settlement_id, resource_id) count == stockpile count
select
  is (
    (
      select
        count(distinct (settlement_id, resource_id))::integer
      from
        public.settlement_turn_resource_snapshots
      where
        turn_transition_id is null
    ),
    (
      select
        count(*)::integer
      from
        public.settlement_resource_stockpiles
    ),
    'no duplicate baseline resource snapshot rows per (settlement, resource) pair'
  );

select
  *
from
  finish ();

rollback;
