-- Migration: add_trash_rpcs
-- Adds soft_delete / restore / hard_delete RPCs for job_definitions,
-- building_blueprints, deposit_types, and managed_population_types, and adds
-- restore_resource / hard_delete_resource for the resources table.
--
-- All functions follow the same conventions as soft_delete_resource:
--   - SECURITY DEFINER with search_path = ''
--   - Row-level lock to prevent concurrent races
--   - Auth guard (super_admin or world_admin only)
--   - Fail-closed: unknown entity → empty result; blocked hard-delete → EXCEPTION
-- ---------------------------------------------------------------------------
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
    return;
  end if;

  select * into v_job
  from public.job_definitions
  where id = p_job_id and world_id = p_world_id
  for update;

  if v_job.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
  end if;

  -- Already trashed: return current row as no-op.
  if not v_job.is_active then
    return query select * from public.job_definitions where id = p_job_id;
    return;
  end if;

  return query
  update public.job_definitions
  set is_active = false, updated_at = now()
  where id = p_job_id and world_id = p_world_id
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
    return;
  end if;

  select * into v_job
  from public.job_definitions
  where id = p_job_id and world_id = p_world_id
  for update;

  if v_job.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
  end if;

  -- Already active: return current row as no-op.
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

-- hard_delete_job_definition fails if any deposit type, managed population
-- type, or building blueprint tier effect still references the job.
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
  from public.job_definitions
  where id = p_job_id and world_id = p_world_id
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
    select 1 from public.deposit_types
    where job_id = p_job_id and world_id = p_world_id
  ) then
    raise exception 'Cannot permanently delete: a deposit type references this job.';
  end if;

  -- FK references from managed_population_types
  if exists (
    select 1 from public.managed_population_types
    where (husbandry_job_id = p_job_id or culling_job_id = p_job_id)
      and world_id = p_world_id
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
  delete from public.job_definitions
  where id = p_job_id and world_id = p_world_id
  returning id, world_id;
end;
$$;

revoke all on function public.soft_delete_job_definition (uuid, uuid)
from
  public;

revoke all on function public.restore_job_definition (uuid, uuid)
from
  public;

revoke all on function public.hard_delete_job_definition (uuid, uuid)
from
  public;

grant
execute on function public.soft_delete_job_definition (uuid, uuid) to authenticated;

grant
execute on function public.restore_job_definition (uuid, uuid) to authenticated;

grant
execute on function public.hard_delete_job_definition (uuid, uuid) to authenticated;

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
    return;
  end if;

  select * into v_bp
  from public.building_blueprints
  where id = p_blueprint_id and world_id = p_world_id
  for update;

  if v_bp.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
  end if;

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
    return;
  end if;

  select * into v_bp
  from public.building_blueprints
  where id = p_blueprint_id and world_id = p_world_id
  for update;

  if v_bp.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
  end if;

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

-- Building blueprints have no external FK references (tiers cascade on delete),
-- so hard_delete always succeeds for a trashed blueprint.
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
  from public.building_blueprints
  where id = p_blueprint_id and world_id = p_world_id
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
  delete from public.building_blueprints
  where id = p_blueprint_id and world_id = p_world_id
  returning id, world_id;
end;
$$;

revoke all on function public.soft_delete_building_blueprint (uuid, uuid)
from
  public;

revoke all on function public.restore_building_blueprint (uuid, uuid)
from
  public;

revoke all on function public.hard_delete_building_blueprint (uuid, uuid)
from
  public;

grant
execute on function public.soft_delete_building_blueprint (uuid, uuid) to authenticated;

grant
execute on function public.restore_building_blueprint (uuid, uuid) to authenticated;

grant
execute on function public.hard_delete_building_blueprint (uuid, uuid) to authenticated;

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
    return;
  end if;

  select * into v_dt
  from public.deposit_types
  where id = p_deposit_type_id and world_id = p_world_id
  for update;

  if v_dt.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
  end if;

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
    return;
  end if;

  select * into v_dt
  from public.deposit_types
  where id = p_deposit_type_id and world_id = p_world_id
  for update;

  if v_dt.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
  end if;

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

-- hard_delete_deposit_type fails if any job_definition links to it via
-- linked_deposit_type_id.
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
  from public.deposit_types
  where id = p_deposit_type_id and world_id = p_world_id
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
    select 1 from public.job_definitions
    where linked_deposit_type_id = p_deposit_type_id
      and world_id = p_world_id
  ) then
    raise exception 'Cannot permanently delete: a job definition references this deposit type.';
  end if;

  return query
  delete from public.deposit_types
  where id = p_deposit_type_id and world_id = p_world_id
  returning id, world_id;
