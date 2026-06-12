-- Migration: add_building_destroyed_effect
-- Purpose: Add building_destroyed effect type to event_effects table.
-- - Extends CHECK constraint to include 'building_destroyed'
-- - Adds settlement_building_id FK to link to specific buildings
-- - Constraint: settlement_building_id required for building_destroyed type
-- ---------------------------------------------------------------------------
-- Update the event_effects effect_type CHECK constraint
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

-- Add settlement_building_id FK
alter table public.event_effects
add column settlement_building_id uuid references public.settlement_buildings (id) on delete cascade;

-- Add constraint: settlement_building_id required for building_destroyed
alter table public.event_effects
add constraint event_effects_settlement_building_required_for_building_destroyed check (
  (
    effect_type = 'building_destroyed'
    and settlement_building_id is not null
  )
  or effect_type != 'building_destroyed'
);

-- Add index for settlement_building_id queries
create index event_effects_settlement_building_id_idx on public.event_effects (settlement_building_id)
where
  settlement_building_id is not null;

-- Add index for building_destroyed effect type lookups
create index event_effects_building_destroyed_idx on public.event_effects (effect_type)
where
  effect_type = 'building_destroyed';
