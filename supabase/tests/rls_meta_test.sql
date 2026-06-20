-- pgTAP meta-test: structural RLS coverage for all tables in schema public.
-- Run with: npx supabase test db
--
-- Guard against drift: a new table that ships without RLS enabled or without
-- any policy will cause this test to fail, forcing the author to fix it before
-- the suite can pass.
--
-- If you intentionally add a table that requires special handling, you must
-- also add RLS and at least one policy before these tests pass.
begin;

select
  plan (2);

-- ---------------------------------------------------------------------------
-- T1: every table in public has RLS enabled
-- ---------------------------------------------------------------------------
-- Fails if any table has rowsecurity = false.  Fix: enable RLS and add
-- appropriate policies before merging.
select
  is (
    (
      select
        count(*)::int
      from
        pg_tables
      where
        schemaname = 'public'
        and not rowsecurity
    ),
    0,
    'every table in schema public must have RLS enabled'
  );

-- ---------------------------------------------------------------------------
-- T2: every table in public has at least one RLS policy
-- ---------------------------------------------------------------------------
-- A table with RLS enabled but no policies silently blocks all access.
-- At minimum one SELECT, INSERT, UPDATE, or DELETE policy must exist.
-- If a table is intentionally write-only via service_role, add a restrictive
-- policy (e.g. SELECT for super_admin) to document the intent.
select
  is (
    (
      select
        count(*)::int
      from
        pg_tables t
      where
        t.schemaname = 'public'
        and not exists (
          select
            1
          from
            pg_policies p
          where
            p.schemaname = 'public'
            and p.tablename = t.tablename
        )
    ),
    0,
    'every table in schema public must have at least one RLS policy'
  );

select
  *
from
  finish ();

rollback;
