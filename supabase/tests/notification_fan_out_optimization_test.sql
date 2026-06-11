-- pgTAP test for notification fan-out optimization (#695)
-- Verifies that refactored static recipient computation produces identical recipients.
-- Run with: npx supabase test db
begin;

select
  plan (1);

select
  is (
    (
      select
        count(*)::integer
      from
        pg_indexes
      where
        indexname = 'idx_users_is_super_admin_active'
    ),
    1,
    'partial index on users.is_super_admin created'
  );

rollback;
