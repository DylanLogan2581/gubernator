-- pgTAP meta-test: EXECUTE hygiene for SECURITY DEFINER functions.
-- Run with: npx supabase test db
--
-- Guards two categories of functions that must not be directly callable by
-- the anon role (which inherits from PUBLIC):
--
--   1. Trigger functions: called by the DB engine, never via PostgREST.
--      They return the `trigger` pseudo-type.  Any EXECUTE grant to anon is
--      an unnecessary attack surface.
--
--   2. Internal helper functions: identified by the `internal_` prefix or
--      `_internal` suffix; also includes create_citizen_internal and
--      end_partnership_internal.  These are private implementation details
--      called only by other SECURITY DEFINER functions.
--
-- Both categories should have had EXECUTE revoked from PUBLIC and anon in
-- migration 20260803000000_revoke_trigger_fn_execute_from_anon.sql.
-- A future function that matches either category will fail this test until
-- an explicit REVOKE is added to a migration.
--
-- Note: client-facing RPCs (is_world_admin, is_super_admin, add_citizen_memory,
-- etc.) are intentionally callable by authenticated/anon and are not checked
-- here.  The search_path hygiene check is in security_definer_search_path_test.sql.
begin;

select
  plan (2);

-- ---------------------------------------------------------------------------
-- T1: trigger functions must have EXECUTE revoked from anon
-- ---------------------------------------------------------------------------
-- Trigger functions are identified by an entry in pg_trigger.tgfoid.
-- After migration 20260803000000, none should be callable by anon.
select
  is (
    (
      select
        count(*)::int
      from
        pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
      where
        n.nspname = 'public'
        and p.prosecdef = true
        and exists (
          select
            1
          from
            pg_trigger t
          where
            t.tgfoid = p.oid
        )
        and has_function_privilege('anon', p.oid, 'EXECUTE')
    ),
    0,
    'trigger functions must have EXECUTE revoked from anon'
  );

-- ---------------------------------------------------------------------------
-- T2: internal helper functions must have EXECUTE revoked from anon
-- ---------------------------------------------------------------------------
-- Internal helpers are identified by an internal_ prefix or _internal suffix.
-- They are not trigger functions (those are covered by T1).
select
  is (
    (
      select
        count(*)::int
      from
        pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
      where
        n.nspname = 'public'
        and p.prosecdef = true
        and (
          p.proname like 'internal\_%' escape '\'
          or p.proname like '%\_internal' escape '\'
        )
        and not exists (
          select
            1
          from
            pg_trigger t
          where
            t.tgfoid = p.oid
        )
        and has_function_privilege('anon', p.oid, 'EXECUTE')
    ),
    0,
    'internal helper functions must have EXECUTE revoked from anon'
  );

select
  *
from
  finish ();

rollback;
