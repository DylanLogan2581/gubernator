-- Migration: add_citizen_assignments
-- Adds the current-assignment record for each citizen. One row per citizen
-- describing what the citizen is doing right now; historical changes live in
-- turn log entries, not this table. Powers the citizen detail screen, NPC
-- "role" flavor slot, and the Epic 5 settlement operations UI.
--
-- Placeholder columns: job_id, construction_project_id, deposit_instance_id,
-- managed_population_instance_id, and trade_route_id reference tables that do
-- not exist yet (job_definitions, construction_projects, deposit_instances,
-- managed_population_instances, trade_routes). They are added here as nullable
-- bigint columns so the assignment shape is fixed for Epic 3; the FK
-- constraints themselves are introduced in the later epics where those tables
-- ship (e.g. via an `alter table ... add constraint` step similar to the one
-- backfilled for settlements.ready_set_by_citizen_id at the end of the
-- add_citizens migration).
--
-- Read RLS mirrors citizens read visibility by piggybacking on the citizens
-- policy via an `exists` subquery. Writes are admin-only in this epic; the
-- bulk-assignment mutation surface ships in Epic 5.
-- ---------------------------------------------------------------------------
-- citizen_assignments
-- ---------------------------------------------------------------------------
create table public.citizen_assignments (
  citizen_id uuid primary key references public.citizens (id) on delete cascade,
  assignment_type text not null,
  job_id bigint,
  construction_project_id bigint,
  deposit_instance_id bigint,
  managed_population_instance_id bigint,
  trade_route_id bigint,
  assigned_on_turn_number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint citizen_assignments_assignment_type_check check (
    assignment_type in (
      'standard_job',
      'construction_project',
      'deposit',
      'husbandry',
      'culling',
      'trade_route'
    )
  ),
  -- Exactly one target column is populated for target-based assignment types;
  -- all target columns are null for standard_job (which uses job_id instead).
  constraint citizen_assignments_target_shape_check check (
    (
      assignment_type = 'standard_job'
      and job_id is not null
      and construction_project_id is null
      and deposit_instance_id is null
      and managed_population_instance_id is null
      and trade_route_id is null
    )
    or (
      assignment_type = 'construction_project'
      and construction_project_id is not null
      and deposit_instance_id is null
      and managed_population_instance_id is null
      and trade_route_id is null
    )
    or (
      assignment_type = 'deposit'
      and deposit_instance_id is not null
      and construction_project_id is null
      and managed_population_instance_id is null
      and trade_route_id is null
    )
    or (
      assignment_type in ('husbandry', 'culling')
      and managed_population_instance_id is not null
      and construction_project_id is null
      and deposit_instance_id is null
      and trade_route_id is null
    )
    or (
      assignment_type = 'trade_route'
      and trade_route_id is not null
      and construction_project_id is null
      and deposit_instance_id is null
      and managed_population_instance_id is null
    )
  )
);

comment on column public.citizen_assignments.job_id is 'Placeholder bigint for job_definitions.id. FK constraint deferred to the epic that introduces job_definitions.';

comment on column public.citizen_assignments.construction_project_id is 'Placeholder bigint for construction_projects.id. FK constraint deferred to the epic that introduces construction_projects.';

comment on column public.citizen_assignments.deposit_instance_id is 'Placeholder bigint for deposit_instances.id. FK constraint deferred to the epic that introduces deposit_instances.';

comment on column public.citizen_assignments.managed_population_instance_id is 'Placeholder bigint for managed_population_instances.id. FK constraint deferred to the epic that introduces managed_population_instances.';

comment on column public.citizen_assignments.trade_route_id is 'Placeholder bigint for trade_routes.id. FK constraint deferred to the epic that introduces trade_routes.';

create index citizen_assignments_assignment_type_idx on public.citizen_assignments (assignment_type);

create trigger citizen_assignments_set_updated_at before
update on public.citizen_assignments for each row
execute function public.set_updated_at ();

alter table public.citizen_assignments enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- Read: mirrors citizens read visibility. The `exists` subquery against
-- public.citizens respects the citizens select policy, so any visibility
-- expansion on citizens automatically applies here without duplication.
create policy "citizen_assignments_select_visible" on public.citizen_assignments for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.citizens c
      where
        c.id = citizen_assignments.citizen_id
    )
  );

-- Writes: admin-only in Epic 3. Bulk-assignment mutations for non-admin
-- callers (Nation/Settlement Managers) ship in Epic 5 via a dedicated
-- SECURITY DEFINER mutation surface.
create policy "citizen_assignments_insert_admin" on public.citizen_assignments for insert to authenticated
with
  check (
    public.is_super_admin ()
    or exists (
      select
        1
      from
        public.citizens c
      where
        c.id = citizen_assignments.citizen_id
        and public.is_world_admin (c.world_id)
    )
  );

create policy "citizen_assignments_update_admin" on public.citizen_assignments
for update
  to authenticated using (
    public.is_super_admin ()
    or exists (
      select
        1
      from
        public.citizens c
      where
        c.id = citizen_assignments.citizen_id
        and public.is_world_admin (c.world_id)
    )
  )
with
  check (
    public.is_super_admin ()
    or exists (
      select
        1
      from
        public.citizens c
      where
        c.id = citizen_assignments.citizen_id
        and public.is_world_admin (c.world_id)
    )
  );

create policy "citizen_assignments_delete_admin" on public.citizen_assignments for delete to authenticated using (
  public.is_super_admin ()
  or exists (
    select
      1
    from
      public.citizens c
    where
      c.id = citizen_assignments.citizen_id
      and public.is_world_admin (c.world_id)
  )
);
