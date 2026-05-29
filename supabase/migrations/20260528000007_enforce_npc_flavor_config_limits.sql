-- Migration: enforce_npc_flavor_config_limits
-- Updates is_valid_npc_flavor_config to enforce pool size and per-entry length
-- caps matching the constants in `src/lib/inputLimits.ts`
-- (npcFlavorInputLimits.poolSizeMax = 100, poolEntryMax = 200).
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_npc_flavor_config (config jsonb) returns boolean language plpgsql immutable
set
  search_path = '' as $$
declare
  pool_size_max constant integer := 100;
  pool_entry_max constant integer := 200;
begin
  if config is null or jsonb_typeof(config) != 'object' then
    return false;
  end if;

  if not (config ?& array['traits', 'contradictions', 'goals', 'flaws']) then
    return false;
  end if;

  if jsonb_typeof(config -> 'traits') != 'array'
     or jsonb_typeof(config -> 'contradictions') != 'array'
     or jsonb_typeof(config -> 'goals') != 'array'
     or jsonb_typeof(config -> 'flaws') != 'array' then
    return false;
  end if;

  if jsonb_array_length(config -> 'traits') > pool_size_max
     or jsonb_array_length(config -> 'contradictions') > pool_size_max
     or jsonb_array_length(config -> 'goals') > pool_size_max
     or jsonb_array_length(config -> 'flaws') > pool_size_max then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(config -> 'traits') as t (value)
    where jsonb_typeof(t.value) != 'string'
      or char_length(btrim(t.value #>> '{}')) < 1
      or char_length(t.value #>> '{}') > pool_entry_max
  )
  or exists (
    select 1
    from jsonb_array_elements(config -> 'contradictions') as t (value)
    where jsonb_typeof(t.value) != 'string'
      or char_length(btrim(t.value #>> '{}')) < 1
      or char_length(t.value #>> '{}') > pool_entry_max
  )
  or exists (
    select 1
    from jsonb_array_elements(config -> 'goals') as t (value)
    where jsonb_typeof(t.value) != 'string'
      or char_length(btrim(t.value #>> '{}')) < 1
      or char_length(t.value #>> '{}') > pool_entry_max
  )
  or exists (
    select 1
    from jsonb_array_elements(config -> 'flaws') as t (value)
    where jsonb_typeof(t.value) != 'string'
      or char_length(btrim(t.value #>> '{}')) < 1
      or char_length(t.value #>> '{}') > pool_entry_max
  ) then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;
