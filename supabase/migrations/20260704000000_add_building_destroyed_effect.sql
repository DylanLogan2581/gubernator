-- Migration: add_building_destroyed_effect
-- Purpose: Extend CHECK constraint to include 'building_destroyed'.
-- NOTE: settlement_building_id column and its indexes/constraints are now added in
--       20260702500000_add_event_effects_columns.sql to fix migration ordering.
--       This migration now only updates the effect_type CHECK constraint.
-- ---------------------------------------------------------------------------
-- Update the event_effects effect_type CHECK constraint to include building_destroyed
alter table public.event_effects
drop constraint event_effects_effect_type_check;

alter table public.event_effects
add constraint event_effects_effect_type_check check (
  effect_type in (
    'building_damage',
    'building_destroyed',
    'consumption_multiplier',
    'deposit_destroyed',
    'deposit_discovered',
    'managed_population_change',
    'population_boost',
    'population_loss',
    'production_multiplier',
    'resource_drain',
    'resource_grant',
    'upkeep_multiplier'
  )
);
