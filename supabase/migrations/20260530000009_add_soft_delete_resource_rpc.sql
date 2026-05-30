-- Migration: add_soft_delete_resource_rpc
-- Introduces the soft_delete_resource SECURITY DEFINER RPC that, within a
-- single transaction and under a row-level lock, authorises the caller, rejects
-- system resources, strips the target resource from every active-config JSON
-- column across job_definitions, building_blueprint_tiers, deposit_types, and
-- managed_population_types, writes an audit summary, then flips is_deleted.
-- ---------------------------------------------------------------------------
create or replace function public.soft_delete_resource (p_resource_id uuid, p_world_id uuid) returns setof public.resources language plpgsql security definer
set
  search_path = '' as $$
declare
  v_resource          public.resources%rowtype;
  v_job_inputs        integer := 0;
  v_job_outputs       integer := 0;
  v_tier_construction integer := 0;
  v_tier_upkeep       integer := 0;
  v_tier_effects      integer := 0;
  v_deposit_inputs    integer := 0;
  v_pop_maintenance   integer := 0;
  v_pop_culling       integer := 0;
begin
  if p_resource_id is null or p_world_id is null then
    return;
  end if;

  -- Acquire a row-level lock so concurrent soft-delete calls cannot interleave
  -- their cleanup passes.
  select
    *
  into
    v_resource
  from
    public.resources
  where
    id = p_resource_id
    and world_id = p_world_id
  for update;

  if v_resource.id is null then
    return;
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (p_world_id)
  ) then
    return;
  end if;

  -- System resources must never be soft-deleted.
  if v_resource.is_system_resource then
    return;
  end if;

  -- Already deleted: treat as a no-op.
  if v_resource.is_deleted then
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- job_definitions.inputs_json
  -- Each element: { resource_id, amount_per_worker, notes? }
  -- -------------------------------------------------------------------------
  update public.job_definitions jd
  set
    inputs_json = (
      select
        coalesce (jsonb_agg (e.entry), '[]'::jsonb)
      from
        jsonb_array_elements (jd.inputs_json) as e (entry)
      where
        (e.entry ->> 'resource_id')::uuid <> p_resource_id
    )
  where
    jd.world_id = p_world_id
    and jd.inputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text));

  get diagnostics v_job_inputs = row_count;

  -- -------------------------------------------------------------------------
  -- job_definitions.outputs_json
  -- -------------------------------------------------------------------------
  update public.job_definitions jd
  set
    outputs_json = (
      select
        coalesce (jsonb_agg (e.entry), '[]'::jsonb)
      from
        jsonb_array_elements (jd.outputs_json) as e (entry)
      where
        (e.entry ->> 'resource_id')::uuid <> p_resource_id
    )
  where
    jd.world_id = p_world_id
    and jd.outputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text));

  get diagnostics v_job_outputs = row_count;

  -- -------------------------------------------------------------------------
  -- building_blueprint_tiers.construction_costs_json
  -- Each element: { resource_id, amount }
  -- -------------------------------------------------------------------------
  update public.building_blueprint_tiers bbt
  set
    construction_costs_json = (
      select
        coalesce (jsonb_agg (e.entry), '[]'::jsonb)
      from
        jsonb_array_elements (bbt.construction_costs_json) as e (entry)
      where
        (e.entry ->> 'resource_id')::uuid <> p_resource_id
    )
  from public.building_blueprints bb
  where
    bbt.building_blueprint_id = bb.id
    and bb.world_id = p_world_id
    and bbt.construction_costs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text));

  get diagnostics v_tier_construction = row_count;

  -- -------------------------------------------------------------------------
  -- building_blueprint_tiers.upkeep_costs_json
  -- -------------------------------------------------------------------------
  update public.building_blueprint_tiers bbt
  set
    upkeep_costs_json = (
      select
        coalesce (jsonb_agg (e.entry), '[]'::jsonb)
      from
        jsonb_array_elements (bbt.upkeep_costs_json) as e (entry)
      where
        (e.entry ->> 'resource_id')::uuid <> p_resource_id
    )
  from public.building_blueprints bb
  where
    bbt.building_blueprint_id = bb.id
    and bb.world_id = p_world_id
    and bbt.upkeep_costs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text));

  get diagnostics v_tier_upkeep = row_count;

  -- -------------------------------------------------------------------------
  -- building_blueprint_tiers.effects_json
  -- Only passive_resource_production and resource_storage_increase entries
  -- carry a resource_id; job_capacity_increase and population_cap_increase
  -- entries are intentionally untouched.
  -- -------------------------------------------------------------------------
  update public.building_blueprint_tiers bbt
  set
    effects_json = (
      select
        coalesce (jsonb_agg (e.entry), '[]'::jsonb)
      from
        jsonb_array_elements (bbt.effects_json) as e (entry)
      where
        not (
          (e.entry ->> 'type') in ('passive_resource_production', 'resource_storage_increase')
          and (e.entry ->> 'resource_id')::uuid = p_resource_id
        )
    )
  from public.building_blueprints bb
  where
    bbt.building_blueprint_id = bb.id
    and bb.world_id = p_world_id
    and exists (
      select
        1
      from
        jsonb_array_elements (bbt.effects_json) as e (entry)
      where
        (e.entry ->> 'type') in ('passive_resource_production', 'resource_storage_increase')
        and (e.entry ->> 'resource_id')::uuid = p_resource_id
    );

  get diagnostics v_tier_effects = row_count;

  -- -------------------------------------------------------------------------
  -- deposit_types.worker_inputs_json
  -- Each element: { resource_id, amount_per_worker }
  -- -------------------------------------------------------------------------
  update public.deposit_types dt
  set
    worker_inputs_json = (
      select
        coalesce (jsonb_agg (e.entry), '[]'::jsonb)
      from
        jsonb_array_elements (dt.worker_inputs_json) as e (entry)
      where
        (e.entry ->> 'resource_id')::uuid <> p_resource_id
    )
  where
    dt.world_id = p_world_id
    and dt.worker_inputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text));

  get diagnostics v_deposit_inputs = row_count;

  -- -------------------------------------------------------------------------
  -- managed_population_types.maintenance_rules_json
  -- Each element: { resource_id, amount_per_n_animals }
  -- -------------------------------------------------------------------------
  update public.managed_population_types mpt
  set
    maintenance_rules_json = (
      select
        coalesce (jsonb_agg (e.entry), '[]'::jsonb)
      from
        jsonb_array_elements (mpt.maintenance_rules_json) as e (entry)
      where
        (e.entry ->> 'resource_id')::uuid <> p_resource_id
    )
  where
    mpt.world_id = p_world_id
    and mpt.maintenance_rules_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text));

  get diagnostics v_pop_maintenance = row_count;

  -- -------------------------------------------------------------------------
  -- managed_population_types.culling_outputs_json
  -- -------------------------------------------------------------------------
  update public.managed_population_types mpt
  set
    culling_outputs_json = (
      select
        coalesce (jsonb_agg (e.entry), '[]'::jsonb)
      from
        jsonb_array_elements (mpt.culling_outputs_json) as e (entry)
      where
        (e.entry ->> 'resource_id')::uuid <> p_resource_id
    )
  where
    mpt.world_id = p_world_id
    and mpt.culling_outputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text));

  get diagnostics v_pop_culling = row_count;

  -- Flip the resource to deleted and stamp the cleanup audit.
  return query
  update public.resources
  set
    is_deleted = true,
    last_cleanup_summary_json = jsonb_build_object (
      'cleaned_at',
      now (),
      'job_definitions_inputs_cleaned',
      v_job_inputs,
      'job_definitions_outputs_cleaned',
      v_job_outputs,
      'building_tier_construction_costs_cleaned',
      v_tier_construction,
      'building_tier_upkeep_costs_cleaned',
      v_tier_upkeep,
      'building_tier_effects_cleaned',
      v_tier_effects,
      'deposit_types_worker_inputs_cleaned',
      v_deposit_inputs,
      'managed_population_maintenance_cleaned',
      v_pop_maintenance,
      'managed_population_culling_outputs_cleaned',
      v_pop_culling
    )
  where
    id = p_resource_id
    and world_id = p_world_id
  returning
    *;
end;
$$;

revoke all on function public.soft_delete_resource (uuid, uuid)
from
  public;

grant
execute on function public.soft_delete_resource (uuid, uuid) to authenticated;
