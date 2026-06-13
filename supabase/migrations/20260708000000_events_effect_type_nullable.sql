-- Allow events with zero effects.
--
-- events.effect_type is a legacy/back-compat column derived from the first
-- effect in create_event_group_with_events. Since events may now be created
-- with an empty effects array, that derived value is null and the existing
-- NOT NULL constraint rejected the insert ("null value in column effect_type").
--
-- The events_effect_type_check CHECK already tolerates null (a CHECK only
-- fails on FALSE), so dropping NOT NULL is sufficient. No RLS/policy change.
alter table public.events
alter column effect_type
drop not null;
