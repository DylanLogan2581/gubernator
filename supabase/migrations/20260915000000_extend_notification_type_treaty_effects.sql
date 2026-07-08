-- Migration: extend_notification_type_treaty_effects
-- Adds the notification type values used by the simulation's treaty-effects
-- phase (#1090): tribute shortfalls and treaty expiry. Isolated in its own
-- ALTER TYPE because new enum values cannot be used in the same transaction
-- they were added in (see 20260914000000 for the same pattern).
-- ---------------------------------------------------------------------------
alter type public.notification_type
add value 'nation.tribute_missed';

alter type public.notification_type
add value 'nation.treaty_expired';
