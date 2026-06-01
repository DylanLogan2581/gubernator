-- Migration: constrain_naming_convention
-- Tightens is_valid_naming_config() so the convention field must be one of the
-- values defined in the TS NameConvention enum.
-- Keep this list in sync with NAME_CONVENTIONS in:
--   src/features/worlds/schemas/worldNamingConfigSchemas.ts
-- ---------------------------------------------------------------------------
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
    or (config ->> 'convention') not in (
      'random', 'patronymic', 'matronymic', 'inherited family name'
    ) then
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
