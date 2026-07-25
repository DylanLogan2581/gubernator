-- Migration: extend_notification_type_tribute
-- Adds the notification type value emitted by the demand_tribute RPC (#1375):
-- when a nation seizes resources from a settlement stockpile, the settlement's
-- managers (or world admins) are notified so the seizure is not silent.
-- Isolated in its own ALTER TYPE because new enum values cannot be used in the
-- same transaction they were added in.
-- ---------------------------------------------------------------------------
alter type public.notification_type
add value 'nation.tribute_demanded';
