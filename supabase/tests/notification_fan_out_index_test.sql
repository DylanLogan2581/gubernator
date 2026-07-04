-- pgTAP test for notification fan-out optimization (#695)
-- Verifies only that the supporting partial index exists; it does NOT verify
-- recipient-set equivalence. Recipient correctness for the static-recipient
-- refactor (world admins + super admins + settlement/nation managers) is
-- covered by apply_turn_transition_log_entries_and_notifications_test.sql.
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
