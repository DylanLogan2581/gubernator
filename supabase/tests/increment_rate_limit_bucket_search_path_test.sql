-- pgTAP test: increment_rate_limit_bucket must pin search_path = ''.
-- Regression guard for the specific SECURITY DEFINER function that shipped with
-- `set search_path = public` in 20260807000000_add_edge_rate_limit_buckets.sql
-- and was corrected in 20260809000000_fix_edge_rate_limit_buckets_rls_and_search_path.sql.
-- Mirrors the per-function proconfig assertion pattern used for the event RPC
-- search_path remediations (20260630000003, 20260710000000); the generic
-- security_definer_search_path_test.sql guard already covers all functions,
-- this asserts it explicitly for this function by name.
-- Run with: npx supabase test db
begin;

select
  plan (1);

select
  is (
    (
      select
        count(*)::int
      from
        pg_proc
      where
        pronamespace = 'public'::regnamespace
        and proname = 'increment_rate_limit_bucket'
        and prosecdef = true
        and proconfig is not null
        and proconfig::text[] @> array['search_path=""']
    ),
    1,
    'increment_rate_limit_bucket must set search_path = empty string'
  );

select
  *
from
  finish ();

rollback;
