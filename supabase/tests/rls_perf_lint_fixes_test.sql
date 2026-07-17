-- pgTAP tests for 20261121000000_rls_perf_lint_fixes.
-- Run with: npx supabase test db
--
-- Asserts the structural outcome of the RLS performance lint fixes:
--   • multiple_permissive_policies: exactly one permissive `authenticated`
--     policy remains per flagged table + action.
--   • auth_rls_initplan: the four fixed policies evaluate auth.uid() once by
--     wrapping it in a scalar subquery, which pg_policies renders as
--     "( SELECT auth.uid() AS uid)".
begin;

select
  plan (10);

-- --- multiple_permissive_policies: one permissive authenticated policy each ---
create or replace function pg_temp.permissive_count (tbl text, action text) returns int language sql stable as $$
  select count(*)::int
  from pg_policies
  where schemaname = 'public'
    and tablename = tbl
    and cmd = action
    and permissive = 'PERMISSIVE'
    and 'authenticated' = any (roles);
$$;

select
  is (
    pg_temp.permissive_count ('citizen_memories', 'SELECT'),
    1,
    'citizen_memories: one permissive authenticated SELECT policy'
  );

select
  is (
    pg_temp.permissive_count ('citizens', 'UPDATE'),
    1,
    'citizens: one permissive authenticated UPDATE policy'
  );

select
  is (
    pg_temp.permissive_count ('nation_discoveries', 'SELECT'),
    1,
    'nation_discoveries: one permissive authenticated SELECT policy'
  );

select
  is (
    pg_temp.permissive_count ('users', 'SELECT'),
    1,
    'users: one permissive authenticated SELECT policy'
  );

select
  is (
    pg_temp.permissive_count ('worlds', 'SELECT'),
    1,
    'worlds: one permissive authenticated SELECT policy'
  );

select
  is (
    pg_temp.permissive_count ('worlds', 'UPDATE'),
    1,
    'worlds: one permissive authenticated UPDATE policy'
  );

-- --- auth_rls_initplan: wrapped (select auth.uid()) present in the qual ---
create or replace function pg_temp.qual_of (tbl text, pol text) returns text language sql stable as $$
  select coalesce(qual, '') || ' ' || coalesce(with_check, '')
  from pg_policies
  where schemaname = 'public' and tablename = tbl and policyname = pol;
$$;

select
  matches (
    pg_temp.qual_of ('world_admins', 'world_admins_select'),
    'SELECT auth\.uid\(\) AS uid',
    'world_admins_select wraps auth.uid()'
  );

select
  matches (
    pg_temp.qual_of ('users', 'users_update_own'),
    'SELECT auth\.uid\(\) AS uid',
    'users_update_own wraps auth.uid()'
  );

select
  matches (
    pg_temp.qual_of ('notifications', 'notifications_select_recipient'),
    'SELECT auth\.uid\(\) AS uid',
    'notifications_select_recipient wraps auth.uid()'
  );

select
  matches (
    pg_temp.qual_of ('users', 'users_select_self_or_super_admin'),
    'SELECT auth\.uid\(\) AS uid',
    'users_select merged policy wraps auth.uid()'
  );

select
  *
from
  finish ();

rollback;
