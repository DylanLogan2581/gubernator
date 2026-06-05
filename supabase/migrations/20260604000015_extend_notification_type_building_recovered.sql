-- Migration: extend_notification_type_building_recovered
-- Adds the building.recovered notification type introduced by the upkeep
-- recovery mechanic (issue #501).
alter type public.notification_type
add value 'building.recovered';
