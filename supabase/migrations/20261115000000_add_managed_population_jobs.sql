-- Migration: add_managed_population_jobs
-- Issue #1247: a managed population type currently has exactly one linked
-- husbandry job and one linked culling job (husbandry_job_id, culling_job_id,
-- with a single husbandry_workers_per_n_animals ratio). This prevents tiered
-- husbandry/culling jobs, e.g. a better husbandry job supporting more
-- animals per worker, or several culling jobs with different throughput.
-- Culling workers also currently do not gate cull output at all.
--
-- Introduces public.managed_population_husbandry_jobs and
-- public.managed_population_culling_jobs, child tables letting a population
-- type link 1..n jobs each, with a per-job workers_per_n_animals /
-- max_cull_per_worker rate. Existing single-job rows are migrated into the
-- new tables (culling rows default max_cull_per_worker to 10 — workers now
-- gate cull output, so this preserves prior unrestricted-by-workers
-- behaviour approximately for small worker counts while giving admins a
-- knob), then the now-redundant columns are dropped from
-- managed_population_types.
--
-- Same-world consistency is enforced declaratively via composite foreign
-- keys against (id, world_id) on both parents, and world_id is denormalized
-- onto each join table (derived automatically by a BEFORE INSERT trigger),
-- following the pattern established in
-- 20261114000000_add_deposit_type_jobs.sql for deposit_type_jobs.
--
-- maintenance_rules_json, culling_outputs_json, regular_outputs_json, and
-- growth_rate stay on managed_population_types (type-level, not per-job), so
-- enforce_resource_referential_integrity/hard_delete_resource/
-- soft_delete_resource need no changes.
-- ---------------------------------------------------------------------------
-- Composite unique target required for the composite FKs below.
-- ---------------------------------------------------------------------------
alter table public.managed_population_types
add constraint managed_population_types_id_world_id_unique unique (id, world_id);

-- ---------------------------------------------------------------------------
-- managed_population_husbandry_jobs
-- ---------------------------------------------------------------------------
create table public.managed_population_husbandry_jobs (
  id uuid primary key default gen_random_uuid(),
  managed_population_type_id uuid not null,
  job_id uuid not null,
  world_id uuid not null,
  workers_per_n_animals integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint managed_population_husbandry_jobs_unique unique (managed_population_type_id, job_id),
  constraint managed_population_husbandry_jobs_workers_check check (workers_per_n_animals > 0),
  constraint managed_population_husbandry_jobs_type_world_fk foreign key (managed_population_type_id, world_id) references public.managed_population_types (id, world_id) on delete cascade,
  constraint managed_population_husbandry_jobs_job_world_fk foreign key (job_id, world_id) references public.job_definitions (id, world_id) deferrable initially deferred
);

create index managed_population_husbandry_jobs_type_id_idx on public.managed_population_husbandry_jobs (managed_population_type_id);

create index managed_population_husbandry_jobs_job_id_idx on public.managed_population_husbandry_jobs using btree (job_id);

create index managed_population_husbandry_jobs_world_id_idx on public.managed_population_husbandry_jobs (world_id);

create trigger managed_population_husbandry_jobs_set_updated_at before
update on public.managed_population_husbandry_jobs for each row
execute function public.set_updated_at ();

create or replace function public.set_managed_population_husbandry_job_world_id () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if new.world_id is null then
    select
      mpt.world_id into new.world_id
    from
      public.managed_population_types mpt
    where
      mpt.id = new.managed_population_type_id;
  end if;

  return new;
end;
$$;

revoke all on function public.set_managed_population_husbandry_job_world_id ()
from
  public,
  anon;

create trigger managed_population_husbandry_jobs_set_world_id before insert on public.managed_population_husbandry_jobs for each row
execute function public.set_managed_population_husbandry_job_world_id ();

alter table public.managed_population_husbandry_jobs enable row level security;

create policy "managed_population_husbandry_jobs_select_world_access" on public.managed_population_husbandry_jobs for
select
  to authenticated using (public.current_user_has_world_access (world_id));

create policy "managed_population_husbandry_jobs_insert_world_admin" on public.managed_population_husbandry_jobs for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "managed_population_husbandry_jobs_update_world_admin" on public.managed_population_husbandry_jobs
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

