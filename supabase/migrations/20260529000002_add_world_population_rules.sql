-- Migration: add_world_population_rules
-- Adds population-rule scalar columns and naming_config_json to public.worlds.
-- Existing worlds are backfilled automatically through the column defaults.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- naming_config helpers
-- ---------------------------------------------------------------------------
create or replace function public.default_naming_config () returns jsonb language sql immutable
set
  search_path = '' as $$
  select
    '{
      "male_names": [],
      "female_names": [],
      "convention": "random",
      "manual_only": false
    }'::jsonb;
$$;

create or replace function public.is_valid_naming_config (config jsonb) returns boolean language plpgsql immutable
set
  search_path = '' as $$
begin
  if config is null or jsonb_typeof (config) != 'object' then
    return false;
  end if;

  if not (config ?& array['male_names', 'female_names', 'convention', 'manual_only']) then
    return false;
  end if;

  if jsonb_typeof (config -> 'male_names') != 'array'
    or jsonb_typeof (config -> 'female_names') != 'array' then
    return false;
  end if;

  if exists (
    select
      1
    from
      jsonb_array_elements (config -> 'male_names') as t (value)
    where
      jsonb_typeof (t.value) != 'string'
  )
  or exists (
    select
      1
    from
      jsonb_array_elements (config -> 'female_names') as t (value)
    where
      jsonb_typeof (t.value) != 'string'
  ) then
    return false;
  end if;

  if jsonb_typeof (config -> 'convention') != 'string'
    or char_length (btrim (config ->> 'convention')) < 1 then
    return false;
  end if;

  if jsonb_typeof (config -> 'manual_only') != 'boolean' then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- worlds: population-rule scalar columns
-- ---------------------------------------------------------------------------
alter table public.worlds
add column partnership_seek_chance numeric not null default 0.3,
add column fertility_chance numeric not null default 0.1,
add column minimum_partnership_age_turns integer not null default 18,
add column maximum_fertility_age_turns integer,
add column mourning_period_turns integer not null default 3,
add column homelessness_decline_rate numeric not null default 0.1,
add column starvation_severity_multiplier numeric not null default 1.0,
add column food_consumption_per_citizen numeric not null default 1.0,
add column water_consumption_per_citizen numeric not null default 1.0;

-- ---------------------------------------------------------------------------
-- worlds: naming_config_json column
-- ---------------------------------------------------------------------------
alter table public.worlds
add column naming_config_json jsonb not null default public.default_naming_config (),
add constraint worlds_naming_config_json_check check (
  public.is_valid_naming_config (naming_config_json)
);

-- ---------------------------------------------------------------------------
-- worlds: CHECK constraints for scalar columns
-- ---------------------------------------------------------------------------
alter table public.worlds
add constraint worlds_partnership_seek_chance_check check (partnership_seek_chance between 0 and 1),
add constraint worlds_fertility_chance_check check (fertility_chance between 0 and 1),
add constraint worlds_minimum_partnership_age_turns_check check (minimum_partnership_age_turns >= 0),
add constraint worlds_maximum_fertility_age_turns_check check (
  maximum_fertility_age_turns is null
  or maximum_fertility_age_turns >= 0
),
add constraint worlds_mourning_period_turns_check check (mourning_period_turns >= 0),
add constraint worlds_homelessness_decline_rate_check check (homelessness_decline_rate >= 0),
add constraint worlds_starvation_severity_multiplier_check check (starvation_severity_multiplier >= 0),
add constraint worlds_food_consumption_per_citizen_check check (food_consumption_per_citizen >= 0),
add constraint worlds_water_consumption_per_citizen_check check (water_consumption_per_citizen >= 0);

-- ---------------------------------------------------------------------------
-- worlds: column-level UPDATE grants for population-rule columns
-- ---------------------------------------------------------------------------
grant
update (
  partnership_seek_chance,
  fertility_chance,
  minimum_partnership_age_turns,
  maximum_fertility_age_turns,
  mourning_period_turns,
  homelessness_decline_rate,
  starvation_severity_multiplier,
  food_consumption_per_citizen,
  water_consumption_per_citizen,
  naming_config_json
) on public.worlds to authenticated;
