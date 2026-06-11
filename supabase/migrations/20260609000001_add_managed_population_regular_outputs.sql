-- Migration: add_managed_population_regular_outputs
-- Adds regular_outputs_json column to managed_population_types table.
-- Regular outputs are resources produced each turn (e.g., wool from sheep)
-- without slaughter, scaled by fulfillment of upkeep maintenance and workers.
-- ---------------------------------------------------------------------------
alter table public.managed_population_types
add column regular_outputs_json jsonb not null default '[]';