create policy "managed_population_husbandry_jobs_delete_world_admin" on public.managed_population_husbandry_jobs for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- ---------------------------------------------------------------------------
-- managed_population_culling_jobs
-- ---------------------------------------------------------------------------
create table public.managed_population_culling_jobs (
  id uuid primary key default gen_random_uuid(),
  managed_population_type_id uuid not null,
  job_id uuid not null,
  world_id uuid not null,
  max_cull_per_worker integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint managed_population_culling_jobs_unique unique (managed_population_type_id, job_id),
  constraint managed_population_culling_jobs_max_cull_check check (max_cull_per_worker >= 0),
  constraint managed_population_culling_jobs_type_world_fk foreign key (managed_population_type_id, world_id) references public.managed_population_types (id, world_id) on delete cascade,
  constraint managed_population_culling_jobs_job_world_fk foreign key (job_id, world_id) references public.job_definitions (id, world_id) deferrable initially deferred
);

create index managed_population_culling_jobs_type_id_idx on public.managed_population_culling_jobs (managed_population_type_id);

create index managed_population_culling_jobs_job_id_idx on public.managed_population_culling_jobs using btree (job_id);

create index managed_population_culling_jobs_world_id_idx on public.managed_population_culling_jobs (world_id);

create trigger managed_population_culling_jobs_set_updated_at before
update on public.managed_population_culling_jobs for each row
execute function public.set_updated_at ();

create or replace function public.set_managed_population_culling_job_world_id () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if new.world_id is null then
    select
      mpt.world_id into new.world_id
    from
      public.managed_population_types mpt
    where
      mpt.id = new.managed_population_type_id;
  end if;

  return new;
end;
$$;

revoke all on function public.set_managed_population_culling_job_world_id ()
from
  public,
  anon;

create trigger managed_population_culling_jobs_set_world_id before insert on public.managed_population_culling_jobs for each row
execute function public.set_managed_population_culling_job_world_id ();

alter table public.managed_population_culling_jobs enable row level security;

create policy "managed_population_culling_jobs_select_world_access" on public.managed_population_culling_jobs for
select
  to authenticated using (public.current_user_has_world_access (world_id));

create policy "managed_population_culling_jobs_insert_world_admin" on public.managed_population_culling_jobs for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "managed_population_culling_jobs_update_world_admin" on public.managed_population_culling_jobs
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

create policy "managed_population_culling_jobs_delete_world_admin" on public.managed_population_culling_jobs for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- ---------------------------------------------------------------------------
-- Data migration: one husbandry_jobs row and one culling_jobs row per
-- existing managed_population_types row. Culling defaults to 10 per worker
-- (agreed default: workers now matter for cull gating).
-- ---------------------------------------------------------------------------
insert into
  public.managed_population_husbandry_jobs (
    managed_population_type_id,
    job_id,
    world_id,
    workers_per_n_animals
  )
select
  id,
  husbandry_job_id,
  world_id,
  husbandry_workers_per_n_animals
from
  public.managed_population_types;

insert into
  public.managed_population_culling_jobs (
    managed_population_type_id,
    job_id,
    world_id,
    max_cull_per_worker
  )
select
  id,
  culling_job_id,
  world_id,
  10
from
  public.managed_population_types;

