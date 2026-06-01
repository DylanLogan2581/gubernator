-- Migration: enforce_referential_integrity_source_triggers
-- The CHECK constraints introduced in 20260530000001/_003/_006/_008 validate
-- inputs_json / outputs_json / cost_json / effects_json / worker_inputs_json /
-- maintenance_rules_json / culling_outputs_json against rows in
-- public.resources and public.job_definitions when a dependent row is written.
-- PostgreSQL does NOT re-evaluate a CHECK constraint when the referenced row
-- later changes, so a hard delete, manual SQL edit, or backup restore on the
-- source table can leave dangling references that the CHECKs happily accept on
-- subsequent reads.
--
-- This migration adds BEFORE triggers on the *source* tables that reject any
-- DELETE or invalidating UPDATE (flipping is_deleted/is_active, or changing
-- world_id) while dependents still reference the row. The CHECK constraints
-- are kept in place — they still guard the dependent-write path; the new
-- triggers guard the reverse direction.
--
-- The existing soft_delete_resource RPC already strips JSON references before
-- flipping is_deleted, so it continues to work. soft_delete_job_definition
-- did NOT strip building_blueprint_tier effect references before flipping
-- is_active, which would now be rejected by the new trigger; it is updated
-- below to perform the same strip-then-flip pattern.
-- ---------------------------------------------------------------------------
-- enforce_resource_referential_integrity
-- Rejects DELETE or invalidating UPDATE on public.resources when any active
-- configuration still references the resource by id.
create or replace function public.enforce_resource_referential_integrity () returns trigger language plpgsql
set
  search_path = '' as $$
declare
  v_resource_id uuid;
  v_world_id    uuid;
  v_check       boolean;
begin
  if tg_op = 'DELETE' then
    v_resource_id := old.id;
    v_world_id    := old.world_id;
  else
    -- Only check on transitions that invalidate dependent references:
    --   * is_deleted flipped from false to true
    --   * world_id changed (would orphan refs scoped to the old world)
    -- Other column changes (rename, slug, description, etc.) are allowed.
    if old.is_deleted = new.is_deleted
       and old.world_id = new.world_id then
      return new;
    end if;
    v_resource_id := old.id;
    v_world_id    := old.world_id;
  end if;

  select exists (
    select 1 from public.job_definitions jd
    where jd.world_id = v_world_id
      and (
        jd.inputs_json  @> jsonb_build_array (jsonb_build_object ('resource_id', v_resource_id::text))
        or jd.outputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', v_resource_id::text))
      )
  ) or exists (
    select 1
    from public.building_blueprint_tiers bbt
    join public.building_blueprints bb on bbt.building_blueprint_id = bb.id
    where bb.world_id = v_world_id
      and (
        bbt.construction_costs_json @> jsonb_build_array (jsonb_build_object ('resource_id', v_resource_id::text))
        or bbt.upkeep_costs_json     @> jsonb_build_array (jsonb_build_object ('resource_id', v_resource_id::text))
        or exists (
          select 1
          from jsonb_array_elements (bbt.effects_json) as e
          where (e ->> 'type') in ('passive_resource_production', 'resource_storage_increase')
            and (e ->> 'resource_id')::uuid = v_resource_id
        )
      )
  ) or exists (
    select 1 from public.deposit_types dt
    where dt.world_id = v_world_id
      and dt.worker_inputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', v_resource_id::text))
  ) or exists (
    select 1 from public.managed_population_types mpt
    where mpt.world_id = v_world_id
      and (
        mpt.maintenance_rules_json @> jsonb_build_array (jsonb_build_object ('resource_id', v_resource_id::text))
        or mpt.culling_outputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', v_resource_id::text))
      )
  ) into v_check;

  if v_check then
    raise exception 'Cannot % resource %: still referenced by an active job, building tier, deposit type, or managed population type.',
      lower (tg_op), v_resource_id
      using errcode = '23001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger resources_enforce_referential_integrity before
update
or delete on public.resources for each row
execute function public.enforce_resource_referential_integrity ();

-- ---------------------------------------------------------------------------
-- enforce_job_definition_referential_integrity
-- Rejects DELETE or invalidating UPDATE on public.job_definitions when a
-- building_blueprint_tier still references the job via a job_capacity_increase
-- effect.
create or replace function public.enforce_job_definition_referential_integrity () returns trigger language plpgsql
set
  search_path = '' as $$
declare
  v_job_id   uuid;
  v_world_id uuid;
  v_check    boolean;
begin
  if tg_op = 'DELETE' then
    v_job_id   := old.id;
    v_world_id := old.world_id;
  else
    if old.is_active = new.is_active
       and old.world_id = new.world_id then
      return new;
    end if;
    v_job_id   := old.id;
    v_world_id := old.world_id;
  end if;

  select exists (
    select 1
    from public.building_blueprint_tiers bbt
    join public.building_blueprints bb on bbt.building_blueprint_id = bb.id
    where bb.world_id = v_world_id
      and exists (
        select 1
        from jsonb_array_elements (bbt.effects_json) as e
        where (e ->> 'type') = 'job_capacity_increase'
          and (e ->> 'job_id')::uuid = v_job_id
      )
  ) into v_check;

  if v_check then
    raise exception 'Cannot % job_definition %: still referenced by a building blueprint tier job_capacity_increase effect.',
      lower (tg_op), v_job_id
      using errcode = '23001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger job_definitions_enforce_referential_integrity before
update
or delete on public.job_definitions for each row
execute function public.enforce_job_definition_referential_integrity ();

-- ---------------------------------------------------------------------------
-- soft_delete_job_definition (updated)
-- Strips any job_capacity_increase effect entries that reference this job from
-- building_blueprint_tiers.effects_json before flipping is_active, mirroring
-- the strip-then-flip pattern used by soft_delete_resource. Without this, the
-- new enforce_job_definition_referential_integrity trigger would reject the
-- soft-delete whenever a tier still referenced the job.
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
  from public.job_definitions jd
  where jd.id = p_job_id and jd.world_id = p_world_id
  for update;

  if v_job.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
  end if;

  -- Already trashed: return current row as no-op.
  if not v_job.is_active then
    return query select * from public.job_definitions jd
      where jd.id = p_job_id;
    return;
  end if;

  -- Strip job_capacity_increase effect entries that reference this job.
  update public.building_blueprint_tiers bbt
  set
    effects_json = (
      select coalesce (jsonb_agg (e.entry), '[]'::jsonb)
      from jsonb_array_elements (bbt.effects_json) as e (entry)
      where not (
        (e.entry ->> 'type') = 'job_capacity_increase'
        and (e.entry ->> 'job_id')::uuid = p_job_id
      )
    )
  from public.building_blueprints bb
  where
    bbt.building_blueprint_id = bb.id
    and bb.world_id = p_world_id
    and exists (
      select 1
      from jsonb_array_elements (bbt.effects_json) as e (entry)
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
