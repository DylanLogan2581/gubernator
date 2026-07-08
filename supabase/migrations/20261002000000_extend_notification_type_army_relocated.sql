-- Migration: extend_notification_type_army_relocated
-- Adds the notification type value used by move_army (#1111): notifying a
-- settlement's managers (and nation managers) when an army relocates into or
-- out of their settlement. Isolated in its own ALTER TYPE because new enum
-- values cannot be used in the same transaction they were added in (see
-- 20261001000000 for the same pattern).
-- ---------------------------------------------------------------------------
alter type public.notification_type
add value 'army.relocated';
