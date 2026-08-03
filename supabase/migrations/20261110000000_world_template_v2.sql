-- Migration: world_template_v2
-- Issue #1236: world-template format v2 -- extends import_world_from_template
-- to cover the world-level config layer added since v1: resource categories,
-- education levels (with natural_born_percent), cultures, religions, unit
-- types, entity icons, resource/job education-gating refs, and the
-- education-effect tier variant. v1 templates are rejected outright.
-- Function signature (p_name text, p_template jsonb) is unchanged from
-- 20261108000000_remove_world_visibility.sql -- only the body changes, so a
-- plain CREATE OR REPLACE suffices (no DROP/re-GRANT needed).
-- ---------------------------------------------------------------------------
create or replace function public.import_world_from_template (p_name text, p_template jsonb default '{}'::jsonb) returns setof public.worlds language plpgsql security definer
set
  search_path = '' as $$
declare
  -- New world
  v_world     public.worlds%rowtype;
  v_world_id  uuid;

  -- Template version
  v_tmpl_version int;

  -- Name/slug → new UUID maps stored as jsonb objects: {"key": "uuid-text", ...}
  v_category_map  jsonb := '{}'::jsonb;
  v_education_map jsonb := '{}'::jsonb;
  v_resource_map  jsonb := '{}'::jsonb;
  v_job_map       jsonb := '{}'::jsonb;
  v_blueprint_map jsonb := '{}'::jsonb;

  -- Generic loop variables
  v_item        jsonb;
  v_io          jsonb;
  v_tier        jsonb;
  v_effect      jsonb;
  v_level       jsonb;

  -- Intermediate values
  v_new_uuid          uuid;
  v_blueprint_id      uuid;
  v_res_id            text;
  v_job_id            text;
  v_culling_job_id     text;
  v_category_id       text;
  v_education_level_id text;
  v_from_level_id      text;
  v_to_level_id        text;
  v_required_building  jsonb;
  v_req_blueprint_id   text;
  v_req_tier_number    int;

  -- Per-job/tier JSON accumulators
  v_inputs_json      jsonb;
  v_outputs_json     jsonb;
  v_costs_json       jsonb;
  v_upkeep_json      jsonb;
  v_effects_json     jsonb;
  v_edu_levels_json  jsonb;
  v_wi_json          jsonb;
  v_maint_json       jsonb;
  v_culling_json     jsonb;
  v_regular_json     jsonb;
  v_recruit_json     jsonb;
  v_unit_upkeep_json jsonb;

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

  if v_tmpl_version is null or v_tmpl_version != 2 then
    raise exception 'template_version % is not supported; expected 2',
      coalesce(p_template->>'template_version', 'null')
      using errcode = '22000';
  end if;

  -- -------------------------------------------------------------------------
  -- 1. Create world
  -- -------------------------------------------------------------------------
  insert into public.worlds (name)
  values (trim (p_name))
  returning * into v_world;

  v_world_id := v_world.id;

  -- -------------------------------------------------------------------------
  -- 2. Apply world config (calendar, population rules, npc flavor, naming).
  --    Calendar JSON is stored verbatim, so shortDateFormatTemplate (if
  --    present) flows through unchanged.
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
  -- 4. Resource categories → build name→uuid map
  -- -------------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements (coalesce (p_template->'resource_categories', '[]'::jsonb))
  loop
    insert into public.resource_categories (world_id, name, icon, color, sort_order)
    values (
      v_world_id,
      v_item->>'name',
      v_item->>'icon',
      v_item->>'color',
      (v_item->>'sort_order')::int
    )
    returning id into v_new_uuid;

    v_category_map := v_category_map
      || jsonb_build_object (v_item->>'name', v_new_uuid::text);
  end loop;

  -- -------------------------------------------------------------------------
  -- 5. Education levels → build name→uuid map. natural_born_percent sum ≤
  --    100 is enforced per-world by
  --    enforce_education_levels_natural_born_percent_limit (a BEFORE INSERT
  --    trigger on education_levels), so no explicit check is needed here.
  -- -------------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements (coalesce (p_template->'education_levels', '[]'::jsonb))
  loop
    insert into public.education_levels (world_id, name, description, rank, natural_born_percent)
    values (
      v_world_id,
      v_item->>'name',
      v_item->>'description',
      (v_item->>'rank')::int,
      (v_item->>'natural_born_percent')::numeric
    )
    returning id into v_new_uuid;

    v_education_map := v_education_map
      || jsonb_build_object (v_item->>'name', v_new_uuid::text);
  end loop;

  -- -------------------------------------------------------------------------
  -- 6. Cultures / religions -- record-keeping only, not referenced elsewhere
  --    in the template, so no map is built.
  -- -------------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements (coalesce (p_template->'cultures', '[]'::jsonb))
  loop
    insert into public.cultures (world_id, name, description, color)
    values (v_world_id, v_item->>'name', v_item->>'description', v_item->>'color');
  end loop;

  for v_item in
    select value from jsonb_array_elements (coalesce (p_template->'religions', '[]'::jsonb))
  loop
    insert into public.religions (world_id, name, description, color)
    values (v_world_id, v_item->>'name', v_item->>'description', v_item->>'color');
  end loop;

  -- -------------------------------------------------------------------------
  -- 7. Resources (+icon, category_id) → build slug→uuid map
  -- -------------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements (p_template->'resources')
  loop
    if v_item->>'category' is not null then
      v_category_id := v_category_map->>(v_item->>'category');
      if v_category_id is null then
        raise exception
          'dangling resource category reference "%" in resource "%"',
          v_item->>'category', v_item->>'slug'
          using errcode = '22000';
      end if;
    else
      v_category_id := null;
    end if;

    -- ON CONFLICT handles system resources pre-seeded by the after-insert
    -- trigger on public.worlds (seed_world_system_resources).
    insert into public.resources (
      world_id, name, slug, base_stockpile_cap, change_mode, change_amount,
      is_system_resource, icon, category_id
    )
    values (
      v_world_id,
      v_item->>'name',
      v_item->>'slug',
      (v_item->>'base_stockpile_cap')::numeric,
      v_item->>'change_mode',
      (v_item->>'change_amount')::numeric,
      (v_item->>'is_system_resource')::boolean,
      v_item->>'icon',
      v_category_id::uuid
    )
    on conflict (world_id, slug) do update set
      name               = excluded.name,
      base_stockpile_cap = excluded.base_stockpile_cap,
      change_mode        = excluded.change_mode,
      change_amount      = excluded.change_amount,
      is_system_resource = excluded.is_system_resource,
      icon               = excluded.icon,
      category_id        = excluded.category_id,
      updated_at         = now ()
    returning id into v_new_uuid;

    v_resource_map := v_resource_map
      || jsonb_build_object (v_item->>'slug', v_new_uuid::text);
  end loop;

  -- -------------------------------------------------------------------------
  -- 8. Jobs (+icon, required_education_level_id) → build slug→uuid map
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

    if v_item->>'required_education_level' is not null then
      v_education_level_id := v_education_map->>(v_item->>'required_education_level');
      if v_education_level_id is null then
        raise exception
          'dangling education level reference "%" in job "%"',
          v_item->>'required_education_level', v_item->>'slug'
          using errcode = '22000';
      end if;
    else
      v_education_level_id := null;
    end if;

    insert into public.job_definitions (
      world_id, name, slug, job_type, base_capacity,
      trader_capacity_per_worker, inputs_json, outputs_json,
      icon, required_education_level_id
    )
    values (
      v_world_id,
      v_item->>'name',
      v_item->>'slug',
      v_item->>'job_type',
      (v_item->>'base_capacity')::numeric,
      (v_item->>'trader_capacity_per_worker')::numeric,
      v_inputs_json,
      v_outputs_json,
      v_item->>'icon',
      v_education_level_id::uuid
    )
    returning id into v_new_uuid;

    v_job_map := v_job_map
      || jsonb_build_object (v_item->>'slug', v_new_uuid::text);
  end loop;

  -- -------------------------------------------------------------------------
  -- 9. Blueprints (+icon) + tiers
  --    construction_costs_json / upkeep_costs_json: [{resource_id, amount}]
  --    effects_json: [{type, amount, resource_id?, job_id?}] plus the
  --    'education' variant: {type, teacher_job_id, teacher_capacity,
  --    students_per_teacher, levels: [{from_level_id, to_level_id, turns}]}
  -- -------------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements (p_template->'blueprints')
  loop
    insert into public.building_blueprints (
      world_id, name, slug, description,
      max_instances_per_settlement, grace_period_turns, icon
    )
    values (
      v_world_id,
      v_item->>'name',
      v_item->>'slug',
      v_item->>'description',
      (v_item->>'max_instances_per_settlement')::int,
      (v_item->>'grace_period_turns')::int,
      v_item->>'icon'
    )
    returning id into v_blueprint_id;

    v_blueprint_map := v_blueprint_map
      || jsonb_build_object (v_item->>'slug', v_blueprint_id::text);

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

        elsif (v_effect->>'type') = 'education' then
          v_job_id := v_job_map->>(v_effect->>'teacher_job_slug');
          if v_job_id is null then
            raise exception
              'dangling job reference "%" in blueprint "%" tier % effects',
              v_effect->>'teacher_job_slug', v_item->>'slug', v_tier->>'tier_number'
              using errcode = '22000';
          end if;

          v_edu_levels_json := '[]'::jsonb;
          for v_level in
            select value from jsonb_array_elements (v_effect->'levels')
          loop
            if v_level->'from_level' is null or jsonb_typeof (v_level->'from_level') = 'null' then
              v_from_level_id := null;
            else
              v_from_level_id := v_education_map->>(v_level->>'from_level');
              if v_from_level_id is null then
                raise exception
                  'dangling education level reference "%" in blueprint "%" tier % effects',
                  v_level->>'from_level', v_item->>'slug', v_tier->>'tier_number'
                  using errcode = '22000';
              end if;
            end if;

            v_to_level_id := v_education_map->>(v_level->>'to_level');
            if v_to_level_id is null then
              raise exception
                'dangling education level reference "%" in blueprint "%" tier % effects',
                v_level->>'to_level', v_item->>'slug', v_tier->>'tier_number'
                using errcode = '22000';
            end if;

            v_edu_levels_json := v_edu_levels_json || jsonb_build_array (
              jsonb_build_object (
                'from_level_id', v_from_level_id,
                'to_level_id',   v_to_level_id,
                'turns',         (v_level->>'turns')::int
              )
            );
          end loop;

          v_effects_json := v_effects_json || jsonb_build_array (
            jsonb_build_object (
              'type',                 'education',
              'teacher_job_id',       v_job_id,
              'teacher_capacity',     (v_effect->>'teacher_capacity')::int,
              'students_per_teacher', (v_effect->>'students_per_teacher')::int,
              'levels',               v_edu_levels_json
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
  -- 10. Deposit types (+icon)
  --     worker_inputs_json: [{resource_id, amount_per_worker}]
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
      world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json, icon
    )
    values (
      v_world_id,
      v_item->>'name',
      v_item->>'slug',
      v_job_id::uuid,
      (v_item->>'output_units_per_worker')::numeric,
      v_wi_json,
      v_item->>'icon'
    );
  end loop;

  -- -------------------------------------------------------------------------
  -- 11. Managed population types (+icon)
  --     maintenance_rules_json / culling_outputs_json / regular_outputs_json:
  --     [{resource_id, amount_per_n_animals}]
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
      maintenance_rules_json, culling_outputs_json, regular_outputs_json, icon
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
      v_regular_json,
      v_item->>'icon'
    );
  end loop;

  -- -------------------------------------------------------------------------
  -- 12. Unit types (education level ref, blueprint+tier composite ref, cost
  --     resource refs)
  -- -------------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements (coalesce (p_template->'unit_types', '[]'::jsonb))
  loop
    if v_item->>'required_education_level' is not null then
      v_education_level_id := v_education_map->>(v_item->>'required_education_level');
      if v_education_level_id is null then
        raise exception
          'dangling education level reference "%" in unit type "%"',
          v_item->>'required_education_level', v_item->>'name'
          using errcode = '22000';
      end if;
    else
      v_education_level_id := null;
    end if;

    v_required_building := v_item->'required_building';
    if v_required_building is not null and jsonb_typeof (v_required_building) != 'null' then
      v_req_blueprint_id := v_blueprint_map->>(v_required_building->>'blueprint_slug');
      if v_req_blueprint_id is null then
        raise exception
          'dangling blueprint reference "%" in unit type "%"',
          v_required_building->>'blueprint_slug', v_item->>'name'
          using errcode = '22000';
      end if;

      v_req_tier_number := (v_required_building->>'tier_number')::int;

      if not exists (
        select 1 from public.building_blueprint_tiers
        where building_blueprint_id = v_req_blueprint_id::uuid
          and tier_number = v_req_tier_number
      ) then
        raise exception
          'dangling blueprint tier reference "%" tier % in unit type "%"',
          v_required_building->>'blueprint_slug', v_req_tier_number, v_item->>'name'
          using errcode = '22000';
      end if;
    else
      v_req_blueprint_id := null;
      v_req_tier_number := null;
    end if;

    v_recruit_json := '[]'::jsonb;
    for v_io in
      select value from jsonb_array_elements (v_item->'recruitment_costs')
    loop
      v_res_id := v_resource_map->>(v_io->>'resource_slug');
      if v_res_id is null then
        raise exception
          'dangling resource reference "%" in unit type "%" recruitment costs',
          v_io->>'resource_slug', v_item->>'name'
          using errcode = '22000';
      end if;
      v_recruit_json := v_recruit_json || jsonb_build_array (
        jsonb_build_object ('resource_id', v_res_id, 'amount', (v_io->>'amount')::numeric)
      );
    end loop;

    v_unit_upkeep_json := '[]'::jsonb;
    for v_io in
      select value from jsonb_array_elements (v_item->'upkeep_costs')
    loop
      v_res_id := v_resource_map->>(v_io->>'resource_slug');
      if v_res_id is null then
        raise exception
          'dangling resource reference "%" in unit type "%" upkeep costs',
          v_io->>'resource_slug', v_item->>'name'
          using errcode = '22000';
      end if;
      v_unit_upkeep_json := v_unit_upkeep_json || jsonb_build_array (
        jsonb_build_object ('resource_id', v_res_id, 'amount', (v_io->>'amount')::numeric)
      );
    end loop;

    insert into public.unit_types (
      world_id, name, description, soldiers_per_unit,
      required_education_level_id, required_building_blueprint_id, required_building_tier_number,
      recruitment_costs_json, upkeep_costs_json, desertion_rate
    )
    values (
      v_world_id,
      v_item->>'name',
      v_item->>'description',
      (v_item->>'soldiers_per_unit')::int,
      v_education_level_id::uuid,
      v_req_blueprint_id::uuid,
      v_req_tier_number,
      v_recruit_json,
      v_unit_upkeep_json,
      (v_item->>'desertion_rate')::numeric
    );
  end loop;

  -- -------------------------------------------------------------------------
  -- 13. Return the new world row
  -- -------------------------------------------------------------------------
  return query
  select *
  from public.worlds w
  where w.id = v_world_id;
end;
$$;
