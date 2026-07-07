-- Migration: extend_notification_type_nation_succession
-- Adds the notification type value used by the succession-on-ruler-death
-- feature (issue #1078). Isolated in its own ALTER TYPE to comply with the
-- Postgres restriction that new enum values cannot be used in the same
-- transaction they were added in.
-- ---------------------------------------------------------------------------
alter type public.notification_type
add value 'nation.succession';
