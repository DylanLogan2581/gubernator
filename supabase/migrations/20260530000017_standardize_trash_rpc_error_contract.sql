-- Migration: standardize_trash_rpc_error_contract
-- Replaces silent RETURN on missing-row and authorization-failure in all
-- soft_delete_* / restore_* / hard_delete_* RPCs with explicit RAISE so
-- callers can branch on SQLSTATE instead of checking for an empty result.
--
-- Error contract (all trash RPCs):
--   P0002 (no_data_found)          – row does not exist or params are null
--   42501 (insufficient_privilege) – caller lacks super_admin / world_admin
--   23001 (restrict_violation)     – system resource protection (resources only)
--   P0001 (raise_exception)        – business constraint (must trash first, FK ref)
-- ---------------------------------------------------------------------------
-- ===========================================================================
-- resources  (soft_delete was originally added in migration 9)
-- ===========================================================================
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
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_resource
  from public.resources
  where id = p_resource_id and world_id = p_world_id
  for update;

  if v_resource.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if v_resource.is_system_resource then
    raise exception 'system resources cannot be soft-deleted' using errcode = '23001';
  end if;

  -- Already deleted: idempotent no-op.
  if v_resource.is_deleted then
    return;
  end if;

  -- Strip the resource from job_definitions.inputs_json.
  with updated as (
    update public.job_definitions
    set inputs_json = (
      select coalesce(jsonb_agg(e), '[]'::jsonb)
      from jsonb_array_elements(inputs_json) as e
      where (e ->> 'resource_id')::uuid <> p_resource_id
    )
    where world_id = p_world_id
      and inputs_json @> jsonb_build_array(jsonb_build_object('resource_id', p_resource_id::text))
    returning 1
  )
  select count(*) into v_job_inputs from updated;

  -- Strip the resource from job_definitions.outputs_json.
  with updated as (
    update public.job_definitions
    set outputs_json = (
      select coalesce(jsonb_agg(e), '[]'::jsonb)
      from jsonb_array_elements(outputs_json) as e
      where (e ->> 'resource_id')::uuid <> p_resource_id
    )
    where world_id = p_world_id
      and outputs_json @> jsonb_build_array(jsonb_build_object('resource_id', p_resource_id::text))
    returning 1
  )
  select count(*) into v_job_outputs from updated;

  -- Strip the resource from building_blueprint_tiers.construction_costs_json.
  with updated as (
    update public.building_blueprint_tiers bbt
    set construction_costs_json = (
      select coalesce(jsonb_agg(e), '[]'::jsonb)
      from jsonb_array_elements(bbt.construction_costs_json) as e
      where (e ->> 'resource_id')::uuid <> p_resource_id
    )
    from public.building_blueprints bb
    where bbt.building_blueprint_id = bb.id
      and bb.world_id = p_world_id
      and bbt.construction_costs_json @> jsonb_build_array(jsonb_build_object('resource_id', p_resource_id::text))
    returning 1
  )
  select count(*) into v_tier_construction from updated;

  -- Strip the resource from building_blueprint_tiers.upkeep_costs_json.
  with updated as (
    update public.building_blueprint_tiers bbt
    set upkeep_costs_json = (
      select coalesce(jsonb_agg(e), '[]'::jsonb)
      from jsonb_array_elements(bbt.upkeep_costs_json) as e
      where (e ->> 'resource_id')::uuid <> p_resource_id
    )
    from public.building_blueprints bb
    where bbt.building_blueprint_id = bb.id
      and bb.world_id = p_world_id
      and bbt.upkeep_costs_json @> jsonb_build_array(jsonb_build_object('resource_id', p_resource_id::text))
    returning 1
  )
  select count(*) into v_tier_upkeep from updated;

  -- Strip the resource from building_blueprint_tiers.effects_json.
  with updated as (
    update public.building_blueprint_tiers bbt
    set effects_json = (
      select coalesce(jsonb_agg(e), '[]'::jsonb)
      from jsonb_array_elements(bbt.effects_json) as e
      where not (
        (e ->> 'type') in ('passive_resource_production', 'resource_storage_increase')
        and (e ->> 'resource_id')::uuid = p_resource_id
      )
    )
    from public.building_blueprints bb
    where bbt.building_blueprint_id = bb.id
      and bb.world_id = p_world_id
      and exists (
        select 1 from jsonb_array_elements(bbt.effects_json) as e2
        where (e2 ->> 'type') in ('passive_resource_production', 'resource_storage_increase')
          and (e2 ->> 'resource_id')::uuid = p_resource_id
      )
    returning 1
  )
  select count(*) into v_tier_effects from updated;

  -- Strip the resource from deposit_types.worker_inputs_json.
  with updated as (
    update public.deposit_types
    set worker_inputs_json = (
      select coalesce(jsonb_agg(e), '[]'::jsonb)
      from jsonb_array_elements(worker_inputs_json) as e
      where (e ->> 'resource_id')::uuid <> p_resource_id
    )
    where world_id = p_world_id
      and worker_inputs_json @> jsonb_build_array(jsonb_build_object('resource_id', p_resource_id::text))
    returning 1
  )
  select count(*) into v_deposit_inputs from updated;

  -- Strip the resource from managed_population_types.maintenance_rules_json.
  with updated as (
    update public.managed_population_types
    set maintenance_rules_json = (
      select coalesce(jsonb_agg(e), '[]'::jsonb)
      from jsonb_array_elements(maintenance_rules_json) as e
      where (e ->> 'resource_id')::uuid <> p_resource_id
    )
    where world_id = p_world_id
      and maintenance_rules_json @> jsonb_build_array(jsonb_build_object('resource_id', p_resource_id::text))
    returning 1
  )
  select count(*) into v_pop_maintenance from updated;

  -- Strip the resource from managed_population_types.culling_outputs_json.
  with updated as (
    update public.managed_population_types
    set culling_outputs_json = (
      select coalesce(jsonb_agg(e), '[]'::jsonb)
      from jsonb_array_elements(culling_outputs_json) as e
      where (e ->> 'resource_id')::uuid <> p_resource_id
    )
    where world_id = p_world_id
      and culling_outputs_json @> jsonb_build_array(jsonb_build_object('resource_id', p_resource_id::text))
    returning 1
  )
  select count(*) into v_pop_culling from updated;

  return query
  update public.resources
  set
    is_deleted = true,
    updated_at = now(),
    last_cleanup_summary_json = jsonb_build_object(
      'cleaned_at', now(),
      'job_definitions_inputs_cleaned', v_job_inputs,
      'job_definitions_outputs_cleaned', v_job_outputs,
      'building_tier_construction_costs_cleaned', v_tier_construction,
      'building_tier_upkeep_costs_cleaned', v_tier_upkeep,
      'building_tier_effects_cleaned', v_tier_effects,
      'deposit_types_worker_inputs_cleaned', v_deposit_inputs,
      'managed_population_maintenance_cleaned', v_pop_maintenance,
      'managed_population_culling_outputs_cleaned', v_pop_culling
    )
  where id = p_resource_id and world_id = p_world_id
  returning *;