-- ---------------------------------------------------------------------------
-- hard_delete_job_definition: the mpt.husbandry_job_id/culling_job_id guard
-- now checks the new join tables. Everything else is unchanged from
-- 20261114000000_add_deposit_type_jobs.sql.
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
    from public.managed_population_husbandry_jobs mphj
    where mphj.job_id = p_job_id
      and mphj.world_id = p_world_id
  ) or exists (
    select 1
    from public.managed_population_culling_jobs mpcj
    where mpcj.job_id = p_job_id
      and mpcj.world_id = p_world_id
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
-- citizen_directory_view: mpt.husbandry_job_id/culling_job_id no longer
-- exist (a population type can now have multiple linked jobs), so the
-- 'husbandry'/'culling' assignment_label now shows the population type's own
-- name instead of a single job name, matching how the 'deposit' case shows
-- dt.name. Copied from the latest prior definition (20261114000000) with
-- only those two case-branches and the now-dangling jd_husbandry/jd_culling
-- joins changed.
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
    when 'husbandry' then mpt.name
    when 'culling' then mpt.name
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
  left join public.education_levels el on el.id = c.education_level_id;

grant
select
  on public.citizen_directory_view to authenticated;

-- ---------------------------------------------------------------------------
-- Drop the now-redundant single-job columns (and everything referencing
-- them) from managed_population_types. Must happen after
-- citizen_directory_view above is redefined without mpt.husbandry_job_id/
-- culling_job_id, since the old view depends on those columns.
-- ---------------------------------------------------------------------------
drop index if exists public.managed_population_types_unique_active_husbandry_job_id;

drop index if exists public.managed_population_types_unique_active_culling_job_id;

alter table public.managed_population_types
drop constraint managed_population_types_distinct_jobs_check,
drop constraint managed_population_types_husbandry_job_fk,
drop constraint managed_population_types_culling_job_fk,
drop constraint managed_population_types_husbandry_workers_check,
drop column husbandry_job_id,
drop column culling_job_id,
drop column husbandry_workers_per_n_animals;

-- ---------------------------------------------------------------------------
-- import_world_from_template: managed_population_types template entries now
-- carry husbandry_jobs/culling_jobs arrays instead of a single
-- husbandry_job_slug/culling_job_slug/husbandry_workers_per_n_animals triple.
-- Everything else is unchanged from
-- 20261114000000_add_deposit_type_jobs.sql.
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
  v_mp_job      jsonb;

  -- Intermediate values
  v_new_uuid          uuid;
  v_blueprint_id      uuid;
  v_deposit_type_id   uuid;
  v_managed_pop_type_id uuid;
  v_res_id            text;
  v_job_id            text;
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
  -- 11. Managed population types (+icon, icon_color), then their linked
  --     husbandry_jobs / culling_jobs.
  --     maintenance_rules_json / culling_outputs_json / regular_outputs_json:
  --     [{resource_id, amount_per_n_animals}]
  -- -------------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements (p_template->'managed_population_types')
  loop
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
      growth_rate,
      maintenance_rules_json, culling_outputs_json, regular_outputs_json,
      icon, icon_color
    )
    values (
      v_world_id,
      v_item->>'name',
      v_item->>'slug',
      (v_item->>'growth_rate')::numeric,
      v_maint_json,
      v_culling_json,
      v_regular_json,
      v_item->>'icon',
      (v_item->>'icon_color')::smallint
    )
    returning id into v_managed_pop_type_id;

    for v_mp_job in
      select value from jsonb_array_elements (coalesce (v_item->'husbandry_jobs', '[]'::jsonb))
    loop
      v_job_id := v_job_map->>(v_mp_job->>'job_slug');
      if v_job_id is null then
        raise exception
          'dangling job reference "%" in managed population type "%" husbandry_jobs',
          v_mp_job->>'job_slug', v_item->>'slug'
          using errcode = '22000';
      end if;

      insert into public.managed_population_husbandry_jobs (
        managed_population_type_id, job_id, workers_per_n_animals
      )
      values (
        v_managed_pop_type_id,
        v_job_id::uuid,
        (v_mp_job->>'workers_per_n_animals')::int
      );
    end loop;

    for v_mp_job in
      select value from jsonb_array_elements (coalesce (v_item->'culling_jobs', '[]'::jsonb))
    loop
      v_job_id := v_job_map->>(v_mp_job->>'job_slug');
      if v_job_id is null then
        raise exception
          'dangling job reference "%" in managed population type "%" culling_jobs',
          v_mp_job->>'job_slug', v_item->>'slug'
          using errcode = '22000';
      end if;

      insert into public.managed_population_culling_jobs (
        managed_population_type_id, job_id, max_cull_per_worker
      )
      values (
        v_managed_pop_type_id,
        v_job_id::uuid,
        (v_mp_job->>'max_cull_per_worker')::int
      );
    end loop;
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

