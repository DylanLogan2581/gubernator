-- Migration: collapse_manual_only_into_convention
-- Collapses the world_naming_config manual_only flag into the convention enum
-- by adding a "manual" convention. Existing rows with manual_only=true become
-- convention='manual'; the manual_only key is stripped from every row.
-- Keep the convention allowlist in sync with NAME_CONVENTIONS in:
--   src/features/worlds/schemas/worldNamingConfigSchemas.ts
-- ---------------------------------------------------------------------------
alter table public.worlds
drop constraint worlds_naming_config_json_check;

create or replace function public.default_naming_config () returns jsonb language sql immutable
set
  search_path = '' as $$
  select
    '{
      "male_names": [],
      "female_names": [],
      "convention": "random"
    }'::jsonb;
$$;

create or replace function public.is_valid_naming_config (config jsonb) returns boolean language plpgsql immutable
set
  search_path = '' as $$
begin
  if config is null or jsonb_typeof (config) != 'object' then
    return false;
  end if;

  if not (config ?& array['male_names', 'female_names', 'convention']) then
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
    or (config ->> 'convention') not in (
      'random', 'patronymic', 'matronymic', 'inherited family name', 'manual'
    ) then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

-- Backfill: where manual_only=true, promote convention to 'manual' before
-- dropping the key so the prior intent is preserved.
update public.worlds
set
  naming_config_json = (naming_config_json - 'manual_only') || jsonb_build_object('convention', 'manual')
where
  (naming_config_json ->> 'manual_only')::boolean is true;

update public.worlds
set
  naming_config_json = naming_config_json - 'manual_only'
where
  naming_config_json ? 'manual_only';

alter table public.worlds
add constraint worlds_naming_config_json_check check (
  public.is_valid_naming_config (naming_config_json)
);
