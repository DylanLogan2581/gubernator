-- Migration: add_generated_nameset_config
-- Extends naming config validation to accept a "generated" shape alongside
-- the existing static "list" shape (#1252 — nameset config union).
--
-- "list" keeps today's static-pool format. "generated" adds:
--   parts    — named fragment lists (duplicate entries weight that entry)
--   patterns — required male_given/female_given/surname keys, each an
--              array of literal strings and list-ref groups (arrays of
--              part-list keys; one random pick per referenced list,
--              concatenated together)
-- Caps: <=40 part lists, <=500 entries per list, config <=64KB.
--
-- A missing "type" key is treated as "list" (the only shape that existed
-- before this migration), so pre-existing configs stay valid without a
-- backfill. §2 backfills anyway so `type` is always present going forward,
-- per the issue's acceptance criteria.
-- ---------------------------------------------------------------------------
-- §1: Validator + default accept/produce the type discriminant.
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_naming_config (config jsonb) returns boolean language plpgsql immutable
set
  search_path = '' as $$
declare
  v_type text;
  v_part_key text;
  v_part_list jsonb;
  v_part_list_count integer;
  v_pattern_key text;
  v_pattern jsonb;
  v_element jsonb;
  v_list_key text;
begin
  if config is null or jsonb_typeof (config) != 'object' then
    return false;
  end if;

  if jsonb_typeof (config -> 'convention') != 'string'
    or (config ->> 'convention') not in (
      'pool', 'patronymic', 'matronymic', 'family-name', 'none'
    ) then
    return false;
  end if;

  v_type := coalesce(config ->> 'type', 'list');

  if v_type = 'list' then
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

    return true;
  end if;

  if v_type != 'generated' then
    return false;
  end if;

  if octet_length (config::text) > 65536 then
    return false;
  end if;

  if jsonb_typeof (config -> 'parts') != 'object' then
    return false;
  end if;

  select count(*) into v_part_list_count from jsonb_object_keys (config -> 'parts');
  if v_part_list_count > 40 then
    return false;
  end if;

  for v_part_key, v_part_list in
    select key, value from jsonb_each (config -> 'parts')
  loop
    if jsonb_typeof (v_part_list) != 'array' or jsonb_array_length (v_part_list) > 500 then
      return false;
    end if;
    if exists (
      select 1 from jsonb_array_elements (v_part_list) as t (value)
      where jsonb_typeof (t.value) != 'string'
    ) then
      return false;
    end if;
  end loop;

  if jsonb_typeof (config -> 'patterns') != 'object'
    or not (
      config -> 'patterns' ? 'male_given'
      and config -> 'patterns' ? 'female_given'
      and config -> 'patterns' ? 'surname'
    ) then
    return false;
  end if;

  for v_pattern_key, v_pattern in
    select key, value from jsonb_each (config -> 'patterns')
  loop
    if v_pattern_key not in ('male_given', 'female_given', 'surname')
      or jsonb_typeof (v_pattern) != 'array' then
      return false;
    end if;

    for v_element in select value from jsonb_array_elements (v_pattern)
    loop
      if jsonb_typeof (v_element) = 'string' then
        continue;
      end if;

      if jsonb_typeof (v_element) != 'array' or jsonb_array_length (v_element) = 0 then
        return false;
      end if;

      if exists (
        select 1 from jsonb_array_elements (v_element) as t (value)
        where jsonb_typeof (t.value) != 'string'
      ) then
        return false;
      end if;

      for v_list_key in select jsonb_array_elements_text (v_element)
      loop
        if not (config -> 'parts' ? v_list_key) then
          return false;
        end if;
      end loop;
    end loop;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function public.default_naming_config () returns jsonb language sql immutable
set
  search_path = '' as $$
  select
    '{
      "type": "list",
      "male_given_names": [],
      "female_given_names": [],
      "surnames": [],
      "convention": "pool"
    }'::jsonb;
$$;

-- ---------------------------------------------------------------------------
-- §2: Backfill existing rows to the explicit "list" type.
-- ---------------------------------------------------------------------------
update public.namesets
set
  config_json = config_json || jsonb_build_object('type', 'list')
where
  not (config_json ? 'type');

update public.worlds
set
  naming_config_json = naming_config_json || jsonb_build_object('type', 'list')
where
  not (naming_config_json ? 'type');
