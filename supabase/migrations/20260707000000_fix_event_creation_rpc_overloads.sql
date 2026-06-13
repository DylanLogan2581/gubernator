-- Migration: fix_event_creation_rpc_overloads
-- Purpose: Drop the stale text-param overload of create_event_group_with_events RPC.
--
-- Background:
-- The original RPC (20260628) had signature:
--   create_event_group_with_events(p_world_id, p_group_name, p_group_description,
--     p_effect_type TEXT, p_scope_type, p_targets, p_duration_type, ...)
--
-- Migration 20260703 changed the 4th parameter from text (p_effect_type) to jsonb (p_effects).
-- However, using `CREATE OR REPLACE FUNCTION` with a different signature doesn't replace
-- the function—it creates a new overload. So the database now has two overloads:
-- - (uuid, text, text, text, text, jsonb, text, integer, integer, boolean, text) — STALE
-- - (uuid, text, text, jsonb, text, jsonb, text, integer, integer, boolean, text) — CURRENT
--
-- PostgREST currently disambiguates by argument names (client sends p_effects), but the
-- dangling overload is dead code and a potential PGRST300 ambiguity risk.
-- ============================================================================
-- Drop the stale overload with p_effect_type text (4th parameter)
drop function if exists public.create_event_group_with_events (
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  integer,
  integer,
  boolean,
  text
);

-- Verify: exactly one overload should exist
-- This check can be run manually: select pg_get_functiondef(oid) from pg_proc
-- where proname = 'create_event_group_with_events';
