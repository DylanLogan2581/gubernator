-- Migration: drop_events_world_id_idx
-- Drop redundant single-column index on events(world_id). The composite index
-- events_world_status_idx on (world_id, status) already covers world_id-only
-- queries, so the single-column index maintains write overhead with no read benefit.
-- ---------------------------------------------------------------------------
drop index if exists public.events_world_id_idx;
