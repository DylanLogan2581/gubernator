-- pgTAP tests for event creation RPC overloads
-- Run with: npx supabase test db
--
-- Tests cover:
-- - Exactly one overload of create_event_group_with_events exists (stale text-param removed)
-- - The remaining overload has the correct signature (p_effects jsonb, not p_effect_type text)
begin;

select
  plan (2);

-- ---------------------------------------------------------------------------
-- Verify exactly one overload of create_event_group_with_events exists
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::integer
      from
        pg_proc
      where
        proname = 'create_event_group_with_events'
        and pronamespace = (
          select
            oid
          from
            pg_namespace
          where
            nspname = 'public'
        )
    ),
    1,
    'Exactly one create_event_group_with_events overload exists (stale text-param removed)'
  );

-- ---------------------------------------------------------------------------
-- Verify the remaining overload has p_effects (jsonb) not p_effect_type (text)
-- ---------------------------------------------------------------------------
select
  matches (
    (
      select
        pg_get_functiondef(oid)
      from
        pg_proc
      where
        proname = 'create_event_group_with_events'
        and pronamespace = (
          select
            oid
          from
            pg_namespace
          where
            nspname = 'public'
        )
    ),
    'p_effects jsonb',
    'The remaining overload uses p_effects jsonb parameter'
  );

select
  *
from
  finish ();

rollback;
