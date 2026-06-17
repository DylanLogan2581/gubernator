-- Migration: extend_notification_type_enum_event_player
-- Adds notification type values for events and player character outcomes.
-- Each value is isolated in its own ALTER TYPE to comply with Postgres
-- restriction: new enum values cannot be used in the same transaction.
-- ---------------------------------------------------------------------------
alter type public.notification_type
add value 'event.activated';

alter type public.notification_type
add value 'event.expired';

alter type public.notification_type
add value 'player.died';

alter type public.notification_type
add value 'player.widowed';
