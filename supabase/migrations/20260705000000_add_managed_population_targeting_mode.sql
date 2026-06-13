-- Migration: add_managed_population_targeting_mode
-- Purpose: Support targeting modes for managed_population_change effect (all/by-type/specific instances).
--
-- Changes:
-- - Add managed_population_type_id column to event_effects for type-targeted effects
-- - Document extra_data_jsonb usage for managed_population_mode field
-- - Update constraints and column grants
-- ---------------------------------------------------------------------------
-- Add managed_population_type_id column
alter table public.event_effects
add column managed_population_type_id uuid references public.managed_population_types (id) on delete set null;

-- Create index for query performance
create index event_effects_managed_population_type_id_idx on public.event_effects (managed_population_type_id)
where
  managed_population_type_id is not null;

-- Grant access to new column
grant
select
  (managed_population_type_id) on public.event_effects to authenticated;
