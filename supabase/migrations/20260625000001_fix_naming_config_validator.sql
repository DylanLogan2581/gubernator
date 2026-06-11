-- Migration: fix_naming_config_validator
-- Fixes mismatch between frontend naming config schema and DB validator.
-- Frontend sends: male_given_names, female_given_names, surnames, convention
-- Old validator expected: male_names, female_names, convention (missing surnames)
-- This caused all nameset creates to fail with "Nameset input is invalid"
-- Solution: Update validator to accept both old (male_names/female_names) and
-- new (male_given_names/female_given_names/surnames) field names for backward
-- compatibility with seeded worlds, while supporting the frontend's format.
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_naming_config (config jsonb) returns boolean language plpgsql immutable
set
  search_path = '' as $$
declare
  v_has_old_format boolean;
  v_has_new_format boolean;
begin
  if config is null or jsonb_typeof (config) != 'object' then
    return false;
  end if;

  -- Check for old format (male_names, female_names, convention)
  v_has_old_format := config ? 'male_names' and config ? 'female_names' and config ? 'convention';

  -- Check for new format (male_given_names, female_given_names, surnames, convention)
  v_has_new_format := config ? 'male_given_names' and config ? 'female_given_names'
    and config ? 'surnames' and config ? 'convention';

  -- Must match exactly one format
  if not (v_has_old_format or v_has_new_format) then
    return false;
  end if;

  -- If old format, validate it
  if v_has_old_format and not v_has_new_format then
    if jsonb_typeof (config -> 'male_names') != 'array'
      or jsonb_typeof (config -> 'female_names') != 'array' then
      return false;
    end if;

    if exists (
      select 1 from jsonb_array_elements (config -> 'male_names') as t (value)
      where jsonb_typeof (t.value) != 'string'
    )
    or exists (
      select 1 from jsonb_array_elements (config -> 'female_names') as t (value)
      where jsonb_typeof (t.value) != 'string'
    ) then
      return false;
    end if;
  end if;

  -- If new format, validate it
  if v_has_new_format and not v_has_old_format then
    if jsonb_typeof (config -> 'male_given_names') != 'array'
      or jsonb_typeof (config -> 'female_given_names') != 'array'
      or jsonb_typeof (config -> 'surnames') != 'array' then
      return false;
    end if;

    if exists (
      select 1 from jsonb_array_elements (config -> 'male_given_names') as t (value)
      where jsonb_typeof (t.value) != 'string'
    )
    or exists (
      select 1 from jsonb_array_elements (config -> 'female_given_names') as t (value)
      where jsonb_typeof (t.value) != 'string'
    )
    or exists (
      select 1 from jsonb_array_elements (config -> 'surnames') as t (value)
      where jsonb_typeof (t.value) != 'string'
    ) then
      return false;
    end if;
  end if;

  -- Validate convention field (same for both formats)
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

-- Update default_naming_config to use new format (matches frontend schema)
create or replace function public.default_naming_config () returns jsonb language sql immutable
set
  search_path = '' as $$
  select
    '{
      "male_given_names": [],
      "female_given_names": [],
      "surnames": [],
      "convention": "random"
    }'::jsonb;
$$;
