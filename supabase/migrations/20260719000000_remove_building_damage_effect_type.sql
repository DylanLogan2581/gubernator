-- Migration: remove_building_damage_effect_type
-- Purpose: Remove the orphan 'building_damage' value from CHECK constraints on
-- events.effect_type and event_effects.effect_type.  The value was never
-- implemented in any TypeScript type, UI picker, or engine switch case.
-- Tightening the constraint prevents invalid data while having no effect on
-- valid events.
--
-- Safety: assert no live rows use the value before altering constraints.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.events where effect_type = 'building_damage'
  ) then
    raise exception
      'Cannot remove building_damage: rows in public.events still use it'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.event_effects where effect_type = 'building_damage'
  ) then
    raise exception
      'Cannot remove building_damage: rows in public.event_effects still use it'
      using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- events.effect_type CHECK
-- ---------------------------------------------------------------------------
alter table public.events
drop constraint events_effect_type_check;

alter table public.events
add constraint events_effect_type_check check (
  effect_type in (
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

-- ---------------------------------------------------------------------------
-- event_effects.effect_type CHECK
-- ---------------------------------------------------------------------------
alter table public.event_effects
drop constraint event_effects_effect_type_check;

alter table public.event_effects
add constraint event_effects_effect_type_check check (
  effect_type in (
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
