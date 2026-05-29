-- Migration: add_world_npc_flavor_config
-- Adds per-world NPC flavor pool configuration.
-- ---------------------------------------------------------------------------
create or replace function public.default_npc_flavor_config () returns jsonb language sql immutable
set
  search_path = '' as $$
  select
    '{
      "traits": ["earnest", "wry", "patient", "haunted", "boisterous"],
      "contradictions": ["mourns a friend they betrayed", "loves their rival"],
      "goals": ["a seat on the council", "to restore their family''s name"],
      "flaws": ["pride", "envy", "an addiction to risk"]
    }'::jsonb;
$$;

create or replace function public.is_valid_npc_flavor_config (config jsonb) returns boolean language plpgsql immutable
set
  search_path = '' as $$
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

  if exists (
    select 1
    from jsonb_array_elements(config -> 'traits') as t (value)
    where jsonb_typeof(t.value) != 'string'
  )
  or exists (
    select 1
    from jsonb_array_elements(config -> 'contradictions') as t (value)
    where jsonb_typeof(t.value) != 'string'
  )
  or exists (
    select 1
    from jsonb_array_elements(config -> 'goals') as t (value)
    where jsonb_typeof(t.value) != 'string'
  )
  or exists (
    select 1
    from jsonb_array_elements(config -> 'flaws') as t (value)
    where jsonb_typeof(t.value) != 'string'
  ) then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

alter table public.worlds
add column npc_flavor_config_json jsonb not null default public.default_npc_flavor_config (),
add constraint worlds_npc_flavor_config_json_check check (
  public.is_valid_npc_flavor_config (npc_flavor_config_json)
);

grant
update (npc_flavor_config_json) on public.worlds to authenticated;
