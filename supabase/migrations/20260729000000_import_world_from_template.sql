-- Migration: import_world_from_template
-- Adds import_world_from_template(p_name text, p_visibility text, p_template jsonb) RPC.
-- SECURITY DEFINER, superadmin-only.
-- Creates a world then inserts all config entities from the template,
-- remapping slug-based cross-references to fresh UUIDs.
-- Atomic: any exception rolls back the entire import.
--
-- Dependency order (slug → uuid maps built incrementally):
--   world → namesets → resources → jobs → blueprints → deposit_types
--   → managed_population_types
-- ===========================================================================
-- 1. import_world_from_template
-- ===========================================================================
create or replace function public.import_world_from_template (
  p_name text,
  p_visibility text default 'private',
  p_template jsonb default '{}'::jsonb
) returns setof public.worlds language plpgsql security definer
set
  search_path = '' as $$
declare
  -- New world
  v_world     public.worlds%rowtype;
  v_world_id  uuid;

  -- Template version
  v_tmpl_version int;

  -- Slug → new UUID maps stored as jsonb objects: {"slug": "uuid-text", ...}
  v_resource_map jsonb := '{}'::jsonb;
  v_job_map      jsonb := '{}'::jsonb;

  -- Generic loop variables
  v_item        jsonb;
  v_io          jsonb;
  v_tier        jsonb;
  v_effect      jsonb;

  -- Intermediate values
  v_new_uuid       uuid;
  v_blueprint_id   uuid;
  v_res_id         text;
  v_job_id         text;
  v_culling_job_id text;

  -- Per-job/tier JSON accumulators
  v_inputs_json   jsonb;
  v_outputs_json  jsonb;
  v_costs_json    jsonb;
  v_upkeep_json   jsonb;
  v_effects_json  jsonb;
  v_wi_json       jsonb;
  v_maint_json    jsonb;
  v_culling_json  jsonb;
  v_regular_json  jsonb;

