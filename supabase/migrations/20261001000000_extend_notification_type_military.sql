-- Migration: extend_notification_type_military
-- Adds the notification type values used by the simulation's military
-- upkeep phase (#1110): an army going unpaid (with desertion), and a unit
-- disbanding after losing all its soldiers. Isolated in its own ALTER TYPE
-- because new enum values cannot be used in the same transaction they were
-- added in (see 20260914000000 / 20260918000000 for the same pattern).
-- ---------------------------------------------------------------------------
alter type public.notification_type
add value 'military.upkeep_unpaid';

alter type public.notification_type
add value 'military.unit_disbanded';
