-- Migration: add_deposit_type_jobs
-- Issue #1246: a deposit type currently has exactly one linked job
-- (deposit_types.job_id, output_units_per_worker, worker_inputs_json). This
-- prevents tiered extraction jobs, e.g. "Copper Miner" and "Skilled Copper
-- Miner (requires education)" at 2x output on the same deposit type.
--
-- Introduces public.deposit_type_jobs, a child table letting a deposit type
-- link 1..n jobs, each with its own output_units_per_worker and
-- worker_inputs_json. Existing single-job rows are migrated into the new
-- table, then the now-redundant columns are dropped from deposit_types.
--
-- Same-world consistency (a linked job must belong to the same world as the
-- deposit type) is enforced declaratively via composite foreign keys against
-- (id, world_id) on both parents, per the established pattern in
-- 20260528000010_replace_same_world_triggers_with_composite_fks.sql, rather
-- than a trigger. world_id is denormalized onto deposit_type_jobs (derived
-- automatically from deposit_type_id by a BEFORE INSERT trigger) so RLS and
-- the worker_inputs_json validator can reference it directly, matching the
-- shape of deposit_types itself rather than the join-through style of
-- building_blueprint_tiers (which has no denormalized world_id).
-- ---------------------------------------------------------------------------
-- Composite unique targets required for the composite FKs below.
-- ---------------------------------------------------------------------------
alter table public.job_definitions
add constraint job_definitions_id_world_id_unique unique (id, world_id);

alter table public.deposit_types
add constraint deposit_types_id_world_id_unique unique (id, world_id);

-- ---------------------------------------------------------------------------
-- deposit_type_jobs
-- ---------------------------------------------------------------------------
create table public.deposit_type_jobs (
  id uuid primary key default gen_random_uuid(),
  deposit_type_id uuid not null,
  job_id uuid not null,
  world_id uuid not null,
  output_units_per_worker integer not null,
  worker_inputs_json jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deposit_type_jobs_unique unique (deposit_type_id, job_id),
  constraint deposit_type_jobs_output_units_check check (output_units_per_worker > 0),
  constraint deposit_type_jobs_deposit_type_world_fk foreign key (deposit_type_id, world_id) references public.deposit_types (id, world_id) on delete cascade,
  constraint deposit_type_jobs_job_world_fk foreign key (job_id, world_id) references public.job_definitions (id, world_id) deferrable initially deferred
);

create index deposit_type_jobs_deposit_type_id_idx on public.deposit_type_jobs (deposit_type_id);

create index deposit_type_jobs_job_id_idx on public.deposit_type_jobs using btree (job_id);

create index deposit_type_jobs_world_id_idx on public.deposit_type_jobs (world_id);

create trigger deposit_type_jobs_set_updated_at before
update on public.deposit_type_jobs for each row
execute function public.set_updated_at ();

