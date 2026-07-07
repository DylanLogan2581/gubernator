-- Migration: extend_notification_type_treasury
-- Adds the notification type values used by treasury spending RPCs (#1084):
-- grant_nation_resources and subsidize_construction_project. Isolated in its
-- own ALTER TYPE because new enum values cannot be used in the same
-- transaction they were added in.
-- ---------------------------------------------------------------------------
alter type public.notification_type
add value 'nation.grant_received';

alter type public.notification_type
add value 'nation.subsidy_received';
