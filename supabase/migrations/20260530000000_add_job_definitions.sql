-- Migration: add_job_definitions
-- Creates the public.job_definitions table: the Epic 4 job registry.
-- Stub tables for deposit_types and managed_population_types are introduced
-- here so the deferrable foreign keys on job_definitions can reference them
-- before their full schemas arrive in Epic 5/6.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- deposit_types (stub – full schema added by a later Epic 5 migration)
-- ---------------------------------------------------------------------------
create table public.deposit_types (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deposit_types_world_id_idx on public.deposit_types (world_id);

create trigger deposit_types_set_updated_at before
update on public.deposit_types for each row
execute function public.set_updated_at ();

alter table public.deposit_types enable row level security;

create policy "deposit_types_select_world_access" on public.deposit_types for
select
  to authenticated using (public.has_world_access (world_id));

create policy "deposit_types_insert_world_admin" on public.deposit_types for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "deposit_types_update_world_admin" on public.deposit_types
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

create policy "deposit_types_delete_world_admin" on public.deposit_types for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- ---------------------------------------------------------------------------
-- managed_population_types (stub – full schema added by a later Epic 6 migration)
-- ---------------------------------------------------------------------------
create table public.managed_population_types (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index managed_population_types_world_id_idx on public.managed_population_types (world_id);

create trigger managed_population_types_set_updated_at before
update on public.managed_population_types for each row
execute function public.set_updated_at ();

alter table public.managed_population_types enable row level security;

create policy "managed_population_types_select_world_access" on public.managed_population_types for
select
  to authenticated using (public.has_world_access (world_id));

create policy "managed_population_types_insert_world_admin" on public.managed_population_types for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "managed_population_types_update_world_admin" on public.managed_population_types
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

create policy "managed_population_types_delete_world_admin" on public.managed_population_types for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- ---------------------------------------------------------------------------
-- job_definitions
-- ---------------------------------------------------------------------------
create table public.job_definitions (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  name text not null,
  slug text not null,
  job_type text not null,
  base_capacity integer,
  trader_capacity_per_worker integer,
  linked_deposit_type_id uuid,
  linked_managed_population_type_id uuid,
  inputs_json jsonb not null default '[]',
  outputs_json jsonb not null default '[]',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_definitions_world_slug_unique unique (world_id, slug),
  constraint job_definitions_name_length_check check (char_length(btrim(name)) >= 1),
  constraint job_definitions_name_max_length_check check (char_length(name) <= 64),
  constraint job_definitions_slug_length_check check (char_length(btrim(slug)) >= 1),
  constraint job_definitions_slug_max_length_check check (char_length(slug) <= 64),
  constraint job_definitions_job_type_check check (
    job_type in (
      'standard',
      'construction',
      'deposit',
      'husbandry',
      'culling',
      'trader'
    )
  ),
  -- base_capacity must be present for standard/construction and absent otherwise
  constraint job_definitions_base_capacity_check check (
    (
      job_type in ('standard', 'construction')
      and base_capacity is not null
    )
    or (
      job_type not in ('standard', 'construction')
      and base_capacity is null
    )
  ),
  constraint job_definitions_base_capacity_positive_check check (
    base_capacity is null
    or base_capacity > 0
  ),
  -- trader_capacity_per_worker must be present for trader and absent otherwise
  constraint job_definitions_trader_capacity_check check (
    (
      job_type = 'trader'
      and trader_capacity_per_worker is not null
    )
    or (
      job_type <> 'trader'
      and trader_capacity_per_worker is null
    )
  ),
  constraint job_definitions_trader_capacity_positive_check check (
    trader_capacity_per_worker is null
    or trader_capacity_per_worker > 0
  ),
  -- linked_deposit_type_id only permitted when job_type = 'deposit'
  constraint job_definitions_linked_deposit_check check (
    job_type = 'deposit'
    or linked_deposit_type_id is null
  ),
  -- linked_managed_population_type_id only permitted for husbandry and culling
  constraint job_definitions_linked_managed_pop_check check (
    job_type in ('husbandry', 'culling')
    or linked_managed_population_type_id is null
  ),
  constraint job_definitions_linked_deposit_type_fk foreign key (linked_deposit_type_id) references public.deposit_types (id) deferrable initially deferred,
  constraint job_definitions_linked_managed_pop_type_fk foreign key (linked_managed_population_type_id) references public.managed_population_types (id) deferrable initially deferred
);

create index job_definitions_world_id_idx on public.job_definitions (world_id);

create trigger job_definitions_set_updated_at before
update on public.job_definitions for each row
execute function public.set_updated_at ();

alter table public.job_definitions enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
create policy "job_definitions_select_world_access" on public.job_definitions for
select
  to authenticated using (public.has_world_access (world_id));

create policy "job_definitions_insert_world_admin" on public.job_definitions for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "job_definitions_update_world_admin" on public.job_definitions
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

create policy "job_definitions_delete_world_admin" on public.job_definitions for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);
