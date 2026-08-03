-- ===========================================================================
-- Drop dead upsert_world_retention_config RPC
-- ---------------------------------------------------------------------------
-- The RPC predates the memory_retention_turns column (it has no memory
-- parameter) and has no callers: the superadmin retention UI writes
-- world_retention_config directly through its superadmin-only RLS
-- insert/update policies.
-- ===========================================================================
drop function if exists public.upsert_world_retention_config (uuid, integer, integer);
