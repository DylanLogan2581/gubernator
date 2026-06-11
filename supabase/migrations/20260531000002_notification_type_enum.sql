-- Migration: notification_type_enum
-- Promotes notifications.notification_type from a text column with a CHECK
-- allowlist to a proper PostgreSQL enum type.
--
-- Option B from issue #421: using a real enum type means future notification
-- types are added with a single `alter type public.notification_type add value
-- 'new_type'` statement — no DROP+ADD constraint rebuild, no table-wide
-- revalidation scan, no locking risk on large tables.
--
-- All five values currently emitted by the system are seeded here so the
-- four trade-route RPC migrations (…019–022) can INSERT their respective types
-- without touching the constraint at all.
--
-- Future epics: add new types with a separate migration:
--   alter type public.notification_type add value 'your_new_type';
-- Note: new values added via ALTER TYPE ADD VALUE are NOT usable in the same
-- transaction that adds them (Postgres errors with "unsafe use of new value").
-- Values become usable only after the transaction commits. Therefore, always
-- isolate ADD VALUE in its own migration with no same-file usage.
-- ---------------------------------------------------------------------------
-- Drop the text CHECK constraints added by 20260519000003 and
-- 20260519000004 (the max-length guard is redundant once the column is typed).
alter table public.notifications
drop constraint if exists notifications_notification_type_check;

alter table public.notifications
drop constraint if exists notifications_notification_type_max_length_check;

-- Create the enum with the full set of values Epic 5 emits.
create type public.notification_type as enum(
  'turn.completed',
  'trade_proposal_received',
  'trade_proposal_accepted',
  'trade_proposal_rejected',
  'trade_route_cancelled'
);

-- Cast the existing text column to the new enum type.
-- Every row in notifications already holds a value that is a member of the
-- enum, so the USING cast succeeds without data loss.
alter table public.notifications
alter column notification_type type public.notification_type using notification_type::public.notification_type;
