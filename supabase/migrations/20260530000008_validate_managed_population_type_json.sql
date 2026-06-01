-- Migration: validate_managed_population_type_json
-- Adds shape and referential validation for maintenance_rules_json and
-- culling_outputs_json on managed_population_types.
-- Each element must be a { resource_id, amount_per_n_animals } object.
-- Extra keys are rejected.  resource_id must reference a non-deleted resource
-- in the same world.  Empty arrays are allowed.
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_population_resource_array (arr jsonb, p_world_id uuid) returns boolean language plpgsql stable
set
  search_path = '' as $$
begin
  if arr is null or jsonb_typeof (arr) != 'array' then
    return false;
  end if;

  -- Validate shape of every element
  if exists (
    select
      1
    from
      jsonb_array_elements (arr) as e (entry)
    where
      jsonb_typeof (e.entry) != 'object'
      or not (e.entry ? 'resource_id')
      or jsonb_typeof (e.entry -> 'resource_id') != 'string'
      or not (e.entry ? 'amount_per_n_animals')
      or jsonb_typeof (e.entry -> 'amount_per_n_animals') != 'number'
      or (e.entry - '{resource_id,amount_per_n_animals}'::text[]) != '{}'::jsonb
  ) then
    return false;
  end if;

  -- Validate each resource_id references a live resource in the same world
  if exists (
    select
      1
    from
      jsonb_array_elements (arr) as e (entry)
    where
      not exists (
        select
          1
        from
          public.resources r
        where
          r.id = (e.entry ->> 'resource_id')::uuid
          and r.world_id = p_world_id
          and not r.is_deleted
      )
  ) then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

alter table public.managed_population_types
add constraint managed_population_types_maintenance_rules_json_check check (
  public.is_valid_population_resource_array (maintenance_rules_json, world_id)
),
add constraint managed_population_types_culling_outputs_json_check check (
  public.is_valid_population_resource_array (culling_outputs_json, world_id)
);