-- BEFORE INSERT trigger: auto-derive world_id from deposit_type_id, mirroring
-- set_nation_relationship_world_id, so callers only need to supply
-- deposit_type_id/job_id (the composite FKs below then enforce that the
-- resolved world_id also matches the job's world).
create or replace function public.set_deposit_type_job_world_id () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if new.world_id is null then
    select
      dt.world_id into new.world_id
    from
      public.deposit_types dt
    where
      dt.id = new.deposit_type_id;
  end if;

  return new;
end;
$$;

revoke all on function public.set_deposit_type_job_world_id ()
from
  public,
  anon;

create trigger deposit_type_jobs_set_world_id before insert on public.deposit_type_jobs for each row
execute function public.set_deposit_type_job_world_id ();

alter table public.deposit_type_jobs enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies – deposit_type_jobs (mirrors deposit_types; world_id is
-- denormalized onto this table so no join is required).
-- ---------------------------------------------------------------------------
create policy "deposit_type_jobs_select_world_access" on public.deposit_type_jobs for
select
  to authenticated using (public.current_user_has_world_access (world_id));

create policy "deposit_type_jobs_insert_world_admin" on public.deposit_type_jobs for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "deposit_type_jobs_update_world_admin" on public.deposit_type_jobs
for update
  to authenticated using (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  )
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "deposit_type_jobs_delete_world_admin" on public.deposit_type_jobs for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- ---------------------------------------------------------------------------
-- worker_inputs_json validation — reuse is_valid_worker_inputs_array, which
-- already accepts an arbitrary (arr, world_id) pair.
-- ---------------------------------------------------------------------------
alter table public.deposit_type_jobs
add constraint deposit_type_jobs_worker_inputs_json_check check (
  public.is_valid_worker_inputs_array (worker_inputs_json, world_id)
);

-- ---------------------------------------------------------------------------
-- Data migration: one deposit_type_jobs row per existing deposit_types row.
-- ---------------------------------------------------------------------------
insert into
  public.deposit_type_jobs (
    deposit_type_id,
    job_id,
    world_id,
    output_units_per_worker,
    worker_inputs_json
  )
select
  id,
  job_id,
  world_id,
  output_units_per_worker,
  worker_inputs_json
from
  public.deposit_types;

-- ---------------------------------------------------------------------------
-- enforce_resource_referential_integrity: worker_inputs_json now lives on
-- deposit_type_jobs, which already carries world_id directly (no join to
-- deposit_types required). Everything else is unchanged from
-- 20260801000000_skip_referential_integrity_on_hard_delete_world.sql.
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
    select 1 from public.deposit_type_jobs dtj
    where dtj.world_id = v_world_id
      and dtj.worker_inputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', v_resource_id::text))
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

-- ---------------------------------------------------------------------------
-- hard_delete_resource: the deposit_types.worker_inputs_json reference check
-- now targets deposit_type_jobs.worker_inputs_json. Everything else is
-- unchanged from 20260806000000_archive_guard_consolidation.sql.
-- ---------------------------------------------------------------------------
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
    from public.deposit_type_jobs dtj
    where dtj.world_id = p_world_id
      and dtj.worker_inputs_json @> jsonb_build_array (jsonb_build_object ('resource_id', p_resource_id::text))
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

-- ---------------------------------------------------------------------------
-- soft_delete_resource: the deposit_types.worker_inputs_json cleanup block
-- now targets deposit_type_jobs.worker_inputs_json. Everything else is
-- unchanged from 20260806000000_archive_guard_consolidation.sql.
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
    update public.deposit_type_jobs
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

-- ---------------------------------------------------------------------------
-- hard_delete_job_definition: the deposit_types.job_id guard now checks
-- deposit_type_jobs.job_id. Everything else is unchanged from
-- 20260806000000_archive_guard_consolidation.sql.
-- ---------------------------------------------------------------------------
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
    from public.deposit_type_jobs dtj
    where dtj.job_id = p_job_id
      and dtj.world_id = p_world_id
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

-- ---------------------------------------------------------------------------
-- citizen_directory_view: dt.job_id no longer exists (a deposit type can now
-- have multiple linked jobs), so the 'deposit' assignment_label now shows the
-- deposit type's own name instead of a single job name. Copied from the
-- latest prior definition (20261009000001) with only that one case-branch
-- and the now-dangling jd_deposit join changed.
-- ---------------------------------------------------------------------------
create or replace view public.citizen_directory_view
with
  (security_invoker = true) as
select
  c.id,
  c.world_id,
  c.name,
  c.sex,
  c.status,
  c.citizen_type,
  c.born_on_turn_number,
  w.current_turn_number - c.born_on_turn_number as age_turns,
  c.settlement_id,
  s.name as settlement_name,
  s.nation_id,
  n.name as nation_name,
  ca.assignment_type,
  case ca.assignment_type
    when 'standard_job' then jd_standard.name
    when 'deposit' then dt.name
    when 'husbandry' then jd_husbandry.name
    when 'culling' then jd_culling.name
    when 'trade_route' then 'Trader'
    when 'construction_project' then 'Construction'
    else null
  end as assignment_label,
  (
    select
      string_agg(
        ot.name,
        ', '
        order by
          ot.name
      )
    from
      public.nation_offices o
      join public.office_types ot on ot.id = o.office_type_id
    where
      o.citizen_id = c.id
      and o.ended_turn_number is null
  ) as office_types,
  el.name as education_level_name
from
  public.citizens c
  join public.worlds w on w.id = c.world_id
  left join public.settlements s on s.id = c.settlement_id
  left join public.nations n on n.id = s.nation_id
  left join public.citizen_assignments ca on ca.citizen_id = c.id
  left join public.job_definitions jd_standard on jd_standard.id = ca.job_id
  and ca.assignment_type = 'standard_job'
  left join public.deposit_instances di on di.id = ca.deposit_instance_id
  left join public.deposit_types dt on dt.id = di.deposit_type_id
  left join public.managed_population_instances mpi on mpi.id = ca.managed_population_instance_id
  left join public.managed_population_types mpt on mpt.id = mpi.managed_population_type_id
  left join public.job_definitions jd_husbandry on jd_husbandry.id = mpt.husbandry_job_id
  left join public.job_definitions jd_culling on jd_culling.id = mpt.culling_job_id
  left join public.education_levels el on el.id = c.education_level_id;

grant
select
  on public.citizen_directory_view to authenticated;

-- ---------------------------------------------------------------------------
-- Drop the now-redundant single-job columns (and everything referencing
-- them) from deposit_types. Must happen after citizen_directory_view above is
-- redefined without dt.job_id, since the old view depends on that column.
-- ---------------------------------------------------------------------------
drop index if exists public.deposit_types_unique_active_job_id;

drop index if exists public.deposit_types_job_id_idx;

alter table public.deposit_types
drop constraint deposit_types_job_id_fk,
drop constraint deposit_types_output_units_check,
drop constraint deposit_types_worker_inputs_json_check,
drop column job_id,
drop column output_units_per_worker,
drop column worker_inputs_json;

-- ---------------------------------------------------------------------------
-- import_world_from_template: deposit_types template entries now carry a
-- `jobs` array instead of a single job_slug/output_units_per_worker/
-- worker_inputs triple. Everything else is unchanged from
-- 20261113000000_add_icon_color_to_config_entities.sql.
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
  v_dt_job      jsonb;

  -- Intermediate values
  v_new_uuid          uuid;
  v_blueprint_id      uuid;
  v_deposit_type_id   uuid;
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
    insert into public.resource_categories (world_id, name, color, sort_order)
    values (
      v_world_id,
      v_item->>'name',
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
  -- 7. Resources (+icon, icon_color, category_id) → build slug→uuid map
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
      is_system_resource, icon, icon_color, category_id
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
      (v_item->>'icon_color')::smallint,
      v_category_id::uuid
    )
    on conflict (world_id, slug) do update set
      name               = excluded.name,
      base_stockpile_cap = excluded.base_stockpile_cap,
      change_mode        = excluded.change_mode,
      change_amount      = excluded.change_amount,
      is_system_resource = excluded.is_system_resource,
      icon               = excluded.icon,
      icon_color         = excluded.icon_color,
      category_id        = excluded.category_id,
      updated_at         = now ()
    returning id into v_new_uuid;

    v_resource_map := v_resource_map
      || jsonb_build_object (v_item->>'slug', v_new_uuid::text);
  end loop;

  -- -------------------------------------------------------------------------
  -- 8. Jobs (+icon, icon_color, required_education_level_id) → build
  --    slug→uuid map
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
      icon, icon_color, required_education_level_id
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
      (v_item->>'icon_color')::smallint,
      v_education_level_id::uuid
    )
    returning id into v_new_uuid;

    v_job_map := v_job_map
      || jsonb_build_object (v_item->>'slug', v_new_uuid::text);
  end loop;

  -- -------------------------------------------------------------------------
  -- 9. Blueprints (+icon, icon_color) + tiers
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
      max_instances_per_settlement, grace_period_turns, icon, icon_color
    )
    values (
      v_world_id,
      v_item->>'name',
      v_item->>'slug',
      v_item->>'description',
      (v_item->>'max_instances_per_settlement')::int,
      (v_item->>'grace_period_turns')::int,
      v_item->>'icon',
      (v_item->>'icon_color')::smallint
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
  -- 10. Deposit types (+icon, icon_color), then their linked jobs
  --     (deposit_type_jobs). worker_inputs_json: [{resource_id, amount_per_worker}]
  -- -------------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements (p_template->'deposit_types')
  loop
    insert into public.deposit_types (
      world_id, name, slug, icon, icon_color
    )
    values (
      v_world_id,
      v_item->>'name',
      v_item->>'slug',
      v_item->>'icon',
      (v_item->>'icon_color')::smallint
    )
    returning id into v_deposit_type_id;

    for v_dt_job in
      select value from jsonb_array_elements (v_item->'jobs')
    loop
      v_job_id := v_job_map->>(v_dt_job->>'job_slug');
      if v_job_id is null then
        raise exception
          'dangling job reference "%" in deposit type "%"',
          v_dt_job->>'job_slug', v_item->>'slug'
          using errcode = '22000';
      end if;

      v_wi_json := '[]'::jsonb;
      for v_io in
        select value from jsonb_array_elements (v_dt_job->'worker_inputs')
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

      insert into public.deposit_type_jobs (
        deposit_type_id, job_id, output_units_per_worker, worker_inputs_json
      )
      values (
        v_deposit_type_id,
        v_job_id::uuid,
        (v_dt_job->>'output_units_per_worker')::numeric,
        v_wi_json
      );
    end loop;
  end loop;

  -- -------------------------------------------------------------------------
  -- 11. Managed population types (+icon, icon_color)
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
      maintenance_rules_json, culling_outputs_json, regular_outputs_json,
      icon, icon_color
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
      v_item->>'icon',
      (v_item->>'icon_color')::smallint
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
