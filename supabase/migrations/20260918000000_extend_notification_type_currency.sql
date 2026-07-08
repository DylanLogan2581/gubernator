-- Migration: extend_notification_type_currency
-- Adds the notification type values used by the simulation's currency
-- confidence phase (#1094): resource-backed currency default and fiat
-- confidence collapse. Isolated in its own ALTER TYPE because new enum
-- values cannot be used in the same transaction they were added in (see
-- 20260914000000 / 20260915000000 for the same pattern).
-- ---------------------------------------------------------------------------
alter type public.notification_type
add value 'currency.default';

alter type public.notification_type
add value 'currency.confidence_collapsing';
