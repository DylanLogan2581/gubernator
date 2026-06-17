-- Migration: add_event_effects_columns
-- Purpose: Add settlement_building_id and managed_population_type_id columns to event_effects.
-- This migration must run BEFORE the RPC definition (20260703) that references these columns.
-- Earlier migrations (20260704, 20260705) become no-ops as columns are added here.
-- ============================================================================
-- Add settlement_building_id column (for building_destroyed effect type targeting)
alter table public.event_effects
add column settlement_building_id uuid references public.settlement_buildings (id) on delete cascade;

-- Add managed_population_type_id column (for managed_population_change with type targeting)
alter table public.event_effects
add column managed_population_type_id uuid references public.managed_population_types (id) on delete set null;

-- Constraint: settlement_building_id required for building_destroyed
alter table public.event_effects
add constraint event_effects_settlement_building_required_for_building_destroyed check (
  (
    effect_type = 'building_destroyed'
    and settlement_building_id is not null
  )
  or effect_type != 'building_destroyed'
);

-- Indexes for query performance
create index event_effects_settlement_building_id_idx on public.event_effects (settlement_building_id)
where
  settlement_building_id is not null;

create index event_effects_managed_population_type_id_idx on public.event_effects (managed_population_type_id)
where
  managed_population_type_id is not null;

-- Index for building_destroyed lookups
create index event_effects_building_destroyed_idx on public.event_effects (effect_type)
where
  effect_type = 'building_destroyed';

-- Grant access to new columns
grant
select
  (
    settlement_building_id,
    managed_population_type_id
  ) on public.event_effects to authenticated;
