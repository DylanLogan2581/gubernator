-- Migration: add_blueprint_fields
-- Adds description, grace_period_turns, and max_instances_per_settlement
-- to building_blueprints to support the blueprint create/edit UI.
alter table public.building_blueprints
add column description text null,
add column grace_period_turns integer not null default 0,
add column max_instances_per_settlement integer null;

alter table public.building_blueprints
add constraint building_blueprints_description_max_length_check check (
  description is null
  or char_length(description) <= 500
),
add constraint building_blueprints_grace_period_turns_check check (grace_period_turns >= 0),
add constraint building_blueprints_max_instances_check check (
  max_instances_per_settlement is null
  or max_instances_per_settlement >= 1
);