-- ---------------------------------------------------------------------------
-- set_per_target_assignment / set_per_target_bulk_assignment: the "linked
-- job is trashed" guard for husbandry/culling assignments referenced
-- mpt.husbandry_job_id/culling_job_id directly. With multiple jobs per
-- purpose, the guard now blocks only when NO non-trashed job of that
-- purpose remains linked to the type. Everything else is unchanged from
-- 20260806000000_archive_guard_consolidation.sql (singular) and
-- 20260930000000_add_unit_soldiers.sql (bulk).
-- ---------------------------------------------------------------------------
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

    -- Blocked only when no non-trashed job of this purpose remains linked.
    if p_assignment_type = 'husbandry' then
      select not exists (
        select 1
        from public.managed_population_instances mpi
        join public.managed_population_husbandry_jobs mphj on mphj.managed_population_type_id = mpi.managed_population_type_id
        join public.job_definitions j on j.id = mphj.job_id
        where mpi.id = p_target_id
          and not j.is_trashed
      )
      into v_job_is_trashed;
    else
      select not exists (
        select 1
        from public.managed_population_instances mpi
        join public.managed_population_culling_jobs mpcj on mpcj.managed_population_type_id = mpi.managed_population_type_id
        join public.job_definitions j on j.id = mpcj.job_id
        where mpi.id = p_target_id
          and not j.is_trashed
      )
      into v_job_is_trashed;
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

