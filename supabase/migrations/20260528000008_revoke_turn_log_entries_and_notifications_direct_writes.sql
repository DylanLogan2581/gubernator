-- Migration: revoke_turn_log_entries_and_notifications_direct_writes
-- Makes the append-only intent on public.turn_log_entries and
-- public.notifications structurally enforced and self-documenting.
-- Both tables are written exclusively by the SECURITY DEFINER path
-- advance_world_turn_if_current. Revoking UPDATE and DELETE from
-- authenticated closes the mutation surface entirely; a future migration
-- that accidentally re-grants these verbs will be visible in review.
--
-- Precedent: 20260525000006_revoke_partnership_direct_writes.sql
-- Prior art on notifications INSERT+UPDATE+DELETE:
--   20260519000003_restrict_notification_writes.sql
revoke
update,
delete on public.turn_log_entries
from
  authenticated;

-- UPDATE and DELETE on notifications were already revoked alongside INSERT in
-- 20260519000003_restrict_notification_writes.sql. The revoke below is
-- intentionally redundant: it documents the append-only invariant in one
-- place and remains a no-op if nothing has changed.
revoke
update,
delete on public.notifications
from
  authenticated;
