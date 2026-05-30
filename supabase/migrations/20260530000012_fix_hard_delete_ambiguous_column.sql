-- Migration: fix_hard_delete_ambiguous_column
-- Fixes SQLSTATE 42702 ("column reference is ambiguous") in all hard_delete_*
-- RPCs. The functions declare `returns table (id uuid, world_id uuid)`, making
-- `id` and `world_id` OUT parameter names in the pl/pgsql scope. Unqualified
-- references to those names in embedded SQL (WHERE clauses and RETURNING) are
-- ambiguous between the table column and the OUT parameter variable.
-- Fix: alias every target table and qualify all column references through the
-- alias so Postgres resolves them unambiguously as table columns.
-- ---------------------------------------------------------------------------
create or replace function public.hard_delete_job_definition (p_job_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_job public.job_definitions%rowtype;
begin
  if p_job_id is null or p_world_id is null then
    return;
  end if;

  select * into v_job
  from public.job_definitions jd
  where jd.id = p_job_id and jd.world_id = p_world_id
  for update;

  if v_job.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
  end if;

  if v_job.is_active then
    raise exception 'Job must be trashed before it can be permanently deleted.';
  end if;

  -- FK reference from deposit_types.job_id
  if exists (
    select 1 from public.deposit_types dt
    where dt.job_id = p_job_id and dt.world_id = p_world_id
  ) then
    raise exception 'Cannot permanently delete: a deposit type references this job.';
  end if;

  -- FK references from managed_population_types
  if exists (
    select 1 from public.managed_population_types mpt
    where (mpt.husbandry_job_id = p_job_id or mpt.culling_job_id = p_job_id)
      and mpt.world_id = p_world_id
  ) then
    raise exception 'Cannot permanently delete: a managed population type references this job.';
  end if;

  -- JSON references in building_blueprint_tiers.effects_json
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

create or replace function public.hard_delete_building_blueprint (p_blueprint_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bp public.building_blueprints%rowtype;
begin
  if p_blueprint_id is null or p_world_id is null then
    return;
  end if;

  select * into v_bp
  from public.building_blueprints bb
  where bb.id = p_blueprint_id and bb.world_id = p_world_id
  for update;

  if v_bp.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
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

create or replace function public.hard_delete_deposit_type (p_deposit_type_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_dt public.deposit_types%rowtype;
begin
  if p_deposit_type_id is null or p_world_id is null then
    return;
  end if;

  select * into v_dt
  from public.deposit_types dt
  where dt.id = p_deposit_type_id and dt.world_id = p_world_id
  for update;

  if v_dt.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
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

create or replace function public.hard_delete_managed_population_type (p_mpt_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_mpt public.managed_population_types%rowtype;
begin
  if p_mpt_id is null or p_world_id is null then
    return;
  end if;

  select * into v_mpt
  from public.managed_population_types mpt
  where mpt.id = p_mpt_id and mpt.world_id = p_world_id
  for update;

  if v_mpt.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
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

create or replace function public.hard_delete_resource (p_resource_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_resource public.resources%rowtype;
begin
  if p_resource_id is null or p_world_id is null then
    return;
  end if;

  select * into v_resource
  from public.resources r
  where r.id = p_resource_id and r.world_id = p_world_id
  for update;

  if v_resource.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
  end if;

  if not v_resource.is_deleted then
    raise exception 'Resource must be trashed before it can be permanently deleted.';
  end if;

  if v_resource.is_system_resource then
    raise exception 'System resources cannot be permanently deleted.';
  end if;

  -- Check all JSON reference columns for any remaining references.
  if exists (
    select 1 from public.job_definitions jd
    where jd.world_id = p_world_id
      and (
        jd.inputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
        or jd.outputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
      )
  ) or exists (
    select 1
    from public.building_blueprint_tiers bbt
    join public.building_blueprints bb on bbt.building_blueprint_id = bb.id
    where bb.world_id = p_world_id
      and (
        bbt.construction_costs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
        or bbt.upkeep_costs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
        or exists (
          select 1
          from jsonb_array_elements (bbt.effects_json) as e
          where (e ->> 'type') in ('passive_resource_production', 'resource_storage_increase')
            and (e ->> 'resource_id')::uuid = p_resource_id
        )
      )
  ) or exists (
    select 1 from public.deposit_types dt
    where dt.world_id = p_world_id
      and dt.worker_inputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
  ) or exists (
    select 1 from public.managed_population_types mpt
    where mpt.world_id = p_world_id
      and (
        mpt.maintenance_rules_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
        or mpt.culling_outputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
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
