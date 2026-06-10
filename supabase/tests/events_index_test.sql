-- pgTAP tests for public.events indexes.
-- Run with: npx supabase test db
--
-- Tests cover:
-- - events_world_status_idx exists and covers world_id filtering
-- - events_world_id_idx is dropped (redundant with composite index)
begin;

select
  plan (2);

-- ---------------------------------------------------------------------------
-- Verify redundant index is dropped
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::integer
      from
        pg_indexes
      where
        schemaname = 'public'
        and tablename = 'events'
        and indexname = 'events_world_id_idx'
    ),
    0,
    'events_world_id_idx is dropped'
  );

-- ---------------------------------------------------------------------------
-- Verify composite index exists to cover world_id queries
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::integer
      from
        pg_indexes
      where
        schemaname = 'public'
        and tablename = 'events'
        and indexname = 'events_world_status_idx'
    ),
    1,
    'events_world_status_idx exists to cover world_id filtering'
  );

select
  *
from
  finish ();

rollback;