end;
$$;

revoke all on function public.soft_delete_deposit_type (uuid, uuid)
from
  public;

revoke all on function public.restore_deposit_type (uuid, uuid)
from
  public;

revoke all on function public.hard_delete_deposit_type (uuid, uuid)
from
  public;

grant
execute on function public.soft_delete_deposit_type (uuid, uuid) to authenticated;

grant
execute on function public.restore_deposit_type (uuid, uuid) to authenticated;

grant
execute on function public.hard_delete_deposit_type (uuid, uuid) to authenticated;

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
    return;
  end if;

  select * into v_mpt
  from public.managed_population_types
  where id = p_mpt_id and world_id = p_world_id
  for update;

  if v_mpt.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
  end if;

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
    return;
  end if;

  select * into v_mpt
  from public.managed_population_types
  where id = p_mpt_id and world_id = p_world_id
  for update;

  if v_mpt.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
  end if;

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

-- hard_delete_managed_population_type fails if any job_definition links to it
-- via linked_managed_population_type_id.
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
  from public.managed_population_types
  where id = p_mpt_id and world_id = p_world_id
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
    select 1 from public.job_definitions
    where linked_managed_population_type_id = p_mpt_id
      and world_id = p_world_id
  ) then
    raise exception 'Cannot permanently delete: a job definition references this managed population type.';
  end if;

  return query
  delete from public.managed_population_types
  where id = p_mpt_id and world_id = p_world_id
  returning id, world_id;
end;
$$;

revoke all on function public.soft_delete_managed_population_type (uuid, uuid)
from
  public;

revoke all on function public.restore_managed_population_type (uuid, uuid)
from
  public;

revoke all on function public.hard_delete_managed_population_type (uuid, uuid)
from
  public;

grant
execute on function public.soft_delete_managed_population_type (uuid, uuid) to authenticated;

grant
execute on function public.restore_managed_population_type (uuid, uuid) to authenticated;

grant
execute on function public.hard_delete_managed_population_type (uuid, uuid) to authenticated;

-- ===========================================================================
-- resources (restore + hard_delete only — soft_delete already exists)
-- ===========================================================================
-- restore_resource reverses a soft delete; sets is_deleted = false.
create or replace function public.restore_resource (p_resource_id uuid, p_world_id uuid) returns setof public.resources language plpgsql security definer
set
  search_path = '' as $$
declare
  v_resource public.resources%rowtype;
begin
  if p_resource_id is null or p_world_id is null then
    return;
  end if;

  select * into v_resource
  from public.resources
  where id = p_resource_id and world_id = p_world_id
  for update;

  if v_resource.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
  end if;

  -- Already active: return current row as no-op.
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

-- hard_delete_resource permanently removes a soft-deleted resource.
-- soft_delete_resource already strips all JSON references, so this check is a
-- safety net against races or direct DB edits.
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
  from public.resources
  where id = p_resource_id and world_id = p_world_id
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
  delete from public.resources
  where id = p_resource_id and world_id = p_world_id
  returning id, world_id;
end;
$$;

revoke all on function public.restore_resource (uuid, uuid)
from
  public;

revoke all on function public.hard_delete_resource (uuid, uuid)
from
  public;

grant
execute on function public.restore_resource (uuid, uuid) to authenticated;

grant
execute on function public.hard_delete_resource (uuid, uuid) to authenticated;
