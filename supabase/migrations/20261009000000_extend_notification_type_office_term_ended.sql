-- Migration: extend_notification_type_office_term_ended
-- Adds the notification type used when an office's fixed term expires and
-- the seat is vacated at turn transition (#1123). Isolated in its own ALTER
-- TYPE because new enum values cannot be used in the same transaction they
-- were added in (see 20261007000000 for the same pattern).
-- ---------------------------------------------------------------------------
alter type public.notification_type
add value 'office.term_ended';