begin
  -- -------------------------------------------------------------------------
  -- Guards
  -- -------------------------------------------------------------------------
  if not public.is_super_admin () then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if p_name is null or char_length (trim (p_name)) = 0 then
    raise exception 'World name is required.' using errcode = '22000';
  end if;

  if p_visibility not in ('public', 'private') then
    raise exception 'Visibility must be public or private.' using errcode = '22000';
  end if;

  -- -------------------------------------------------------------------------
  -- Template version check
  -- -------------------------------------------------------------------------
  begin
    v_tmpl_version := (p_template->>'template_version')::int;
  exception when others then
    raise exception 'template_version must be an integer; got %',
      coalesce(p_template->>'template_version', 'null')
      using errcode = '22000';
  end;

  if v_tmpl_version is null or v_tmpl_version != 1 then
    raise exception 'template_version % is not supported; expected 1',
      coalesce(p_template->>'template_version', 'null')
      using errcode = '22000';
  end if;

  -- -------------------------------------------------------------------------
  -- 1. Create world
  -- -------------------------------------------------------------------------
  insert into public.worlds (name, visibility)
  values (trim (p_name), p_visibility)
  returning * into v_world;

  v_world_id := v_world.id;

  -- -------------------------------------------------------------------------
  -- 2. Apply world config (calendar, population rules, npc flavor, naming)
  -- -------------------------------------------------------------------------
  update public.worlds
  set
    calendar_config_json           = p_template->'calendar',
    npc_flavor_config_json         = p_template->'npc_flavor',
    naming_config_json             = p_template->'naming_config',
    fertility_chance               = (p_template->'population_rules'->>'fertility_chance')::numeric,
    food_consumption_per_citizen   = (p_template->'population_rules'->>'food_consumption_per_citizen')::numeric,
    homelessness_decline_rate      = (p_template->'population_rules'->>'homelessness_decline_rate')::numeric,
    incest_prevention_depth        = (p_template->'population_rules'->>'incest_prevention_depth')::int,
    maximum_fertility_age_turns    = (p_template->'population_rules'->>'maximum_fertility_age_turns')::int,
    minimum_partnership_age_turns  = (p_template->'population_rules'->>'minimum_partnership_age_turns')::int,
    mourning_period_turns          = (p_template->'population_rules'->>'mourning_period_turns')::int,
    partnership_seek_chance        = (p_template->'population_rules'->>'partnership_seek_chance')::numeric,
    starvation_severity_multiplier = (p_template->'population_rules'->>'starvation_severity_multiplier')::numeric,
    water_consumption_per_citizen  = (p_template->'population_rules'->>'water_consumption_per_citizen')::numeric,
    updated_at                     = now ()
  where
    id = v_world_id;

  -- -------------------------------------------------------------------------
  -- 3. Namesets
  -- -------------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements (p_template->'namesets')
  loop
    insert into public.namesets (world_id, name, is_default, config_json)
    values (
      v_world_id,
      v_item->>'name',
      (v_item->>'is_default')::boolean,
      v_item->'config'
    );
  end loop;

  -- -------------------------------------------------------------------------
  -- 4. Resources → build slug→uuid map
  -- -------------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements (p_template->'resources')
  loop
    -- ON CONFLICT handles system resources pre-seeded by the after-insert
    -- trigger on public.worlds (seed_world_system_resources).
    insert into public.resources (
      world_id, name, slug, base_stockpile_cap, decay_rate, is_system_resource
    )
    values (
      v_world_id,
      v_item->>'name',
      v_item->>'slug',
      (v_item->>'base_stockpile_cap')::numeric,
      (v_item->>'decay_rate')::numeric,
      (v_item->>'is_system_resource')::boolean
    )
    on conflict (world_id, slug) do update set
      name               = excluded.name,
      base_stockpile_cap = excluded.base_stockpile_cap,
      decay_rate         = excluded.decay_rate,
      is_system_resource = excluded.is_system_resource,
      updated_at         = now ()
    returning id into v_new_uuid;

    v_resource_map := v_resource_map
      || jsonb_build_object (v_item->>'slug', v_new_uuid::text);
  end loop;

  -- -------------------------------------------------------------------------
  -- 5. Jobs → build slug→uuid map
  --    inputs_json/outputs_json: [{resource_id, amount_per_worker, notes?}]
  -- -------------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements (p_template->'jobs')
  loop
    -- Build inputs_json
    v_inputs_json := '[]'::jsonb;
    for v_io in
      select value from jsonb_array_elements (v_item->'inputs')
    loop
      v_res_id := v_resource_map->>(v_io->>'resource_slug');
      if v_res_id is null then
        raise exception
          'dangling resource reference "%" in job "%" inputs',
          v_io->>'resource_slug', v_item->>'slug'
          using errcode = '22000';
      end if;

      if v_io ? 'notes' then
        v_inputs_json := v_inputs_json || jsonb_build_array (
          jsonb_build_object (
            'resource_id',       v_res_id,
            'amount_per_worker', (v_io->>'amount_per_worker')::numeric,
            'notes',             v_io->>'notes'
          )
        );
      else
        v_inputs_json := v_inputs_json || jsonb_build_array (
          jsonb_build_object (
            'resource_id',       v_res_id,
            'amount_per_worker', (v_io->>'amount_per_worker')::numeric
          )
        );
      end if;
    end loop;

    -- Build outputs_json
    v_outputs_json := '[]'::jsonb;
    for v_io in
      select value from jsonb_array_elements (v_item->'outputs')
    loop
      v_res_id := v_resource_map->>(v_io->>'resource_slug');
      if v_res_id is null then
        raise exception
          'dangling resource reference "%" in job "%" outputs',
          v_io->>'resource_slug', v_item->>'slug'
          using errcode = '22000';
      end if;

      if v_io ? 'notes' then
        v_outputs_json := v_outputs_json || jsonb_build_array (
          jsonb_build_object (
            'resource_id',       v_res_id,
            'amount_per_worker', (v_io->>'amount_per_worker')::numeric,
            'notes',             v_io->>'notes'
          )
        );
      else
        v_outputs_json := v_outputs_json || jsonb_build_array (
          jsonb_build_object (
            'resource_id',       v_res_id,
            'amount_per_worker', (v_io->>'amount_per_worker')::numeric
          )
        );
      end if;
    end loop;

    insert into public.job_definitions (
      world_id, name, slug, job_type, base_capacity,
      trader_capacity_per_worker, inputs_json, outputs_json
    )
    values (
      v_world_id,
      v_item->>'name',
      v_item->>'slug',
      v_item->>'job_type',
      (v_item->>'base_capacity')::numeric,
      (v_item->>'trader_capacity_per_worker')::numeric,
      v_inputs_json,
      v_outputs_json
    )
    returning id into v_new_uuid;

    v_job_map := v_job_map
      || jsonb_build_object (v_item->>'slug', v_new_uuid::text);
  end loop;

  -- -------------------------------------------------------------------------
  -- 6. Blueprints + tiers
  --    construction_costs_json / upkeep_costs_json: [{resource_id, amount}]
  --    effects_json: [{type, amount, resource_id?, job_id?}]
  -- -------------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements (p_template->'blueprints')
  loop
    insert into public.building_blueprints (
      world_id, name, slug, description,
      max_instances_per_settlement, grace_period_turns
    )
    values (
      v_world_id,
      v_item->>'name',
      v_item->>'slug',
      v_item->>'description',
      (v_item->>'max_instances_per_settlement')::int,
      (v_item->>'grace_period_turns')::int
    )
    returning id into v_blueprint_id;

    for v_tier in
      select value from jsonb_array_elements (v_item->'tiers')
    loop
      -- construction_costs_json
      v_costs_json := '[]'::jsonb;
      for v_io in
        select value from jsonb_array_elements (v_tier->'construction_costs')
      loop
        v_res_id := v_resource_map->>(v_io->>'resource_slug');
        if v_res_id is null then
          raise exception
            'dangling resource reference "%" in blueprint "%" tier % construction costs',
            v_io->>'resource_slug', v_item->>'slug', v_tier->>'tier_number'
            using errcode = '22000';
        end if;
        v_costs_json := v_costs_json || jsonb_build_array (
          jsonb_build_object ('resource_id', v_res_id, 'amount', (v_io->>'amount')::numeric)
        );
      end loop;

      -- upkeep_costs_json
      v_upkeep_json := '[]'::jsonb;
      for v_io in
        select value from jsonb_array_elements (v_tier->'upkeep_costs')
      loop
        v_res_id := v_resource_map->>(v_io->>'resource_slug');
        if v_res_id is null then
          raise exception
            'dangling resource reference "%" in blueprint "%" tier % upkeep costs',
            v_io->>'resource_slug', v_item->>'slug', v_tier->>'tier_number'
            using errcode = '22000';
        end if;
        v_upkeep_json := v_upkeep_json || jsonb_build_array (
          jsonb_build_object ('resource_id', v_res_id, 'amount', (v_io->>'amount')::numeric)
        );
      end loop;

      -- effects_json
      v_effects_json := '[]'::jsonb;
      for v_effect in
        select value from jsonb_array_elements (v_tier->'effects')
      loop
        if (v_effect->>'type') = 'population_cap_increase' then
          v_effects_json := v_effects_json || jsonb_build_array (
            jsonb_build_object (
              'type',   'population_cap_increase',
              'amount', (v_effect->>'amount')::numeric
            )
          );

        elsif (v_effect->>'type') = 'job_capacity_increase' then
          v_job_id := v_job_map->>(v_effect->>'job_slug');
          if v_job_id is null then
            raise exception
              'dangling job reference "%" in blueprint "%" tier % effects',
              v_effect->>'job_slug', v_item->>'slug', v_tier->>'tier_number'
              using errcode = '22000';
          end if;
          v_effects_json := v_effects_json || jsonb_build_array (
            jsonb_build_object (
              'type',   'job_capacity_increase',
              'job_id', v_job_id,
              'amount', (v_effect->>'amount')::numeric
            )
          );

        elsif (v_effect->>'type') = 'passive_resource_production' then
          v_res_id := v_resource_map->>(v_effect->>'resource_slug');
          if v_res_id is null then
            raise exception
              'dangling resource reference "%" in blueprint "%" tier % effects',
              v_effect->>'resource_slug', v_item->>'slug', v_tier->>'tier_number'
              using errcode = '22000';
          end if;
          v_effects_json := v_effects_json || jsonb_build_array (
            jsonb_build_object (
              'type',        'passive_resource_production',
              'resource_id', v_res_id,
              'amount',      (v_effect->>'amount')::numeric
            )
          );

        elsif (v_effect->>'type') = 'resource_storage_increase' then
          v_res_id := v_resource_map->>(v_effect->>'resource_slug');
          if v_res_id is null then
            raise exception
              'dangling resource reference "%" in blueprint "%" tier % effects',
              v_effect->>'resource_slug', v_item->>'slug', v_tier->>'tier_number'
              using errcode = '22000';
          end if;
          v_effects_json := v_effects_json || jsonb_build_array (
            jsonb_build_object (
              'type',        'resource_storage_increase',
              'resource_id', v_res_id,
              'amount',      (v_effect->>'amount')::numeric
            )
          );

        else
          raise exception
            'unknown effect type "%" in blueprint "%" tier %',
            v_effect->>'type', v_item->>'slug', v_tier->>'tier_number'
            using errcode = '22000';
        end if;
      end loop;

      insert into public.building_blueprint_tiers (
        building_blueprint_id, tier_number, worker_turns_required,
        construction_costs_json, upkeep_costs_json, effects_json
      )
      values (
        v_blueprint_id,
        (v_tier->>'tier_number')::int,
        (v_tier->>'worker_turns_required')::numeric,
        v_costs_json,
        v_upkeep_json,
        v_effects_json
      );
    end loop;
  end loop;

  -- -------------------------------------------------------------------------
  -- 7. Deposit types
  --    worker_inputs_json: [{resource_id, amount_per_worker}]
  -- -------------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements (p_template->'deposit_types')
  loop
    v_job_id := v_job_map->>(v_item->>'job_slug');
    if v_job_id is null then
      raise exception
        'dangling job reference "%" in deposit type "%"',
        v_item->>'job_slug', v_item->>'slug'
        using errcode = '22000';
    end if;

    v_wi_json := '[]'::jsonb;
    for v_io in
      select value from jsonb_array_elements (v_item->'worker_inputs')
    loop
      v_res_id := v_resource_map->>(v_io->>'resource_slug');
      if v_res_id is null then
        raise exception
          'dangling resource reference "%" in deposit type "%" worker inputs',
          v_io->>'resource_slug', v_item->>'slug'
          using errcode = '22000';
      end if;
      v_wi_json := v_wi_json || jsonb_build_array (
        jsonb_build_object (
          'resource_id',       v_res_id,
          'amount_per_worker', (v_io->>'amount_per_worker')::numeric
        )
      );
    end loop;

    insert into public.deposit_types (
      world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json
    )
    values (
      v_world_id,
      v_item->>'name',
      v_item->>'slug',
      v_job_id::uuid,
      (v_item->>'output_units_per_worker')::numeric,
      v_wi_json
    );
  end loop;

  -- -------------------------------------------------------------------------
  -- 8. Managed population types
  --    maintenance_rules_json / culling_outputs_json / regular_outputs_json:
  --    [{resource_id, amount_per_n_animals}]
  -- -------------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements (p_template->'managed_population_types')
  loop
    v_job_id := v_job_map->>(v_item->>'husbandry_job_slug');
    if v_job_id is null then
      raise exception
        'dangling job reference "%" in managed population type "%" husbandry_job_slug',
        v_item->>'husbandry_job_slug', v_item->>'slug'
        using errcode = '22000';
    end if;

      v_culling_job_id := v_job_map->>(v_item->>'culling_job_slug');
      if v_culling_job_id is null then
        raise exception
          'dangling job reference "%" in managed population type "%" culling_job_slug',
          v_item->>'culling_job_slug', v_item->>'slug'
          using errcode = '22000';
      end if;

      -- maintenance_rules_json
      v_maint_json := '[]'::jsonb;
      for v_io in
        select value from jsonb_array_elements (v_item->'maintenance_rules')
      loop
        v_res_id := v_resource_map->>(v_io->>'resource_slug');
        if v_res_id is null then
          raise exception
            'dangling resource reference "%" in managed pop type "%" maintenance_rules',
            v_io->>'resource_slug', v_item->>'slug'
            using errcode = '22000';
        end if;
        v_maint_json := v_maint_json || jsonb_build_array (
          jsonb_build_object (
            'resource_id',        v_res_id,
            'amount_per_n_animals', (v_io->>'amount_per_n_animals')::numeric
          )
        );
      end loop;

      -- culling_outputs_json
      v_culling_json := '[]'::jsonb;
      for v_io in
        select value from jsonb_array_elements (v_item->'culling_outputs')
      loop
        v_res_id := v_resource_map->>(v_io->>'resource_slug');
        if v_res_id is null then
          raise exception
            'dangling resource reference "%" in managed pop type "%" culling_outputs',
            v_io->>'resource_slug', v_item->>'slug'
            using errcode = '22000';
        end if;
        v_culling_json := v_culling_json || jsonb_build_array (
          jsonb_build_object (
            'resource_id',        v_res_id,
            'amount_per_n_animals', (v_io->>'amount_per_n_animals')::numeric
          )
        );
      end loop;

      -- regular_outputs_json
      v_regular_json := '[]'::jsonb;
      for v_io in
        select value from jsonb_array_elements (v_item->'regular_outputs')
      loop
        v_res_id := v_resource_map->>(v_io->>'resource_slug');
        if v_res_id is null then
          raise exception
            'dangling resource reference "%" in managed pop type "%" regular_outputs',
            v_io->>'resource_slug', v_item->>'slug'
            using errcode = '22000';
        end if;
        v_regular_json := v_regular_json || jsonb_build_array (
          jsonb_build_object (
            'resource_id',        v_res_id,
            'amount_per_n_animals', (v_io->>'amount_per_n_animals')::numeric
          )
        );
      end loop;

      insert into public.managed_population_types (
        world_id, name, slug,
        husbandry_job_id, culling_job_id,
        husbandry_workers_per_n_animals, growth_rate,
        maintenance_rules_json, culling_outputs_json, regular_outputs_json
      )
      values (
        v_world_id,
        v_item->>'name',
        v_item->>'slug',
        v_job_id::uuid,
        v_culling_job_id::uuid,
        (v_item->>'husbandry_workers_per_n_animals')::numeric,
        (v_item->>'growth_rate')::numeric,
        v_maint_json,
        v_culling_json,
        v_regular_json
      );
  end loop;

  -- -------------------------------------------------------------------------
  -- 9. Return the new world row
  -- -------------------------------------------------------------------------
  return query
  select *
  from public.worlds w
  where w.id = v_world_id;
end;
$$;

-- ===========================================================================
-- 2. Permissions
-- ===========================================================================
revoke all on function public.import_world_from_template (text, text, jsonb)
from
  public;

grant
execute on function public.import_world_from_template (text, text, jsonb) to authenticated;