end;
$$;

create or replace function public.restore_resource (p_resource_id uuid, p_world_id uuid) returns setof public.resources language plpgsql security definer
set
  search_path = '' as $$
declare
  v_resource public.resources%rowtype;
begin
  if p_resource_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_resource
  from public.resources
  where id = p_resource_id and world_id = p_world_id
  for update;

  if v_resource.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  -- Already active: idempotent no-op.
  if not v_resource.is_deleted then
    return query select * from public.resources where id = p_resource_id;
    return;
  end if;

  return query
  update public.resources
  set is_deleted = false, updated_at = now()
  where id = p_resource_id and world_id = p_world_id
  returning *;
end;
$$;

create or replace function public.hard_delete_resource (p_resource_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_resource public.resources%rowtype;
begin
  if p_resource_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_resource
  from public.resources r
  where r.id = p_resource_id and r.world_id = p_world_id
  for update;

  if v_resource.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if not v_resource.is_deleted then
    raise exception 'Resource must be trashed before it can be permanently deleted.';
  end if;

  if v_resource.is_system_resource then
    raise exception 'System resources cannot be permanently deleted.';
  end if;

  if exists (
    select 1 from public.job_definitions jd
    where jd.world_id = p_world_id
      and (
        jd.inputs_json @> jsonb_build_array(jsonb_build_object('resource_id', p_resource_id::text))
        or jd.outputs_json @> jsonb_build_array(jsonb_build_object('resource_id', p_resource_id::text))
      )
  ) or exists (
    select 1
    from public.building_blueprint_tiers bbt
    join public.building_blueprints bb on bbt.building_blueprint_id = bb.id
    where bb.world_id = p_world_id
      and (
        bbt.construction_costs_json @> jsonb_build_array(jsonb_build_object('resource_id', p_resource_id::text))
        or bbt.upkeep_costs_json @> jsonb_build_array(jsonb_build_object('resource_id', p_resource_id::text))
        or exists (
          select 1
          from jsonb_array_elements(bbt.effects_json) as e
          where (e ->> 'type') in ('passive_resource_production', 'resource_storage_increase')
            and (e ->> 'resource_id')::uuid = p_resource_id
        )
      )
  ) or exists (
    select 1 from public.deposit_types dt
    where dt.world_id = p_world_id
      and dt.worker_inputs_json @> jsonb_build_array(jsonb_build_object('resource_id', p_resource_id::text))
  ) or exists (
    select 1 from public.managed_population_types mpt
    where mpt.world_id = p_world_id
      and (
        mpt.maintenance_rules_json @> jsonb_build_array(jsonb_build_object('resource_id', p_resource_id::text))
        or mpt.culling_outputs_json @> jsonb_build_array(jsonb_build_object('resource_id', p_resource_id::text))
      )
  ) then
    raise exception 'Cannot permanently delete: the resource is still referenced by active configurations.';
  end if;

  return query
  delete from public.resources r
  where r.id = p_resource_id and r.world_id = p_world_id
  returning r.id, r.world_id;
end;
$$;

-- ===========================================================================
-- job_definitions
-- ===========================================================================
-- Incorporates the JSON-stripping step added in migration 16.
create or replace function public.soft_delete_job_definition (p_job_id uuid, p_world_id uuid) returns setof public.job_definitions language plpgsql security definer
set
  search_path = '' as $$
declare
  v_job public.job_definitions%rowtype;
begin
  if p_job_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_job
  from public.job_definitions jd
  where jd.id = p_job_id and jd.world_id = p_world_id
  for update;

  if v_job.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  -- Already trashed: idempotent no-op.
  if not v_job.is_active then
    return query select * from public.job_definitions jd where jd.id = p_job_id;
    return;
  end if;

  -- Strip job_capacity_increase effect entries that reference this job before
  -- flipping is_active (prevents referential-integrity trigger rejection).
  update public.building_blueprint_tiers bbt
  set effects_json = (
    select coalesce(jsonb_agg(e.entry), '[]'::jsonb)
    from jsonb_array_elements(bbt.effects_json) as e(entry)
    where not (
      (e.entry ->> 'type') = 'job_capacity_increase'
      and (e.entry ->> 'job_id')::uuid = p_job_id
    )
  )
  from public.building_blueprints bb
  where bbt.building_blueprint_id = bb.id
    and bb.world_id = p_world_id
    and exists (
      select 1
      from jsonb_array_elements(bbt.effects_json) as e(entry)
      where (e.entry ->> 'type') = 'job_capacity_increase'
        and (e.entry ->> 'job_id')::uuid = p_job_id
    );

  return query
  update public.job_definitions jd
  set is_active = false, updated_at = now()
  where jd.id = p_job_id and jd.world_id = p_world_id
  returning *;
end;
$$;

create or replace function public.restore_job_definition (p_job_id uuid, p_world_id uuid) returns setof public.job_definitions language plpgsql security definer
set
  search_path = '' as $$
declare
  v_job public.job_definitions%rowtype;
begin
  if p_job_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_job
  from public.job_definitions
  where id = p_job_id and world_id = p_world_id
  for update;

  if v_job.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  -- Already active: idempotent no-op.
  if v_job.is_active then
    return query select * from public.job_definitions where id = p_job_id;
    return;
  end if;

  return query
  update public.job_definitions
  set is_active = true, updated_at = now()
  where id = p_job_id and world_id = p_world_id
  returning *;
end;
$$;

create or replace function public.hard_delete_job_definition (p_job_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_job public.job_definitions%rowtype;
begin
  if p_job_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_job
  from public.job_definitions jd
  where jd.id = p_job_id and jd.world_id = p_world_id
  for update;

  if v_job.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if v_job.is_active then
    raise exception 'Job must be trashed before it can be permanently deleted.';
  end if;

  if exists (
    select 1 from public.deposit_types dt
    where dt.job_id = p_job_id and dt.world_id = p_world_id
  ) then
    raise exception 'Cannot permanently delete: a deposit type references this job.';
  end if;

  if exists (
    select 1 from public.managed_population_types mpt
    where (mpt.husbandry_job_id = p_job_id or mpt.culling_job_id = p_job_id)
      and mpt.world_id = p_world_id
  ) then
    raise exception 'Cannot permanently delete: a managed population type references this job.';
  end if;

  if exists (
    select 1
    from public.building_blueprint_tiers bbt
    join public.building_blueprints bb on bbt.building_blueprint_id = bb.id
    where bb.world_id = p_world_id
      and exists (
        select 1
        from jsonb_array_elements(bbt.effects_json) as e
        where (e ->> 'type') = 'job_capacity_increase'
          and (e ->> 'job_id')::uuid = p_job_id
      )
  ) then
    raise exception 'Cannot permanently delete: a building blueprint tier references this job.';
  end if;

  return query
  delete from public.job_definitions jd
  where jd.id = p_job_id and jd.world_id = p_world_id
  returning jd.id, jd.world_id;
end;
$$;

-- ===========================================================================
-- building_blueprints
-- ===========================================================================
create or replace function public.soft_delete_building_blueprint (p_blueprint_id uuid, p_world_id uuid) returns setof public.building_blueprints language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bp public.building_blueprints%rowtype;
begin
  if p_blueprint_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_bp
  from public.building_blueprints
  where id = p_blueprint_id and world_id = p_world_id
  for update;

  if v_bp.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  -- Already trashed: idempotent no-op.
  if not v_bp.is_active then
    return query select * from public.building_blueprints where id = p_blueprint_id;
    return;
  end if;

  return query
  update public.building_blueprints
  set is_active = false, updated_at = now()
  where id = p_blueprint_id and world_id = p_world_id
  returning *;
end;
$$;

create or replace function public.restore_building_blueprint (p_blueprint_id uuid, p_world_id uuid) returns setof public.building_blueprints language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bp public.building_blueprints%rowtype;
begin
  if p_blueprint_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_bp
  from public.building_blueprints
  where id = p_blueprint_id and world_id = p_world_id
  for update;

  if v_bp.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  -- Already active: idempotent no-op.
  if v_bp.is_active then
    return query select * from public.building_blueprints where id = p_blueprint_id;
    return;
  end if;

  return query
  update public.building_blueprints
  set is_active = true, updated_at = now()
  where id = p_blueprint_id and world_id = p_world_id
  returning *;
end;
$$;

create or replace function public.hard_delete_building_blueprint (p_blueprint_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bp public.building_blueprints%rowtype;
begin
  if p_blueprint_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_bp
  from public.building_blueprints bb
  where bb.id = p_blueprint_id and bb.world_id = p_world_id
  for update;

  if v_bp.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if v_bp.is_active then
    raise exception 'Blueprint must be trashed before it can be permanently deleted.';
  end if;

  return query
  delete from public.building_blueprints bb
  where bb.id = p_blueprint_id and bb.world_id = p_world_id
  returning bb.id, bb.world_id;
end;
$$;

-- ===========================================================================
-- deposit_types
-- ===========================================================================
create or replace function public.soft_delete_deposit_type (p_deposit_type_id uuid, p_world_id uuid) returns setof public.deposit_types language plpgsql security definer
set
  search_path = '' as $$
declare
  v_dt public.deposit_types%rowtype;
begin
  if p_deposit_type_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_dt
  from public.deposit_types
  where id = p_deposit_type_id and world_id = p_world_id
  for update;

  if v_dt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  -- Already trashed: idempotent no-op.
  if not v_dt.is_active then
    return query select * from public.deposit_types where id = p_deposit_type_id;
    return;
  end if;

  return query
  update public.deposit_types
  set is_active = false, updated_at = now()
  where id = p_deposit_type_id and world_id = p_world_id
  returning *;
end;
$$;

create or replace function public.restore_deposit_type (p_deposit_type_id uuid, p_world_id uuid) returns setof public.deposit_types language plpgsql security definer
set
  search_path = '' as $$
declare
  v_dt public.deposit_types%rowtype;
begin
  if p_deposit_type_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_dt
  from public.deposit_types
  where id = p_deposit_type_id and world_id = p_world_id
  for update;

  if v_dt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  -- Already active: idempotent no-op.
  if v_dt.is_active then
    return query select * from public.deposit_types where id = p_deposit_type_id;
    return;
  end if;

  return query
  update public.deposit_types
  set is_active = true, updated_at = now()
  where id = p_deposit_type_id and world_id = p_world_id
  returning *;
end;
$$;

create or replace function public.hard_delete_deposit_type (p_deposit_type_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_dt public.deposit_types%rowtype;
begin
  if p_deposit_type_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_dt
  from public.deposit_types dt
  where dt.id = p_deposit_type_id and dt.world_id = p_world_id
  for update;

  if v_dt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if v_dt.is_active then
    raise exception 'Deposit type must be trashed before it can be permanently deleted.';
  end if;

  if exists (
    select 1 from public.job_definitions jd
    where jd.linked_deposit_type_id = p_deposit_type_id
      and jd.world_id = p_world_id
  ) then
    raise exception 'Cannot permanently delete: a job definition references this deposit type.';
  end if;

  return query
  delete from public.deposit_types dt
  where dt.id = p_deposit_type_id and dt.world_id = p_world_id
  returning dt.id, dt.world_id;
end;
$$;

-- ===========================================================================
-- managed_population_types
-- ===========================================================================
create or replace function public.soft_delete_managed_population_type (p_mpt_id uuid, p_world_id uuid) returns setof public.managed_population_types language plpgsql security definer
set
  search_path = '' as $$
declare
  v_mpt public.managed_population_types%rowtype;
begin
  if p_mpt_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_mpt
  from public.managed_population_types
  where id = p_mpt_id and world_id = p_world_id
  for update;

  if v_mpt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  -- Already trashed: idempotent no-op.
  if not v_mpt.is_active then
    return query select * from public.managed_population_types where id = p_mpt_id;
    return;
  end if;

  return query
  update public.managed_population_types
  set is_active = false, updated_at = now()
  where id = p_mpt_id and world_id = p_world_id
  returning *;
end;
$$;

create or replace function public.restore_managed_population_type (p_mpt_id uuid, p_world_id uuid) returns setof public.managed_population_types language plpgsql security definer
set
  search_path = '' as $$
declare
  v_mpt public.managed_population_types%rowtype;
begin
  if p_mpt_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_mpt
  from public.managed_population_types
  where id = p_mpt_id and world_id = p_world_id
  for update;

  if v_mpt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  -- Already active: idempotent no-op.
  if v_mpt.is_active then
    return query select * from public.managed_population_types where id = p_mpt_id;
    return;
  end if;

  return query
  update public.managed_population_types
  set is_active = true, updated_at = now()
  where id = p_mpt_id and world_id = p_world_id
  returning *;
end;
$$;

create or replace function public.hard_delete_managed_population_type (p_mpt_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_mpt public.managed_population_types%rowtype;
begin
  if p_mpt_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_mpt
  from public.managed_population_types mpt
  where mpt.id = p_mpt_id and mpt.world_id = p_world_id
  for update;

  if v_mpt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if v_mpt.is_active then
    raise exception 'Managed population type must be trashed before it can be permanently deleted.';
  end if;

  if exists (
    select 1 from public.job_definitions jd
    where jd.linked_managed_population_type_id = p_mpt_id
      and jd.world_id = p_world_id
  ) then
    raise exception 'Cannot permanently delete: a job definition references this managed population type.';
  end if;

  return query
  delete from public.managed_population_types mpt
  where mpt.id = p_mpt_id and mpt.world_id = p_world_id
  returning mpt.id, mpt.world_id;
end;
$$;
