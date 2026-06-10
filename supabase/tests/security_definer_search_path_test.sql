-- pgTAP tests for SECURITY DEFINER function search_path validation.
-- Ensures all SECURITY DEFINER functions in public schema have search_path set
-- to prevent search_path injection attacks.
--
-- Run with: npx supabase test db
begin;

select
  plan (1);

-- ===========================================================================
-- SECURITY DEFINER: all public functions must set search_path
-- ===========================================================================
-- Regression guard: catches if a new SECURITY DEFINER function is created
-- without set search_path = '' which is the repo standard for preventing
-- search_path injection attacks.
select
  is (
    (
      select
        count(*)::int
      from
        pg_proc
      where
        pronamespace = 'public'::regnamespace
        and prosecdef = true
        and (
          proconfig is null
          or not (proconfig::text[] @> array['search_path=""'])
        )
    ),
    0,
    'all SECURITY DEFINER functions in public schema must set search_path'
  );

select
  *
from
  finish ();

rollback;
