-- Migration: skip_referential_integrity_on_hard_delete_world
-- hard_delete_world() removes a world by deleting the worlds row and letting the
-- ON DELETE CASCADE foreign keys remove every child row. PostgreSQL does not
-- guarantee the order in which sibling tables are cascade-deleted, so the
-- BEFORE DELETE guards added in 20260530000016 (which reject deleting a resource
-- or job_definition while another row in the SAME world still references it) can
-- fire mid-cascade -- e.g. a resource is reached before the job_definition that
-- references it. The whole world is being removed in one transaction, so no
-- dangling reference can survive; the guards are pointless in that path and only
-- block it.
--
-- Fix: hard_delete_world sets a transaction-local GUC before deleting, and the
-- two enforce_* trigger functions early-return when it is set. The guards still
-- protect every other DELETE/invalidating-UPDATE path unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_resource_referential_integrity () returns trigger language plpgsql
set
  search_path = '' as $$
declare
  v_resource_id uuid;
  v_world_id    uuid;
  v_check       boolean;
begin
  -- Skip during a full-world hard delete: the entire world is removed in one
  -- transaction, so no dangling reference can persist.
  if current_setting('app.hard_delete_world', true) = 'true' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_resource_id := old.id;
    v_world_id    := old.world_id;
  else
    -- Only check on transitions that invalidate dependent references:
    --   * is_trashed flipped from false to true
    --   * world_id changed (would orphan refs scoped to the old world)
    -- Other column changes (rename, slug, description, etc.) are allowed.
    if old.is_trashed = new.is_trashed
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

create or replace function public.enforce_job_definition_referential_integrity () returns trigger language plpgsql
set
  search_path = '' as $$
declare
  v_job_id   uuid;
  v_world_id uuid;
  v_check    boolean;
begin
  -- Skip during a full-world hard delete (see resource guard above).
  if current_setting('app.hard_delete_world', true) = 'true' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_job_id   := old.id;
    v_world_id := old.world_id;
  else
    if old.is_trashed = new.is_trashed
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

-- ---------------------------------------------------------------------------
-- hard_delete_world: flag the cascade so the source-integrity guards skip it.
create or replace function public.hard_delete_world (p_world_id uuid) returns table (id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world public.worlds%rowtype;
begin
  if p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select *
  into v_world
  from public.worlds w
  where w.id = p_world_id
  for update;

  if v_world.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.is_super_admin () then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if not v_world.is_trashed then
    raise exception 'World must be trashed before it can be permanently deleted.';
  end if;

  -- Suppress the source-table referential-integrity guards for this cascade;
  -- the entire world is removed atomically, so no dangling reference can remain.
  perform set_config('app.hard_delete_world', 'true', true);

  return query
  delete from public.worlds w
  where w.id = p_world_id
  returning w.id;
end;
$$;

revoke all on function public.hard_delete_world (uuid)
from
  public;

grant
execute on function public.hard_delete_world (uuid) to authenticated;
