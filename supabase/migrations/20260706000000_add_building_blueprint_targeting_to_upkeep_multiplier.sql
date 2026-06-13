-- Migration: add_building_blueprint_targeting_to_upkeep_multiplier
-- Purpose: Allow upkeep_multiplier effects to target specific building blueprints
--
-- Changes:
-- - Add building_blueprint_id column to event_effects (optional FK)
-- - Add index for query performance
-- - All existing upkeep_multiplier effects remain unchanged (null = all buildings)
-- ---------------------------------------------------------------------------
alter table public.event_effects
add column building_blueprint_id uuid references public.building_blueprints (id) on delete set null;

-- Index for filtering by blueprint
create index event_effects_building_blueprint_id_idx on public.event_effects (building_blueprint_id)
where
  building_blueprint_id is not null;

-- Update the column grant to include the new field
-- (Supabase automatically updates grants, but being explicit)
grant
select
  (building_blueprint_id) on public.event_effects to authenticated;
