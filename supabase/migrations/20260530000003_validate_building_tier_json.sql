-- Migration: validate_building_tier_json
-- Adds shape and referential validation for construction_costs_json,
-- upkeep_costs_json, and effects_json on building_blueprint_tiers via a
-- BEFORE INSERT OR UPDATE trigger.
--
-- construction_costs_json / upkeep_costs_json:
--   Array of { resource_id: string, amount: number } objects.
--   resource_id must reference a non-deleted resource in the same world.
--
-- effects_json:
--   Array of tagged effect objects. Allowed discriminated types:
--     job_capacity_increase       { type, job_id, amount }
--     passive_resource_production { type, resource_id, amount }
--     resource_storage_increase   { type, resource_id, amount }
--     population_cap_increase     { type, amount }
--   resource_id / job_id must reference non-deleted / active records in the
--   same world.  Extra keys are rejected.
-- ---------------------------------------------------------------------------
-- is_valid_resource_cost_array
-- Validates an array of {resource_id, amount} objects.  Empty arrays pass.
create or replace function public.is_valid_resource_cost_array (arr jsonb, p_world_id uuid) returns boolean language plpgsql stable
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
      or not (e.entry ? 'amount')
      or jsonb_typeof (e.entry -> 'amount') != 'number'
      or (e.entry - '{resource_id,amount}'::text[]) != '{}'::jsonb
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

-- is_valid_tier_effects_array
-- Validates effects_json.  Empty arrays pass.
create or replace function public.is_valid_tier_effects_array (arr jsonb, p_world_id uuid) returns boolean language plpgsql stable
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
      or not (e.entry ? 'type')
      or jsonb_typeof (e.entry -> 'type') != 'string'
      or not (e.entry ->> 'type') = any (
        array[
          'job_capacity_increase',
          'passive_resource_production',
          'resource_storage_increase',
          'population_cap_increase'
        ]
      )
      or not (e.entry ? 'amount')
      or jsonb_typeof (e.entry -> 'amount') != 'number'
      -- job_capacity_increase: requires job_id string; no extra keys
      or (
        (e.entry ->> 'type') = 'job_capacity_increase'
        and (
          not (e.entry ? 'job_id')
          or jsonb_typeof (e.entry -> 'job_id') != 'string'
          or (e.entry - '{type,job_id,amount}'::text[]) != '{}'::jsonb
        )
      )
      -- passive_resource_production: requires resource_id string; no extra keys
      or (
        (e.entry ->> 'type') = 'passive_resource_production'
        and (
          not (e.entry ? 'resource_id')
          or jsonb_typeof (e.entry -> 'resource_id') != 'string'
          or (e.entry - '{type,resource_id,amount}'::text[]) != '{}'::jsonb
        )
      )
      -- resource_storage_increase: requires resource_id string; no extra keys
      or (
        (e.entry ->> 'type') = 'resource_storage_increase'
        and (
          not (e.entry ? 'resource_id')
          or jsonb_typeof (e.entry -> 'resource_id') != 'string'
          or (e.entry - '{type,resource_id,amount}'::text[]) != '{}'::jsonb
        )
      )
      -- population_cap_increase: only type and amount allowed
      or (
        (e.entry ->> 'type') = 'population_cap_increase'
        and (e.entry - '{type,amount}'::text[]) != '{}'::jsonb
      )
  ) then
    return false;
  end if;

  -- Validate resource_id references for resource-based effect types
  if exists (
    select
      1
    from
      jsonb_array_elements (arr) as e (entry)
    where
      (e.entry ->> 'type') in ('passive_resource_production', 'resource_storage_increase')
      and not exists (
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

  -- Validate job_id references for job_capacity_increase effects
  if exists (
    select
      1
    from
      jsonb_array_elements (arr) as e (entry)
    where
      (e.entry ->> 'type') = 'job_capacity_increase'
      and not exists (
        select
          1
        from
          public.job_definitions j
        where
          j.id = (e.entry ->> 'job_id')::uuid
          and j.world_id = p_world_id
          and j.is_active
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

-- validate_building_tier_json
-- BEFORE trigger: resolves world_id from the parent blueprint and delegates to
-- the two helper functions above.
create or replace function public.validate_building_tier_json () returns trigger language plpgsql
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  select
    bb.world_id
  into
    v_world_id
  from
    public.building_blueprints bb
  where
    bb.id = new.building_blueprint_id;

  if not public.is_valid_resource_cost_array (new.construction_costs_json, v_world_id) then
    raise exception 'construction_costs_json is invalid'
      using errcode = 'P0001';
  end if;

  if not public.is_valid_resource_cost_array (new.upkeep_costs_json, v_world_id) then
    raise exception 'upkeep_costs_json is invalid'
      using errcode = 'P0001';
  end if;

  if not public.is_valid_tier_effects_array (new.effects_json, v_world_id) then
    raise exception 'effects_json is invalid'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger building_blueprint_tiers_validate_json before insert
or
update on public.building_blueprint_tiers for each row
execute function public.validate_building_tier_json ();
