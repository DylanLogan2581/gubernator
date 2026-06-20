-- Migration: archive_guard_consolidation
-- Issue #799: Consolidate archive guard into every manager-facing mutation RPC.
--
-- Creates assert_world_not_archived(p_world_id uuid) helper that raises P0001
-- when the world is archived. Patches every manager mutation RPC that previously
-- lacked the check. The guard is inserted immediately after the auth check so
-- authorised callers receive a clear 'world is archived' error before any
-- business-logic validation runs.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Helper: assert_world_not_archived
-- ---------------------------------------------------------------------------
create or replace function public.assert_world_not_archived (p_world_id uuid) returns void language plpgsql stable security definer
set
  search_path = '' as $$
begin
  if public.world_is_archived (p_world_id) then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.assert_world_not_archived (uuid)
from
  public;

grant
execute on function public.assert_world_not_archived (uuid) to authenticated,
service_role;

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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_resource
  from public.resources
  where id = p_resource_id
    and world_id = p_world_id
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
      select coalesce (jsonb_agg (e), '[]'::jsonb)
      from jsonb_array_elements (inputs_json) as e
      where (e ->> 'resource_id')::uuid <> p_resource_id
    )
    where world_id = p_world_id
      and inputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
    returning 1
  )
  select count (*) into v_job_inputs from updated;

  with updated as (
    update public.job_definitions
    set outputs_json = (
      select coalesce (jsonb_agg (e), '[]'::jsonb)
      from jsonb_array_elements (outputs_json) as e
      where (e ->> 'resource_id')::uuid <> p_resource_id
    )
    where world_id = p_world_id
      and outputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
    returning 1
  )
  select count (*) into v_job_outputs from updated;

  with updated as (
    update public.building_blueprint_tiers bbt
    set construction_costs_json = (
      select coalesce (jsonb_agg (e), '[]'::jsonb)
      from jsonb_array_elements (bbt.construction_costs_json) as e
      where (e ->> 'resource_id')::uuid <> p_resource_id
    )
    from public.building_blueprints bb
    where bbt.building_blueprint_id = bb.id
      and bb.world_id = p_world_id
      and bbt.construction_costs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
    returning 1
  )
  select count (*) into v_tier_construction from updated;

  with updated as (
    update public.building_blueprint_tiers bbt
    set upkeep_costs_json = (
      select coalesce (jsonb_agg (e), '[]'::jsonb)
      from jsonb_array_elements (bbt.upkeep_costs_json) as e
      where (e ->> 'resource_id')::uuid <> p_resource_id
    )
    from public.building_blueprints bb
    where bbt.building_blueprint_id = bb.id
      and bb.world_id = p_world_id
      and bbt.upkeep_costs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
    returning 1
  )
  select count (*) into v_tier_upkeep from updated;

  with updated as (
    update public.building_blueprint_tiers bbt
    set effects_json = (
      select coalesce (jsonb_agg (e), '[]'::jsonb)
      from jsonb_array_elements (bbt.effects_json) as e
      where not (
        (e ->> 'type') in ('passive_resource_production', 'resource_storage_increase')
        and (e ->> 'resource_id')::uuid = p_resource_id
      )
    )
    from public.building_blueprints bb
    where bbt.building_blueprint_id = bb.id
      and bb.world_id = p_world_id
      and exists (
        select 1
        from jsonb_array_elements (bbt.effects_json) as e2
        where (e2 ->> 'type') in ('passive_resource_production', 'resource_storage_increase')
          and (e2 ->> 'resource_id')::uuid = p_resource_id
      )
    returning 1
  )
  select count (*) into v_tier_effects from updated;

  with updated as (
    update public.deposit_types
    set worker_inputs_json = (
      select coalesce (jsonb_agg (e), '[]'::jsonb)
      from jsonb_array_elements (worker_inputs_json) as e
      where (e ->> 'resource_id')::uuid <> p_resource_id
    )
    where world_id = p_world_id
      and worker_inputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
    returning 1
  )
  select count (*) into v_deposit_inputs from updated;

  with updated as (
    update public.managed_population_types
    set maintenance_rules_json = (
      select coalesce (jsonb_agg (e), '[]'::jsonb)
      from jsonb_array_elements (maintenance_rules_json) as e
      where (e ->> 'resource_id')::uuid <> p_resource_id
    )
    where world_id = p_world_id
      and maintenance_rules_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
    returning 1
  )
  select count (*) into v_pop_maintenance from updated;

  with updated as (
    update public.managed_population_types
    set culling_outputs_json = (
      select coalesce (jsonb_agg (e), '[]'::jsonb)
      from jsonb_array_elements (culling_outputs_json) as e
      where (e ->> 'resource_id')::uuid <> p_resource_id
    )
    where world_id = p_world_id
      and culling_outputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
    returning 1
  )
  select count (*) into v_pop_culling from updated;

  return query
  update public.resources
  set
    is_trashed = true,
    last_cleanup_summary_json = jsonb_build_object (
      'cleaned_at', now (),
      'job_definitions_inputs_cleaned', v_job_inputs,
      'job_definitions_outputs_cleaned', v_job_outputs,
      'building_tier_construction_costs_cleaned', v_tier_construction,
      'building_tier_upkeep_costs_cleaned', v_tier_upkeep,
      'building_tier_effects_cleaned', v_tier_effects,
      'deposit_types_worker_inputs_cleaned', v_deposit_inputs,
      'managed_population_maintenance_cleaned', v_pop_maintenance,
      'managed_population_culling_outputs_cleaned', v_pop_culling
    )
  where id = p_resource_id
    and world_id = p_world_id
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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_resource
  from public.resources
  where id = p_resource_id
    and world_id = p_world_id
  for update;

  if v_resource.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already active: idempotent no-op.
  if not v_resource.is_trashed then
    return query
    select *
    from public.resources
    where id = p_resource_id;
    return;
  end if;

  return query
  update public.resources
  set is_trashed = false
  where id = p_resource_id
    and world_id = p_world_id
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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_resource
  from public.resources r
  where r.id = p_resource_id
    and r.world_id = p_world_id
  for update;

  if v_resource.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not v_resource.is_trashed then
    raise exception 'Resource must be trashed before it can be permanently deleted.';
  end if;

  if v_resource.is_system_resource then
    raise exception 'System resources cannot be permanently deleted.';
  end if;

  if exists (
    select 1
    from public.job_definitions jd
    where jd.world_id = p_world_id
      and (
        jd.inputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
        or jd.outputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
      )
  )
  or exists (
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
  )
  or exists (
    select 1
    from public.deposit_types dt
    where dt.world_id = p_world_id
      and dt.worker_inputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
  )
  or exists (
    select 1
    from public.managed_population_types mpt
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
  where r.id = p_resource_id
    and r.world_id = p_world_id
  returning r.id, r.world_id;
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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_job
  from public.job_definitions jd
  where jd.id = p_job_id
    and jd.world_id = p_world_id
  for update;

  if v_job.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already trashed: idempotent no-op.
  if v_job.is_trashed then
    return query
    select *
    from public.job_definitions jd
    where jd.id = p_job_id;
    return;
  end if;

  -- Strip job_capacity_increase effect entries that reference this job before
  -- flipping is_trashed (prevents referential-integrity trigger rejection).
  update public.building_blueprint_tiers bbt
  set effects_json = (
    select coalesce (jsonb_agg (e.entry), '[]'::jsonb)
    from jsonb_array_elements (bbt.effects_json) as e (entry)
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
      from jsonb_array_elements (bbt.effects_json) as e (entry)
      where (e.entry ->> 'type') = 'job_capacity_increase'
        and (e.entry ->> 'job_id')::uuid = p_job_id
    );

  return query
  update public.job_definitions jd
  set is_trashed = true
  where jd.id = p_job_id
    and jd.world_id = p_world_id
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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_job
  from public.job_definitions
  where id = p_job_id
    and world_id = p_world_id
  for update;

  if v_job.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already active: idempotent no-op.
  if not v_job.is_trashed then
    return query
    select *
    from public.job_definitions
    where id = p_job_id;
    return;
  end if;

  return query
  update public.job_definitions
  set is_trashed = false
  where id = p_job_id
    and world_id = p_world_id
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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_job
  from public.job_definitions jd
  where jd.id = p_job_id
    and jd.world_id = p_world_id
  for update;

  if v_job.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not v_job.is_trashed then
    raise exception 'Job must be trashed before it can be permanently deleted.';
  end if;

  if exists (
    select 1
    from public.deposit_types dt
    where dt.job_id = p_job_id
      and dt.world_id = p_world_id
  ) then
    raise exception 'Cannot permanently delete: a deposit type references this job.';
  end if;

  if exists (
    select 1
    from public.managed_population_types mpt
    where (mpt.husbandry_job_id = p_job_id or mpt.culling_job_id = p_job_id)
      and mpt.world_id = p_world_id
  ) then
    raise exception 'Cannot permanently delete: a managed population type references this job.';
  end if;

  return query
  delete from public.job_definitions jd
  where jd.id = p_job_id
    and jd.world_id = p_world_id
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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_bp
  from public.building_blueprints
  where id = p_blueprint_id
    and world_id = p_world_id
  for update;

  if v_bp.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already trashed: idempotent no-op.
  if v_bp.is_trashed then
    return query
    select *
    from public.building_blueprints
    where id = p_blueprint_id;
    return;
  end if;

  return query
  update public.building_blueprints
  set is_trashed = true
  where id = p_blueprint_id
    and world_id = p_world_id
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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_bp
  from public.building_blueprints
  where id = p_blueprint_id
    and world_id = p_world_id
  for update;

  if v_bp.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already active: idempotent no-op.
  if not v_bp.is_trashed then
    return query
    select *
    from public.building_blueprints
    where id = p_blueprint_id;
    return;
  end if;

  return query
  update public.building_blueprints
  set is_trashed = false
  where id = p_blueprint_id
    and world_id = p_world_id
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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_bp
  from public.building_blueprints bb
  where bb.id = p_blueprint_id
    and bb.world_id = p_world_id
  for update;

  if v_bp.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not v_bp.is_trashed then
    raise exception 'Blueprint must be trashed before it can be permanently deleted.';
  end if;

  return query
  delete from public.building_blueprints bb
  where bb.id = p_blueprint_id
    and bb.world_id = p_world_id
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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_dt
  from public.deposit_types
  where id = p_deposit_type_id
    and world_id = p_world_id
  for update;

  if v_dt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already trashed: idempotent no-op.
  if v_dt.is_trashed then
    return query
    select *
    from public.deposit_types
    where id = p_deposit_type_id;
    return;
  end if;

  return query
  update public.deposit_types
  set is_trashed = true
  where id = p_deposit_type_id
    and world_id = p_world_id
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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_dt
  from public.deposit_types
  where id = p_deposit_type_id
    and world_id = p_world_id
  for update;

  if v_dt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already active: idempotent no-op.
  if not v_dt.is_trashed then
    return query
    select *
    from public.deposit_types
    where id = p_deposit_type_id;
    return;
  end if;

  return query
  update public.deposit_types
  set is_trashed = false
  where id = p_deposit_type_id
    and world_id = p_world_id
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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_dt
  from public.deposit_types dt
  where dt.id = p_deposit_type_id
    and dt.world_id = p_world_id
  for update;

  if v_dt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not v_dt.is_trashed then
    raise exception 'Deposit type must be trashed before it can be permanently deleted.';
  end if;

  if exists (
    select 1
    from public.job_definitions jd
    where jd.linked_deposit_type_id = p_deposit_type_id
      and jd.world_id = p_world_id
  ) then
    raise exception 'Cannot permanently delete: a job definition references this deposit type.';
  end if;

  return query
  delete from public.deposit_types dt
  where dt.id = p_deposit_type_id
    and dt.world_id = p_world_id
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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_mpt
  from public.managed_population_types
  where id = p_mpt_id
    and world_id = p_world_id
  for update;

  if v_mpt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already trashed: idempotent no-op.
  if v_mpt.is_trashed then
    return query
    select *
    from public.managed_population_types
    where id = p_mpt_id;
    return;
  end if;

  return query
  update public.managed_population_types
  set is_trashed = true
  where id = p_mpt_id
    and world_id = p_world_id
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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_mpt
  from public.managed_population_types
  where id = p_mpt_id
    and world_id = p_world_id
  for update;

  if v_mpt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Already active: idempotent no-op.
  if not v_mpt.is_trashed then
    return query
    select *
    from public.managed_population_types
    where id = p_mpt_id;
    return;
  end if;

  return query
  update public.managed_population_types
  set is_trashed = false
  where id = p_mpt_id
    and world_id = p_world_id
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

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  select *
  into v_mpt
  from public.managed_population_types mpt
  where mpt.id = p_mpt_id
    and mpt.world_id = p_world_id
  for update;

  if v_mpt.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not v_mpt.is_trashed then
    raise exception 'Managed population type must be trashed before it can be permanently deleted.';
  end if;

  if exists (
    select 1
    from public.job_definitions jd
    where jd.linked_managed_population_type_id = p_mpt_id
      and jd.world_id = p_world_id
  ) then
    raise exception 'Cannot permanently delete: a job definition references this managed population type.';
  end if;

  return query
  delete from public.managed_population_types mpt
  where mpt.id = p_mpt_id
    and mpt.world_id = p_world_id
  returning mpt.id, mpt.world_id;
end;
$$;

-- ===========================================================================
-- settlement_buildings
-- ===========================================================================
create or replace function public.restore_settlement_building (p_building_id uuid, p_world_id uuid) returns setof public.settlement_buildings language plpgsql security definer
set
  search_path = '' as $$
declare
  v_building public.settlement_buildings%rowtype;
begin
  if p_building_id is null or p_world_id is null then
    return;
  end if;

  select sb.*
  into v_building
  from public.settlement_buildings sb
  join public.settlements s on s.id = sb.settlement_id
  join public.nations n on n.id = s.nation_id
  where sb.id = p_building_id
    and n.world_id = p_world_id
  for update;

  if v_building.id is null then
    return;
  end if;

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    return;
  end if;

  perform public.assert_world_not_archived (p_world_id);

  -- Must be deconstructed to restore.
  if v_building.state not in ('auto_deconstructed', 'manually_deconstructed') then
    return;
  end if;

  return query
  update public.settlement_buildings
  set state = 'active', updated_at = now ()
  where id = p_building_id
  returning *;
end;
$$;

create or replace function public.hard_delete_settlement_building (p_building_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_building public.settlement_buildings%rowtype;
begin
  if p_building_id is null or p_world_id is null then
    return;
  end if;

  select sb.*
  into v_building
  from public.settlement_buildings sb
  join public.settlements s on s.id = sb.settlement_id
  join public.nations n on n.id = s.nation_id
  where sb.id = p_building_id
    and n.world_id = p_world_id
  for update;

  if v_building.id is null then
    return;
  end if;

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    return;
  end if;

  perform public.assert_world_not_archived (p_world_id);

  -- Building must be deconstructed (in trash) before permanent deletion.
  if v_building.state not in ('auto_deconstructed', 'manually_deconstructed') then
    raise exception 'Building must be deconstructed before it can be permanently deleted.';
  end if;

  return query
  delete from public.settlement_buildings
  where id = p_building_id
  returning
    id,
    (select n.world_id
     from public.settlements s
     join public.nations n on n.id = s.nation_id
     where s.id = v_building.settlement_id)::uuid;
end;
$$;

-- ===========================================================================
-- deposit_instances
-- ===========================================================================
create or replace function public.restore_deposit_instance (p_deposit_instance_id uuid) returns table (id uuid, settlement_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_world_id      uuid;
  v_status        text;
  v_target_status text;
begin
  -- Null guard
  if p_deposit_instance_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve deposit instance → settlement → world (non-locking)
  select di.settlement_id, n.world_id, di.status
  into v_settlement_id, v_world_id, v_status
  from public.deposit_instances di
  join public.settlements s on s.id = di.settlement_id
  join public.nations n on n.id = s.nation_id
  where di.id = p_deposit_instance_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: world admin or super admin only
  if not (public.is_world_admin (v_world_id) or public.is_super_admin ()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (v_world_id);

  -- Lock row for mutation
  select di.settlement_id, n.world_id, di.status
  into v_settlement_id, v_world_id, v_status
  from public.deposit_instances di
  join public.settlements s on s.id = di.settlement_id
  join public.nations n on n.id = s.nation_id
  where di.id = p_deposit_instance_id
  for update;

  -- Reject if not removed
  if v_status != 'removed' then
    raise exception 'deposit instance is not removed' using errcode = 'P0001';
  end if;

  -- Determine restored status: active if any resource has remaining_quantity > 0
  -- or no resources exist; depleted if all resources are exhausted.
  select
    case
      when exists (
        select 1
        from public.deposit_instance_resources dir
        where dir.deposit_instance_id = p_deposit_instance_id
          and dir.remaining_quantity > 0
      ) then 'active'
      when exists (
        select 1
        from public.deposit_instance_resources dir
        where dir.deposit_instance_id = p_deposit_instance_id
      ) then 'depleted'
      else 'active'
    end
  into v_target_status;

  update public.deposit_instances di
  set status = v_target_status, updated_at = now ()
  where di.id = p_deposit_instance_id;

  id            := p_deposit_instance_id;
  settlement_id := v_settlement_id;
  return next;
end;
$$;

create or replace function public.hard_delete_deposit_instance (p_deposit_instance_id uuid) returns table (id uuid, settlement_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_world_id      uuid;
  v_status        text;
begin
  -- Null guard
  if p_deposit_instance_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve deposit instance → settlement → world (non-locking)
  select di.settlement_id, n.world_id, di.status
  into v_settlement_id, v_world_id, v_status
  from public.deposit_instances di
  join public.settlements s on s.id = di.settlement_id
  join public.nations n on n.id = s.nation_id
  where di.id = p_deposit_instance_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: world admin or super admin only
  if not (public.is_world_admin (v_world_id) or public.is_super_admin ()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (v_world_id);

  -- Lock row for mutation
  select di.settlement_id, n.world_id, di.status
  into v_settlement_id, v_world_id, v_status
  from public.deposit_instances di
  join public.settlements s on s.id = di.settlement_id
  join public.nations n on n.id = s.nation_id
  where di.id = p_deposit_instance_id
  for update;

  -- Only removed deposit instances can be permanently deleted
  if v_status != 'removed' then
    raise exception 'deposit instance must be removed before it can be permanently deleted'
      using errcode = 'P0001';
  end if;

  -- Delete; cascades to deposit_instance_resources and citizen_assignments
  return query
  delete from public.deposit_instances di
  where di.id = p_deposit_instance_id
  returning di.id as id, di.settlement_id as settlement_id;
end;
$$;

-- ===========================================================================
-- settlement_resource_stockpiles
-- ===========================================================================
create or replace function public.set_settlement_stockpile_quantity (
  p_settlement_id uuid,
  p_resource_id uuid,
  p_quantity numeric
) returns table (
  settlement_id uuid,
  resource_id uuid,
  quantity numeric
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id          uuid;
  v_resource_world_id uuid;
  v_is_trashed        boolean;
  v_row               public.settlement_resource_stockpiles%rowtype;
begin
  -- Null guard
  if p_settlement_id is null or p_resource_id is null or p_quantity is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve the settlement's world via the nation chain.
  select n.world_id
  into v_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: only super admins and world admins may set stockpile quantities.
  -- Nation Managers and Settlement Managers are explicitly rejected.
  if not (public.is_super_admin () or public.is_world_admin (v_world_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (v_world_id);

  -- Validate resource: must exist, belong to the same world, and not be trashed.
  select r.world_id, r.is_trashed
  into v_resource_world_id, v_is_trashed
  from public.resources r
  where r.id = p_resource_id;

  if v_resource_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_resource_world_id <> v_world_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_is_trashed then
    raise exception 'resource is trashed' using errcode = 'P0001';
  end if;

  -- Attempt to lock the existing row.
  select srs.*
  into v_row
  from public.settlement_resource_stockpiles srs
  where srs.settlement_id = p_settlement_id
    and srs.resource_id = p_resource_id
  for update;

  if v_row.id is null then
    insert into public.settlement_resource_stockpiles (settlement_id, resource_id, quantity)
    values (p_settlement_id, p_resource_id, p_quantity)
    on conflict on constraint settlement_resource_stockpiles_settlement_resource_unique do update
    set quantity = excluded.quantity
    returning * into v_row;
  else
    update public.settlement_resource_stockpiles srs
    set quantity = p_quantity
    where srs.settlement_id = p_settlement_id
      and srs.resource_id = p_resource_id
    returning srs.* into v_row;
  end if;

  return query
  select v_row.settlement_id, v_row.resource_id, v_row.quantity;
end;
$$;

-- ===========================================================================
-- construction_projects — cancel / resume / hard-delete / reorder
-- (These resolve world_id via settlement → nation → world chain)
-- ===========================================================================
create or replace function public.cancel_construction_project (p_project_id uuid) returns table (project_id uuid, unassigned_citizen_count integer) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_world_id      uuid;
  v_status        text;
  v_unassigned    integer;
begin
  -- Null guard
  if p_project_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Fetch project
  select cp.settlement_id, cp.status
  into v_settlement_id, v_status
  from public.construction_projects cp
  where cp.id = p_project_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: settlement manager, nation manager, world admin, or super admin
  if not public.current_user_manages_settlement (v_settlement_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Derive world_id and guard against archived worlds
  select n.world_id
  into v_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = v_settlement_id;

  perform public.assert_world_not_archived (v_world_id);

  -- Reject terminal statuses
  if v_status in ('complete', 'cancelled') then
    raise exception 'project is already %', v_status using errcode = 'P0001';
  end if;

  -- Cascade-unassign: remove citizen_assignments pointing at this project
  delete from public.citizen_assignments ca
  where ca.construction_project_id = p_project_id;

  get diagnostics v_unassigned = row_count;

  -- Cancel the project and set cancelled_at
  update public.construction_projects cp
  set status = 'cancelled', cancelled_at = now ()
  where cp.id = p_project_id;

  return query select p_project_id, v_unassigned;
end;
$$;

create or replace function public.resume_construction_project (p_project_id uuid) returns table (project_id uuid, success boolean) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_world_id      uuid;
  v_status        text;
begin
  -- Null guard
  if p_project_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Fetch project
  select cp.settlement_id, cp.status
  into v_settlement_id, v_status
  from public.construction_projects cp
  where cp.id = p_project_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: settlement manager, nation manager, world admin, or super admin
  if not public.current_user_manages_settlement (v_settlement_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Derive world_id and guard against archived worlds
  select n.world_id
  into v_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = v_settlement_id;

  perform public.assert_world_not_archived (v_world_id);

  -- Reject if not cancelled
  if v_status != 'cancelled' then
    raise exception 'project is not cancelled' using errcode = 'P0001';
  end if;

  -- Resume the project (set back to queued)
  update public.construction_projects cp
  set status = 'queued', cancelled_at = null
  where cp.id = p_project_id;

  return query select p_project_id, true;
end;
$$;

create or replace function public.hard_delete_construction_project (p_project_id uuid) returns table (project_id uuid, success boolean) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_world_id      uuid;
  v_status        text;
begin
  -- Null guard
  if p_project_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Fetch project
  select cp.settlement_id, cp.status
  into v_settlement_id, v_status
  from public.construction_projects cp
  where cp.id = p_project_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: settlement manager, nation manager, world admin, or super admin
  if not public.current_user_manages_settlement (v_settlement_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Derive world_id and guard against archived worlds
  select n.world_id
  into v_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = v_settlement_id;

  perform public.assert_world_not_archived (v_world_id);

  -- Reject if not cancelled
  if v_status != 'cancelled' then
    raise exception 'project is not cancelled' using errcode = 'P0001';
  end if;

  -- Delete the project (cascades to citizen_assignments via FK)
  delete from public.construction_projects cp
  where cp.id = p_project_id;

  return query select p_project_id, true;
end;
$$;

create or replace function public.reorder_construction_projects (p_settlement_id uuid, p_positions jsonb) returns table (updated_count integer) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id           uuid;
  v_non_terminal_count integer;
  v_position_count     integer;
  v_duplicate_count    integer;
  v_out_of_range_count integer;
  v_mismatched_count   integer;
begin
  -- Null guard
  if p_settlement_id is null or p_positions is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: settlement manager, nation manager, world admin, or super admin
  if not public.current_user_manages_settlement (p_settlement_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Verify settlement exists
  if not exists (
    select 1 from public.settlements where id = p_settlement_id
  ) then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Derive world_id and guard against archived worlds
  select n.world_id
  into v_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = p_settlement_id;

  perform public.assert_world_not_archived (v_world_id);

  -- Count non-terminal projects for this settlement
  select count (*)
  into v_non_terminal_count
  from public.construction_projects
  where settlement_id = p_settlement_id
    and status in ('queued', 'in_progress', 'paused');

  -- Positions array length must equal the non-terminal project count
  select jsonb_array_length (p_positions)
  into v_position_count;

  if v_position_count != v_non_terminal_count then
    raise exception 'positions list must include every non-terminal project (expected %, got %)',
      v_non_terminal_count, v_position_count
      using errcode = 'P0001';
  end if;

  -- Early exit for empty queues (no-op, return 0)
  if v_non_terminal_count = 0 then
    return query select 0;
    return;
  end if;

  -- Validate: no duplicate project IDs in positions input
  select count (*) - count (distinct (e ->> 'projectId')::uuid)
  into v_duplicate_count
  from jsonb_array_elements (p_positions) e;

  if v_duplicate_count > 0 then
    raise exception 'positions list contains duplicate project ids'
      using errcode = 'P0001';
  end if;

  -- Validate: positions form a contiguous 1..N permutation
  select count (*)
  into v_out_of_range_count
  from jsonb_array_elements (p_positions) e
  where (e ->> 'position')::integer not between 1 and v_non_terminal_count;

  if v_out_of_range_count > 0 then
    raise exception 'positions must be a contiguous 1..N permutation (N=%)',
      v_non_terminal_count
      using errcode = 'P0001';
  end if;

  -- Validate: no duplicate positions
  select count (*) - count (distinct (e ->> 'position')::integer)
  into v_duplicate_count
  from jsonb_array_elements (p_positions) e;

  if v_duplicate_count > 0 then
    raise exception 'positions list contains duplicate position values'
      using errcode = 'P0001';
  end if;

  -- Validate: every projectId belongs to this settlement and is non-terminal
  select count (*)
  into v_mismatched_count
  from jsonb_array_elements (p_positions) e
  where not exists (
    select 1
    from public.construction_projects cp
    where cp.id = (e ->> 'projectId')::uuid
      and cp.settlement_id = p_settlement_id
      and cp.status in ('queued', 'in_progress', 'paused')
  );

  if v_mismatched_count > 0 then
    raise exception 'one or more project ids are not valid non-terminal projects for this settlement'
      using errcode = 'P0001';
  end if;

  -- Step 1: shift all non-terminal rows to temporary positions in [N+1, 2N].
  update public.construction_projects cp
  set queue_position = subq.tmp_pos
  from (
    select
      id,
      v_non_terminal_count + row_number () over (order by queue_position) as tmp_pos
    from public.construction_projects
    where settlement_id = p_settlement_id
      and status in ('queued', 'in_progress', 'paused')
  ) subq
  where cp.id = subq.id;

  -- Step 2: apply the requested target positions from p_positions.
  update public.construction_projects cp
  set queue_position = (e ->> 'position')::integer
  from jsonb_array_elements (p_positions) e
  where cp.id = (e ->> 'projectId')::uuid;

  return query select v_non_terminal_count;
end;
$$;

-- ===========================================================================
-- citizen_assignments (bulk assignment RPCs)
-- ===========================================================================
create or replace function public.set_bulk_construction_assignment (
  p_construction_project_id uuid,
  p_target_count integer
) returns table (
  before integer,
  after integer,
  added_citizen_ids uuid[],
  removed_citizen_ids uuid[]
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id  uuid;
  v_project_status text;
  v_world_id       uuid;
  v_turn_number    integer;
  v_current_count  integer;
  v_delta          integer;
  v_added_ids      uuid[] := array[]::uuid[];
  v_removed_ids    uuid[] := array[]::uuid[];
begin
  -- Null guard
  if p_construction_project_id is null or p_target_count is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Input validation
  if p_target_count < 0 then
    raise exception 'target count must not be negative'
      using errcode = 'P0001';
  end if;

  -- Load project
  select cp.settlement_id, cp.status
  into v_settlement_id, v_project_status
  from public.construction_projects cp
  where cp.id = p_construction_project_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve settlement → world
  select n.world_id
  into v_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = v_settlement_id;

  -- Authorization
  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (v_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (v_world_id);

  -- Reject terminal projects
  if v_project_status in ('complete', 'cancelled') then
    raise exception 'cannot assign workers to a % project', v_project_status
      using errcode = 'P0001';
  end if;

  -- Get current world turn number
  select w.current_turn_number
  into v_turn_number
  from public.worlds w
  where w.id = v_world_id;

  -- Get current worker count for this project
  select count (*)::integer
  into v_current_count
  from public.citizen_assignments ca
  where ca.construction_project_id = p_construction_project_id
    and ca.assignment_type = 'construction_project';

  v_delta := p_target_count - v_current_count;

  if v_delta > 0 then
    -- Raise: add unassigned alive NPCs (reject if insufficient)
    if (
      select count (*)
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = v_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
    ) < v_delta then
      raise exception 'insufficient unassigned NPCs available'
        using errcode = 'P0001';
    end if;

    -- Deterministic-random within the transaction: seed with fractional epoch
    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    with selected_npcs as (
      select c.id
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = v_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
       order by random ()
       limit v_delta
    ),
    inserted as (
      insert into public.citizen_assignments (
        citizen_id,
        assignment_type,
        construction_project_id,
        assigned_on_turn_number
      )
      select sn.id, 'construction_project', p_construction_project_id, v_turn_number
        from selected_npcs sn
      returning citizen_id
    )
    select array_agg (citizen_id order by citizen_id)
      into v_added_ids
      from inserted;

    v_removed_ids := array[]::uuid[];

  else
    -- Lower: remove citizens in deterministic-random order
    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    select array_agg (t.citizen_id)
      into v_removed_ids
      from (
        select ca.citizen_id
          from public.citizen_assignments ca
         where ca.assignment_type         = 'construction_project'
           and ca.construction_project_id = p_construction_project_id
         order by random () asc
         limit (v_current_count - p_target_count)
      ) t;

    delete from public.citizen_assignments ca
     where ca.citizen_id = any (v_removed_ids);

    v_added_ids := array[]::uuid[];
  end if;

  before              := v_current_count;
  after               := p_target_count;
  added_citizen_ids   := coalesce (v_added_ids,   array[]::uuid[]);
  removed_citizen_ids := coalesce (v_removed_ids, array[]::uuid[]);
  return next;
end;
$$;

create or replace function public.set_bulk_construction_pool (p_settlement_id uuid, p_target_count integer) returns table (
  before integer,
  after integer,
  added_citizen_ids uuid[],
  removed_citizen_ids uuid[]
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id      uuid;
  v_turn_number   integer;
  v_current_count integer;
  v_delta         integer;
  v_added_ids     uuid[] := array[]::uuid[];
  v_removed_ids   uuid[] := array[]::uuid[];
begin
  -- Null guard
  if p_settlement_id is null or p_target_count is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Input validation
  if p_target_count < 0 then
    raise exception 'target count must not be negative'
      using errcode = 'P0001';
  end if;

  -- Resolve settlement → world
  select n.world_id
  into v_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Authorization
  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (p_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (v_world_id);

  -- Current world turn number
  select w.current_turn_number
  into v_turn_number
  from public.worlds w
  where w.id = v_world_id;

  -- Current construction pool count for this settlement
  -- (all assignment_type='construction_project' rows, regardless of project linkage)
  select count (*)::integer
    into v_current_count
    from public.citizen_assignments ca
    join public.citizens c on c.id = ca.citizen_id
   where ca.assignment_type = 'construction_project'
     and c.settlement_id    = p_settlement_id;

  -- No-op
  if v_current_count = p_target_count then
    before              := v_current_count;
    after               := v_current_count;
    added_citizen_ids   := array[]::uuid[];
    removed_citizen_ids := array[]::uuid[];
    return next;
    return;
  end if;

  v_delta := p_target_count - v_current_count;

  if v_delta > 0 then
    -- Raise: add unassigned alive NPCs (reject if insufficient)
    if (
      select count (*)
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = p_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
    ) < v_delta then
      raise exception 'insufficient unassigned NPCs available'
        using errcode = 'P0001';
    end if;

    -- Deterministic-random within the transaction: seed with fractional epoch
    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    with selected_npcs as (
      select c.id
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = p_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
       order by random ()
       limit v_delta
    ),
    inserted as (
      insert into public.citizen_assignments (
        citizen_id,
        assignment_type,
        construction_project_id,
        assigned_on_turn_number
      )
      select sn.id, 'construction_project', null, v_turn_number
        from selected_npcs sn
      returning citizen_id
    )
    select array_agg (citizen_id order by citizen_id)
      into v_added_ids
      from inserted;

    v_removed_ids := array[]::uuid[];

  else
    -- Lower: remove pool members in deterministic-random order
    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    select array_agg (t.citizen_id)
      into v_removed_ids
      from (
        select ca.citizen_id
          from public.citizen_assignments ca
          join public.citizens c on c.id = ca.citizen_id
         where ca.assignment_type = 'construction_project'
           and c.settlement_id    = p_settlement_id
         order by random () asc
         limit (v_current_count - p_target_count)
      ) t;

    delete from public.citizen_assignments ca
     where ca.citizen_id = any (v_removed_ids);

    v_added_ids := array[]::uuid[];
  end if;

  before              := v_current_count;
  after               := p_target_count;
  added_citizen_ids   := coalesce (v_added_ids,   array[]::uuid[]);
  removed_citizen_ids := coalesce (v_removed_ids, array[]::uuid[]);
  return next;
end;
$$;

-- ===========================================================================
-- events
-- ===========================================================================
create or replace function public.cancel_event_or_group (p_event_id uuid, p_group_id uuid) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id        uuid;
  v_cancelled_count integer;
begin
  -- Validation: one must be provided
  if p_event_id is null and p_group_id is null then
    raise exception 'Either event_id or group_id must be provided'
      using errcode = '23502';
  end if;

  if p_event_id is not null and p_group_id is not null then
    raise exception 'Only one of event_id or group_id may be provided'
      using errcode = '23514';
  end if;

  -- Get world_id
  if p_event_id is not null then
    select world_id
    into v_world_id
    from public.events
    where id = p_event_id;

    if v_world_id is null then
      raise exception 'Event not found' using errcode = 'P0002';
    end if;
  else
    select world_id
    into v_world_id
    from public.event_groups
    where id = p_group_id;

    if v_world_id is null then
      raise exception 'Event group not found' using errcode = 'P0002';
    end if;
  end if;

  -- Permission check
  if not (public.is_world_admin (v_world_id) or public.is_super_admin ()) then
    raise exception 'Not authorized to cancel events in this world'
      using errcode = 'P0001';
  end if;

  perform public.assert_world_not_archived (v_world_id);

  -- Cancel events
  if p_event_id is not null then
    update public.events
    set status = 'cancelled'
    where id = p_event_id
      and status not in ('cancelled', 'completed');
  else
    update public.events
    set status = 'cancelled'
    where event_group_id = p_group_id
      and status not in ('cancelled', 'completed');
  end if;

  get diagnostics v_cancelled_count = row_count;

  return jsonb_build_object ('cancelled_count', v_cancelled_count);
end;
$$;

create or replace function public.delete_event_or_group (p_event_id uuid, p_group_id uuid) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id    uuid;
  v_deleted_count integer := 0;
  v_group_id    uuid;
  v_status      text;
begin
  -- Validation: one must be provided
  if p_event_id is null and p_group_id is null then
    raise exception 'Either event_id or group_id must be provided'
      using errcode = '23502';
  end if;

  if p_event_id is not null and p_group_id is not null then
    raise exception 'Only one of event_id or group_id may be provided'
      using errcode = '23514';
  end if;

  -- Get world_id and check permissions + status
  if p_event_id is not null then
    select world_id, event_group_id, status
    into v_world_id, v_group_id, v_status
    from public.events
    where id = p_event_id;

    if v_world_id is null then
      raise exception 'Event not found' using errcode = 'P0002';
    end if;

    if v_status != 'cancelled' then
      raise exception 'Only cancelled events may be deleted'
        using errcode = '23514';
    end if;
  else
    select world_id
    into v_world_id
    from public.event_groups
    where id = p_group_id;

    if v_world_id is null then
      raise exception 'Event group not found' using errcode = 'P0002';
    end if;

    if exists (
      select 1 from public.events where event_group_id = p_group_id and status != 'cancelled'
    ) then
      raise exception 'Only cancelled events may be deleted'
        using errcode = '23514';
    end if;

    v_group_id := p_group_id;
  end if;

  -- Permission check
  if not (public.is_world_admin (v_world_id) or public.is_super_admin ()) then
    raise exception 'Not authorized to delete events in this world'
      using errcode = 'P0001';
  end if;

  perform public.assert_world_not_archived (v_world_id);

  -- Delete
  if p_event_id is not null then
    delete from public.events where id = p_event_id;
    get diagnostics v_deleted_count = row_count;

    -- Delete the parent group if it has no remaining events
    if v_group_id is not null and not exists (
      select 1 from public.events where event_group_id = v_group_id
    ) then
      delete from public.event_groups where id = v_group_id;
    end if;
  else
    delete from public.events where event_group_id = p_group_id;
    get diagnostics v_deleted_count = row_count;
    delete from public.event_groups where id = p_group_id;
  end if;

  return jsonb_build_object ('deleted_count', v_deleted_count);
end;
$$;

-- ===========================================================================
-- world_retention_config
-- ===========================================================================
create or replace function public.upsert_world_retention_config (
  p_world_id uuid,
  p_log_retention_turns integer default null,
  p_snapshot_retention_turns integer default null
) returns void language plpgsql security definer
set
  search_path = '' as $$
begin
  if not public.is_super_admin () then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (p_world_id);

  insert into public.world_retention_config (
    world_id,
    log_retention_turns,
    snapshot_retention_turns,
    updated_at
  )
  values (
    p_world_id,
    p_log_retention_turns,
    p_snapshot_retention_turns,
    now ()
  )
  on conflict (world_id) do update
    set
      log_retention_turns = excluded.log_retention_turns,
      snapshot_retention_turns = excluded.snapshot_retention_turns,
      updated_at = now ();
end;
$$;

-- ===========================================================================
-- citizen_assignments (per-target assignment)
-- ===========================================================================
create or replace function public.set_per_target_assignment (
  p_settlement_id uuid,
  p_assignment_type text,
  p_target_id uuid,
  p_citizen_ids uuid[],
  p_trade_route_end text default null
) returns table (assigned_count integer, replaced_count integer) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id          uuid;
  v_turn_number       integer;
  v_replaced_count    integer := 0;
  v_target_settlement uuid;
  v_target_status     text;
  v_max_workers       integer;
  v_job_is_trashed    boolean;
begin
  -- Null guard (p_citizen_ids may be empty but must not be null)
  if p_settlement_id is null
     or p_assignment_type is null
     or p_target_id is null
     or p_citizen_ids is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Type validation
  if p_assignment_type not in ('deposit', 'husbandry', 'culling', 'trade_route') then
    raise exception 'assignment type must be deposit, husbandry, culling, or trade_route'
      using errcode = 'P0001';
  end if;

  -- Resolve settlement → world
  select n.world_id
  into v_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Authorization
  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (p_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform public.assert_world_not_archived (v_world_id);

  -- -----------------------------------------------------------------------
  -- Target validation: deposit
  -- -----------------------------------------------------------------------
  if p_assignment_type = 'deposit' then

    select di.settlement_id, di.status, di.max_workers
    into v_target_settlement, v_target_status, v_max_workers
    from public.deposit_instances di
    where di.id = p_target_id;

    if v_target_settlement is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_target_settlement <> p_settlement_id then
      raise exception 'deposit instance does not belong to settlement'
        using errcode = 'P0001';
    end if;

    if v_target_status <> 'active' then
      raise exception 'deposit instance status is not active (%)', v_target_status
        using errcode = 'P0001';
    end if;

    if v_max_workers is not null
       and cardinality (p_citizen_ids) > v_max_workers
    then
      raise exception 'citizen count (%) exceeds max workers (%) for this deposit instance',
        cardinality (p_citizen_ids), v_max_workers
        using errcode = 'P0001';
    end if;

  -- -----------------------------------------------------------------------
  -- Target validation: husbandry / culling
  -- -----------------------------------------------------------------------
  elsif p_assignment_type in ('husbandry', 'culling') then

    select mpi.settlement_id, mpi.status
    into v_target_settlement, v_target_status
    from public.managed_population_instances mpi
    where mpi.id = p_target_id;

    if v_target_settlement is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_target_settlement <> p_settlement_id then
      raise exception 'managed population instance does not belong to settlement'
        using errcode = 'P0001';
    end if;

    if v_target_status <> 'active' then
      raise exception 'managed population instance status is not active (%)', v_target_status
        using errcode = 'P0001';
    end if;

    -- Check that the linked job (husbandry or culling) is not trashed.
    if p_assignment_type = 'husbandry' then
      select j.is_trashed
      into v_job_is_trashed
      from public.managed_population_instances mpi
      join public.managed_population_types mpt on mpt.id = mpi.managed_population_type_id
      join public.job_definitions j on j.id = mpt.husbandry_job_id
      where mpi.id = p_target_id;
    else
      select j.is_trashed
      into v_job_is_trashed
      from public.managed_population_instances mpi
      join public.managed_population_types mpt on mpt.id = mpi.managed_population_type_id
      join public.job_definitions j on j.id = mpt.culling_job_id
      where mpi.id = p_target_id;
    end if;

    if v_job_is_trashed then
      raise exception 'linked % job is trashed', p_assignment_type
        using errcode = 'P0001';
    end if;

  -- -----------------------------------------------------------------------
  -- Target validation: trade_route
  -- -----------------------------------------------------------------------
  elsif p_assignment_type = 'trade_route' then

    if p_trade_route_end is null or p_trade_route_end not in ('origin', 'destination') then
      raise exception 'trade_route_end must be origin or destination'
        using errcode = 'P0001';
    end if;

    select tr.status
    into v_target_status
    from public.trade_routes tr
    where tr.id = p_target_id
      and (
        (p_trade_route_end = 'origin'      and tr.origin_settlement_id      = p_settlement_id)
        or
        (p_trade_route_end = 'destination' and tr.destination_settlement_id = p_settlement_id)
      );

    if v_target_status is null then
      if exists (select 1 from public.trade_routes where id = p_target_id) then
        raise exception 'trade route end does not match settlement'
          using errcode = 'P0001';
      end if;
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_target_status <> 'active' then
      raise exception 'trade route status is not active (%)', v_target_status
        using errcode = 'P0001';
    end if;

  end if;

  -- -----------------------------------------------------------------------
  -- Validate all supplied citizens: must belong to settlement and be alive.
  -- -----------------------------------------------------------------------
  if exists (
    select 1
    from unnest (p_citizen_ids) as cid
    where not exists (
      select 1
      from public.citizens c
      where c.id            = cid
        and c.settlement_id = p_settlement_id
        and c.status        = 'alive'
    )
  ) then
    raise exception 'one or more citizens are not alive members of this settlement'
      using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------------
  -- Reject player_character citizens.
  -- -----------------------------------------------------------------------
  if exists (
    select 1
    from unnest (p_citizen_ids) as cid
    join public.citizens c on c.id = cid
    where c.citizen_type = 'player_character'
  ) then
    raise exception 'one or more citizens are player_characters and cannot be assigned'
      using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------------
  -- Current turn number.
  -- -----------------------------------------------------------------------
  select w.current_turn_number
  into v_turn_number
  from public.worlds w
  where w.id = v_world_id;

  -- -----------------------------------------------------------------------
  -- Count rows that will be deleted (replaced_count).
  -- -----------------------------------------------------------------------
  if p_assignment_type = 'deposit' then
    select count (*)::integer
    into v_replaced_count
    from public.citizen_assignments ca
    where (
      ca.deposit_instance_id = p_target_id
      and ca.citizen_id <> all (p_citizen_ids)
    )
    or ca.citizen_id = any (p_citizen_ids);

  elsif p_assignment_type in ('husbandry', 'culling') then
    select count (*)::integer
    into v_replaced_count
    from public.citizen_assignments ca
    where (
      ca.managed_population_instance_id = p_target_id
      and ca.assignment_type            = p_assignment_type
      and ca.citizen_id                 <> all (p_citizen_ids)
    )
    or ca.citizen_id = any (p_citizen_ids);

  elsif p_assignment_type = 'trade_route' then
    select count (*)::integer
    into v_replaced_count
    from public.citizen_assignments ca
    where (
      ca.trade_route_id  = p_target_id
      and ca.trade_route_end = p_trade_route_end
      and ca.citizen_id  <> all (p_citizen_ids)
    )
    or ca.citizen_id = any (p_citizen_ids);
  end if;

  -- -----------------------------------------------------------------------
  -- Atomic reassignment.
  -- Step 1: Remove assignments for all citizens in p_citizen_ids.
  -- -----------------------------------------------------------------------
  delete from public.citizen_assignments
  where citizen_id = any (p_citizen_ids);

  -- Step 2: Remove remaining assignments for this specific target.
  if p_assignment_type = 'deposit' then
    delete from public.citizen_assignments
    where deposit_instance_id = p_target_id;

  elsif p_assignment_type in ('husbandry', 'culling') then
    delete from public.citizen_assignments
    where managed_population_instance_id = p_target_id
      and assignment_type                = p_assignment_type;

  elsif p_assignment_type = 'trade_route' then
    delete from public.citizen_assignments
    where trade_route_id  = p_target_id
      and trade_route_end = p_trade_route_end;
  end if;

  -- Step 3: Insert new assignments (skip if list is empty).
  if cardinality (p_citizen_ids) > 0 then
    if p_assignment_type = 'deposit' then
      insert into public.citizen_assignments (
        citizen_id, assignment_type, deposit_instance_id, assigned_on_turn_number
      )
      select cid, 'deposit', p_target_id, v_turn_number
      from unnest (p_citizen_ids) as cid;

    elsif p_assignment_type = 'husbandry' then
      insert into public.citizen_assignments (
        citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number
      )
      select cid, 'husbandry', p_target_id, v_turn_number
      from unnest (p_citizen_ids) as cid;

    elsif p_assignment_type = 'culling' then
      insert into public.citizen_assignments (
        citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number
      )
      select cid, 'culling', p_target_id, v_turn_number
      from unnest (p_citizen_ids) as cid;

    elsif p_assignment_type = 'trade_route' then
      insert into public.citizen_assignments (
        citizen_id, assignment_type, trade_route_id, trade_route_end, assigned_on_turn_number
      )
      select cid, 'trade_route', p_target_id, p_trade_route_end, v_turn_number
      from unnest (p_citizen_ids) as cid;
    end if;
  end if;

  assigned_count := cardinality (p_citizen_ids);
  replaced_count := coalesce (v_replaced_count, 0);
  return next;
end;
$$;

-- ===========================================================================
-- events (update_event_group_with_events)
-- ===========================================================================
create or replace function public.update_event_group_with_events (
  p_group_id uuid,
  p_group_name text,
  p_group_description text,
  p_effects jsonb,
  p_duration_type text,
  p_duration_transitions integer,
  p_activate_on_transition_after_turn_number integer,
  p_create_citizen_memories boolean,
  p_memory_text text
) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id            uuid;
  v_current_turn_number integer;
  v_effect              jsonb;
  v_event_id            uuid;
begin
  -- Get world_id and check permissions
  select world_id
  into v_world_id
  from public.event_groups
  where id = p_group_id;

  if v_world_id is null then
    raise exception 'Event group not found' using errcode = 'P0002';
  end if;

  -- Permission check: caller must be world admin or superadmin
  if not (public.is_world_admin (v_world_id) or public.is_super_admin ()) then
    raise exception 'Not authorized to edit events in this world'
      using errcode = 'P0001';
  end if;

  perform public.assert_world_not_archived (v_world_id);

  -- Input validation
  if p_group_name is null or btrim (p_group_name) = '' then
    raise exception 'Event group name is required' using errcode = '23502';
  end if;

  if char_length (btrim (p_group_name)) > 128 then
    raise exception 'Event group name exceeds maximum length' using errcode = '23514';
  end if;

  if p_group_description is not null and char_length (p_group_description) > 1000 then
    raise exception 'Event group description exceeds maximum length' using errcode = '23514';
  end if;

  if p_duration_type = 'sustained' and (p_duration_transitions is null or p_duration_transitions <= 0) then
    raise exception 'Duration transitions required and must be > 0 for sustained events'
      using errcode = '23502';
  end if;

  if not p_duration_type = any (array['instant', 'sustained']) then
    raise exception 'Invalid duration_type' using errcode = '23514';
  end if;

  -- Validate per-effect required fields
  for v_effect in select jsonb_array_elements (p_effects)
  loop
    perform public.validate_event_effect_fields (v_effect);
  end loop;

  -- Get current turn number
  select current_turn_number
  into v_current_turn_number
  from public.worlds
  where id = v_world_id;

  if v_current_turn_number is null then
    raise exception 'World not found' using errcode = 'P0002';
  end if;

  -- Update event group metadata
  update public.event_groups
  set
    name        = btrim (p_group_name),
    description = p_group_description,
    updated_at  = now ()
  where id = p_group_id;

  -- Update all non-expired events with new duration and activation settings.
  update public.events
  set
    duration_type = p_duration_type,
    duration_transitions = case when p_duration_type = 'sustained' then p_duration_transitions else null end,
    remaining_transitions = case
      when p_duration_type != 'sustained' then null
      when status = 'pending' then p_duration_transitions
      else remaining_transitions
    end,
    activate_on_transition_after_turn_number = p_activate_on_transition_after_turn_number,
    create_citizen_memories = p_create_citizen_memories,
    memory_text = p_memory_text
  where event_group_id = p_group_id
    and status != 'expired';

  -- Delete all existing event_effects for this group's events
  delete from public.event_effects
  where event_id in (
    select id from public.events where event_group_id = p_group_id
  );

  -- Insert new effects per non-expired event
  for v_event_id in
    select id from public.events
    where event_group_id = p_group_id
      and status != 'expired'
  loop
    for v_effect in select jsonb_array_elements (p_effects)
    loop
      insert into public.event_effects (
        event_id,
        effect_type,
        is_percent,
        amount_value,
        multiplier_value,
        resource_id,
        job_id,
        managed_population_instance_id,
        managed_population_type_id,
        deposit_instance_id,
        settlement_building_id,
        extra_data_jsonb
      ) values (
        v_event_id,
        v_effect ->> 'effect_type',
        coalesce ((v_effect ->> 'is_percent')::boolean, false),
        case when v_effect ->> 'amount_value' is not null then (v_effect ->> 'amount_value')::numeric else null end,
        case when v_effect ->> 'multiplier_value' is not null then (v_effect ->> 'multiplier_value')::numeric else null end,
        case when v_effect ->> 'resource_id' is not null then (v_effect ->> 'resource_id')::uuid else null end,
        case when v_effect ->> 'job_id' is not null then (v_effect ->> 'job_id')::uuid else null end,
        case when v_effect ->> 'managed_population_instance_id' is not null then (v_effect ->> 'managed_population_instance_id')::uuid else null end,
        case when v_effect ->> 'managed_population_type_id' is not null then (v_effect ->> 'managed_population_type_id')::uuid else null end,
        case when v_effect ->> 'deposit_instance_id' is not null then (v_effect ->> 'deposit_instance_id')::uuid else null end,
        case when v_effect ->> 'settlement_building_id' is not null then (v_effect ->> 'settlement_building_id')::uuid else null end,
        case when v_effect -> 'extra_data_jsonb' is not null then v_effect -> 'extra_data_jsonb' else '{}'::jsonb end
      );
    end loop;
  end loop;

  return jsonb_build_object ('group_id', p_group_id);
end;
$$;
