-- Migration: backfill_citizen_assignment_fks
-- Converts the five placeholder bigint columns on citizen_assignments to uuid
-- and adds the FK constraints now that every target table (job_definitions,
-- construction_projects, deposit_instances, managed_population_instances,
-- trade_routes) is in place. The table is unpopulated in all seeded fixtures;
-- the DO block below aborts the migration if any rows exist.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.citizen_assignments limit 1) then
    raise exception 'citizen_assignments has existing rows; cannot safely retype placeholder bigint columns';
  end if;
end;
$$;

-- Drop the shape check first because it references all five placeholder columns.
alter table public.citizen_assignments
drop constraint citizen_assignments_target_shape_check;

-- Drop bigint placeholder columns.
alter table public.citizen_assignments
drop column job_id,
drop column construction_project_id,
drop column deposit_instance_id,
drop column managed_population_instance_id,
drop column trade_route_id;

-- Re-add as uuid with live FK constraints.
alter table public.citizen_assignments
add column job_id uuid references public.job_definitions (id) on delete restrict,
add column construction_project_id uuid references public.construction_projects (id) on delete cascade,
add column deposit_instance_id uuid references public.deposit_instances (id) on delete cascade,
add column managed_population_instance_id uuid references public.managed_population_instances (id) on delete cascade,
add column trade_route_id uuid references public.trade_routes (id) on delete cascade;

-- Re-add the shape check with the same logic (uuid types now; trade_route_end
-- discriminator is added in the next migration).
alter table public.citizen_assignments
add constraint citizen_assignments_target_shape_check check (
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
);

-- Update column comments to reflect live FKs.
comment on column public.citizen_assignments.job_id is 'FK to job_definitions(id) on delete restrict. Non-null only when assignment_type = ''standard_job''.';

comment on column public.citizen_assignments.construction_project_id is 'FK to construction_projects(id) on delete cascade. Non-null only when assignment_type = ''construction_project''.';

comment on column public.citizen_assignments.deposit_instance_id is 'FK to deposit_instances(id) on delete cascade. Non-null only when assignment_type = ''deposit''.';

comment on column public.citizen_assignments.managed_population_instance_id is 'FK to managed_population_instances(id) on delete cascade. Non-null only when assignment_type in (''husbandry'', ''culling'').';

comment on column public.citizen_assignments.trade_route_id is 'FK to trade_routes(id) on delete cascade. Non-null only when assignment_type = ''trade_route''.';
