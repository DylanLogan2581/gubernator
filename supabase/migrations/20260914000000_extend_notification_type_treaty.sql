-- Migration: extend_notification_type_treaty
-- Adds the notification type value used by break_nation_treaty (#1089).
-- Isolated in its own ALTER TYPE because new enum values cannot be used in
-- the same transaction they were added in.
-- ---------------------------------------------------------------------------
alter type public.notification_type
add value 'nation.treaty_broken';
