-- Migration: extend_notification_type_law_amendments
-- Adds the notification type values used by the law amendment lifecycle
-- (#1119): decree/vote passage, early failure, withdrawal, and turn-based
-- expiry. Isolated in its own ALTER TYPE because new enum values cannot be
-- used in the same transaction they were added in (see 20260914000000 /
-- 20260915000000 for the same pattern).
-- ---------------------------------------------------------------------------
alter type public.notification_type
add value 'law.amendment_passed';

alter type public.notification_type
add value 'law.amendment_failed';

alter type public.notification_type
add value 'law.amendment_withdrawn';

alter type public.notification_type
add value 'law.amendment_expired';
