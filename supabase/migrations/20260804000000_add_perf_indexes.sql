-- Migration: add_perf_indexes
-- Adds indexes identified during the large-world performance validation audit (#797).
-- ---------------------------------------------------------------------------
-- 1. Partial index for the notifications unread-count hot path.
--    getUnreadNotificationsCount: WHERE recipient_user_id = $1 AND is_read = false
--    The existing notifications_recipient_unread_generated_at_idx covers this
--    query via a full composite index, but a partial index (is_read = false only)
--    is far smaller — it excludes the read majority of rows — so it provides a
--    faster lookup for the badge counter query that fires on every page load.
create index if not exists notifications_recipient_user_id_unread_idx on public.notifications (recipient_user_id)
where
  is_read = false;
