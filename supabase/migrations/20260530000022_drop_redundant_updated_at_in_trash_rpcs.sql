-- Migration: drop_redundant_updated_at_in_trash_rpcs
-- Each affected table already has a set_updated_at BEFORE UPDATE trigger that
-- sets updated_at = now().  The explicit updated_at = now() assignments in
-- soft_delete_* and restore_* RPCs are therefore dead code that would silently
-- diverge if the trigger were ever changed.  This migration redeclares all ten
-- affected functions without that assignment; the trigger remains the sole
-- authority for updated_at.
-- ---------------------------------------------------------------------------
-- ===========================================================================
-- resources
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

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select * into v_resource
  from public.resources
  where id = p_resource_id and world_id = p_world_id
  for update;

  if v_resource.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_resource.is_system_resource then
    raise exception 'system resources cannot be soft-deleted' using errcode = '23001';
  end if;

  -- Already trashed: idempotent no-op.
  if v_resource.is_trashed then
    return;
  end if;

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
    is_trashed = true,
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

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select * into v_resource
  from public.resources
  where id = p_resource_id and world_id = p_world_id
  for update;

  if v_resource.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already active: idempotent no-op.
  if not v_resource.is_trashed then
    return query select * from public.resources where id = p_resource_id;
    return;
  end if;

  return query
  update public.resources
  set is_trashed = false
  where id = p_resource_id and world_id = p_world_id
  returning *;
end;
$$;

-- ===========================================================================
-- job_definitions
-- ===========================================================================
create or replace function public.soft_delete_job_definition (p_job_id uuid, p_world_id uuid) returns setof public.job_definitions language plpgsql security definer
set
  search_path = '' as $$
declare
  v_job public.job_definitions%rowtype;
begin
  if p_job_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select * into v_job
  from public.job_definitions jd
  where jd.id = p_job_id and jd.world_id = p_world_id
  for update;

  if v_job.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already trashed: idempotent no-op.
  if v_job.is_trashed then
    return query select * from public.job_definitions jd where jd.id = p_job_id;
    return;
  end if;

  -- Strip job_capacity_increase effect entries that reference this job before
  -- flipping is_trashed (prevents referential-integrity trigger rejection).
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
  set is_trashed = true
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

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select * into v_job
  from public.job_definitions
  where id = p_job_id and world_id = p_world_id
  for update;

  if v_job.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already active: idempotent no-op.
  if not v_job.is_trashed then
    return query select * from public.job_definitions where id = p_job_id;
    return;
  end if;

  return query
  update public.job_definitions
  set is_trashed = false
  where id = p_job_id and world_id = p_world_id
  returning *;
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

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select * into v_bp
  from public.building_blueprints
  where id = p_blueprint_id and world_id = p_world_id
  for update;

  if v_bp.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already trashed: idempotent no-op.
  if v_bp.is_trashed then
    return query select * from public.building_blueprints where id = p_blueprint_id;
    return;
  end if;

  return query
  update public.building_blueprints
  set is_trashed = true
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

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select * into v_bp
  from public.building_blueprints
  where id = p_blueprint_id and world_id = p_world_id
  for update;

  if v_bp.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already active: idempotent no-op.
  if not v_bp.is_trashed then
    return query select * from public.building_blueprints where id = p_blueprint_id;
    return;
  end if;

  return query
  update public.building_blueprints
  set is_trashed = false
  where id = p_blueprint_id and world_id = p_world_id
  returning *;
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

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select * into v_dt
  from public.deposit_types
  where id = p_deposit_type_id and world_id = p_world_id
  for update;

  if v_dt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already trashed: idempotent no-op.
  if v_dt.is_trashed then
    return query select * from public.deposit_types where id = p_deposit_type_id;
    return;
  end if;

  return query
  update public.deposit_types
  set is_trashed = true
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

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select * into v_dt
  from public.deposit_types
  where id = p_deposit_type_id and world_id = p_world_id
  for update;

  if v_dt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already active: idempotent no-op.
  if not v_dt.is_trashed then
    return query select * from public.deposit_types where id = p_deposit_type_id;
    return;
  end if;

  return query
  update public.deposit_types
  set is_trashed = false
  where id = p_deposit_type_id and world_id = p_world_id
  returning *;
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

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select * into v_mpt
  from public.managed_population_types
  where id = p_mpt_id and world_id = p_world_id
  for update;

  if v_mpt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already trashed: idempotent no-op.
  if v_mpt.is_trashed then
    return query select * from public.managed_population_types where id = p_mpt_id;
    return;
  end if;

  return query
  update public.managed_population_types
  set is_trashed = true
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

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select * into v_mpt
  from public.managed_population_types
  where id = p_mpt_id and world_id = p_world_id
  for update;

  if v_mpt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already active: idempotent no-op.
  if not v_mpt.is_trashed then
    return query select * from public.managed_population_types where id = p_mpt_id;
    return;
  end if;

  return query
  update public.managed_population_types
  set is_trashed = false
  where id = p_mpt_id and world_id = p_world_id
  returning *;
end;
$$;