create or replace function public.set_per_target_bulk_assignment (
  p_settlement_id uuid,
  p_assignment_type text,
  p_target_id uuid,
  p_target_count integer,
  p_trade_route_end text default null
) returns table (
  before integer,
  after integer,
  added_citizen_ids uuid[],
  removed_citizen_ids uuid[]
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id          uuid;
  v_turn_number       integer;
  v_target_settlement uuid;
  v_target_status     text;
  v_max_workers       integer;
  v_job_is_trashed    boolean;
  v_current_count     integer;
  v_delta             integer;
  v_added_ids         uuid[] := array[]::uuid[];
  v_removed_ids       uuid[] := array[]::uuid[];
begin
  -- -----------------------------------------------------------------------
  -- Null guard
  -- -----------------------------------------------------------------------
  if p_settlement_id is null
     or p_assignment_type is null
     or p_target_id is null
     or p_target_count is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Non-negative count
  if p_target_count < 0 then
    raise exception 'target count must not be negative'
      using errcode = 'P0001';
  end if;

  -- Type validation
  if p_assignment_type not in ('deposit', 'husbandry', 'culling', 'trade_route') then
    raise exception 'assignment type must be deposit, husbandry, culling, or trade_route'
      using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------------
  -- Resolve settlement → world
  -- -----------------------------------------------------------------------
  select n.world_id
    into v_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Archived world guard
  if public.world_is_archived(v_world_id) then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------------
  -- Authorization
  -- -----------------------------------------------------------------------
  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (p_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- -----------------------------------------------------------------------
  -- Target validation and current-count fetch: deposit
  -- Lock deposit_instances row to prevent concurrent modifications.
  -- -----------------------------------------------------------------------
  if p_assignment_type = 'deposit' then

    select di.settlement_id, di.status, di.max_workers
      into v_target_settlement, v_target_status, v_max_workers
      from public.deposit_instances di
     where di.id = p_target_id
     for update;

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

    if v_max_workers is not null and p_target_count > v_max_workers then
      raise exception 'target count (%) exceeds max workers (%) for this deposit instance',
        p_target_count, v_max_workers
        using errcode = 'P0001';
    end if;

    select count (*)::integer
      into v_current_count
      from public.citizen_assignments ca
     where ca.assignment_type     = 'deposit'
       and ca.deposit_instance_id = p_target_id;

  -- -----------------------------------------------------------------------
  -- Target validation and current-count fetch: husbandry / culling
  -- Lock managed_population_instances row to prevent concurrent modifications.
  -- -----------------------------------------------------------------------
  elsif p_assignment_type in ('husbandry', 'culling') then

    select mpi.settlement_id, mpi.status
      into v_target_settlement, v_target_status
      from public.managed_population_instances mpi
     where mpi.id = p_target_id
     for update;

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

    -- Blocked only when no non-trashed job of this purpose remains linked.
    if p_assignment_type = 'husbandry' then
      select not exists (
        select 1
        from public.managed_population_instances mpi
        join public.managed_population_husbandry_jobs mphj on mphj.managed_population_type_id = mpi.managed_population_type_id
        join public.job_definitions j on j.id = mphj.job_id
        where mpi.id = p_target_id
          and not j.is_trashed
      )
      into v_job_is_trashed;
    else
      select not exists (
        select 1
        from public.managed_population_instances mpi
        join public.managed_population_culling_jobs mpcj on mpcj.managed_population_type_id = mpi.managed_population_type_id
        join public.job_definitions j on j.id = mpcj.job_id
        where mpi.id = p_target_id
          and not j.is_trashed
      )
      into v_job_is_trashed;
    end if;

    if v_job_is_trashed then
      raise exception 'linked % job is trashed', p_assignment_type
        using errcode = 'P0001';
    end if;

    select count (*)::integer
      into v_current_count
      from public.citizen_assignments ca
     where ca.assignment_type                 = p_assignment_type
       and ca.managed_population_instance_id  = p_target_id;

  -- -----------------------------------------------------------------------
  -- Target validation and current-count fetch: trade_route
  -- Lock trade_routes row to prevent concurrent modifications.
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
       )
     for update;

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

    select count (*)::integer
      into v_current_count
      from public.citizen_assignments ca
     where ca.assignment_type = 'trade_route'
       and ca.trade_route_id  = p_target_id
       and ca.trade_route_end = p_trade_route_end;

  end if;

  -- -----------------------------------------------------------------------
  -- Current world turn number
  -- -----------------------------------------------------------------------
  select w.current_turn_number
    into v_turn_number
    from public.worlds w
   where w.id = v_world_id;

  -- -----------------------------------------------------------------------
  -- No-op
  -- -----------------------------------------------------------------------
  if v_current_count = p_target_count then
    before              := v_current_count;
    after               := v_current_count;
    added_citizen_ids   := array[]::uuid[];
    removed_citizen_ids := array[]::uuid[];
    return next;
    return;
  end if;

  v_delta := p_target_count - v_current_count;

  -- -----------------------------------------------------------------------
  -- Raise: pick unassigned alive NPCs in deterministic-random order
  -- -----------------------------------------------------------------------
  if v_delta > 0 then

    if (
      select count (*)
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = p_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
         and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
         and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
    ) < v_delta then
      raise exception 'insufficient unassigned NPCs available'
        using errcode = 'P0001';
    end if;

    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    if p_assignment_type = 'deposit' then
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
           and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
         order by random ()
         limit v_delta
      ),
      inserted as (
        insert into public.citizen_assignments (
          citizen_id, assignment_type, deposit_instance_id, assigned_on_turn_number
        )
        select sn.id, 'deposit', p_target_id, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;

    elsif p_assignment_type = 'husbandry' then
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
           and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
         order by random ()
         limit v_delta
      ),
      inserted as (
        insert into public.citizen_assignments (
          citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number
        )
        select sn.id, 'husbandry', p_target_id, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;

    elsif p_assignment_type = 'culling' then
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
           and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
         order by random ()
         limit v_delta
      ),
      inserted as (
        insert into public.citizen_assignments (
          citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number
        )
        select sn.id, 'culling', p_target_id, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;

    elsif p_assignment_type = 'trade_route' then
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
           and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
         order by random ()
         limit v_delta
      ),
      inserted as (
        insert into public.citizen_assignments (
          citizen_id, assignment_type, trade_route_id, trade_route_end, assigned_on_turn_number
        )
        select sn.id, 'trade_route', p_target_id, p_trade_route_end, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;
    end if;

    v_removed_ids := array[]::uuid[];

  -- -----------------------------------------------------------------------
  -- Lower: remove assignees in deterministic-random order
  -- -----------------------------------------------------------------------
  else

    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    if p_assignment_type = 'deposit' then
      select array_agg (t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
           where ca.assignment_type     = 'deposit'
             and ca.deposit_instance_id = p_target_id
           order by random () asc
           limit (v_current_count - p_target_count)
        ) t;

    elsif p_assignment_type in ('husbandry', 'culling') then
      select array_agg (t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
           where ca.assignment_type                = p_assignment_type
             and ca.managed_population_instance_id = p_target_id
           order by random () asc
           limit (v_current_count - p_target_count)
        ) t;

    elsif p_assignment_type = 'trade_route' then
      select array_agg (t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
           where ca.assignment_type = 'trade_route'
             and ca.trade_route_id  = p_target_id
             and ca.trade_route_end = p_trade_route_end
           order by random () asc
           limit (v_current_count - p_target_count)
        ) t;
    end if;

    delete from public.citizen_assignments
     where citizen_id = any (v_removed_ids);

    v_added_ids := array[]::uuid[];
  end if;

  before              := v_current_count;
  after               := p_target_count;
  added_citizen_ids   := coalesce (v_added_ids,   array[]::uuid[]);
  removed_citizen_ids := coalesce (v_removed_ids, array[]::uuid[]);
  return next;
end;
$$;
