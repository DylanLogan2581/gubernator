-- Migration: retention_config_defaults_and_coverage
-- ---------------------------------------------------------------------------
-- Phase 1 of the retention roadmap makes per-world data retention automatic
-- and complete. This migration is appended to across tasks 1.1, 1.2 and 1.5;
-- keep each task's contents in its own clearly delimited section.
-- ===========================================================================
-- Task 1.1 — config defaults + effective-retention helper
-- ---------------------------------------------------------------------------
-- Adds:
--   1. world_retention_config.memory_retention_turns column (nullable, >= 1).
--   2. internal_effective_retention(world) helper resolving per-world retention
--      settings to concrete values, falling back to defaults when the config
--      row is absent or a column is NULL.
--
-- Defaults (no config row, or NULL column):
--   snapshot_turns = 200, log_turns = 200, memory_turns = NULL (keep-all).
--   memory_turns IS NULL means "never prune memories".
--
-- The helper is security definer / search_path='' so it can read the
-- superadmin-RLS world_retention_config table on behalf of internal callers
-- (tasks 1.2 and 1.5). It is INTERNAL: no grant to authenticated.
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- 1. memory_retention_turns column
-- ---------------------------------------------------------------------------
alter table public.world_retention_config
add column memory_retention_turns integer;

alter table public.world_retention_config
add constraint world_retention_config_memory_turns_check check (
  memory_retention_turns is null
  or memory_retention_turns >= 1
);

comment on column public.world_retention_config.memory_retention_turns is 'Number of completed turns whose event memories to retain. Older turns are eligible for pruning. null = keep all (never prune memories).';

-- ---------------------------------------------------------------------------
-- 2. internal_effective_retention helper
-- ---------------------------------------------------------------------------
-- Returns the effective retention values for a world, coalescing missing config
-- (no row, or NULL columns) to defaults: log=200, snapshot=200, memory=NULL.
-- A LEFT JOIN from worlds guarantees a single row even when no config exists.
create or replace function public.internal_effective_retention (p_world_id uuid) returns table (
  log_turns integer,
  snapshot_turns integer,
  memory_turns integer
) language sql stable security definer
set
  search_path = '' as $$
  select
    coalesce(c.log_retention_turns, 200) as log_turns,
    coalesce(c.snapshot_retention_turns, 200) as snapshot_turns,
    c.memory_retention_turns as memory_turns
  from public.worlds w
  left join public.world_retention_config c on c.world_id = w.id
  where w.id = p_world_id;
$$;

comment on function public.internal_effective_retention (uuid) is 'Internal helper: resolves a world''s effective retention window to concrete values, coalescing a missing config row or NULL columns to defaults (log=200, snapshot=200, memory=NULL=keep-all). security definer to read superadmin-RLS world_retention_config. Not granted to authenticated.';

revoke all on function public.internal_effective_retention (uuid)
from
  public;

revoke
execute on function public.internal_effective_retention (uuid)
from
  anon,
  authenticated;
