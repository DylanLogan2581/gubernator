-- Migration: add_building_blueprints
-- Creates building_blueprints (the catalog of building types) and
-- building_blueprint_tiers (per-tier costs and effects) for Epic 4.
-- ---------------------------------------------------------------------------
-- building_blueprints
-- ---------------------------------------------------------------------------
create table public.building_blueprints (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  name text not null,
  slug text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint building_blueprints_world_slug_unique unique (world_id, slug),
  constraint building_blueprints_name_length_check check (char_length(btrim(name)) >= 1),
  constraint building_blueprints_name_max_length_check check (char_length(name) <= 64),
  constraint building_blueprints_slug_length_check check (char_length(btrim(slug)) >= 1),
  constraint building_blueprints_slug_max_length_check check (char_length(slug) <= 64)
);

create index building_blueprints_world_id_idx on public.building_blueprints (world_id);

create trigger building_blueprints_set_updated_at before
update on public.building_blueprints for each row
execute function public.set_updated_at ();

alter table public.building_blueprints enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies – building_blueprints
-- ---------------------------------------------------------------------------
create policy "building_blueprints_select_world_access" on public.building_blueprints for
select
  to authenticated using (public.has_world_access (world_id));

create policy "building_blueprints_insert_world_admin" on public.building_blueprints for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "building_blueprints_update_world_admin" on public.building_blueprints
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

create policy "building_blueprints_delete_world_admin" on public.building_blueprints for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- ---------------------------------------------------------------------------
-- building_blueprint_tiers
-- ---------------------------------------------------------------------------
create table public.building_blueprint_tiers (
  id uuid primary key default gen_random_uuid(),
  building_blueprint_id uuid not null references public.building_blueprints (id) on delete cascade,
  tier_number integer not null,
  worker_turns_required integer not null default 0,
  construction_costs_json jsonb not null default '[]',
  upkeep_costs_json jsonb not null default '[]',
  effects_json jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint building_blueprint_tiers_unique unique (building_blueprint_id, tier_number),
  constraint building_blueprint_tiers_tier_number_check check (tier_number >= 1),
  constraint building_blueprint_tiers_worker_turns_check check (worker_turns_required >= 0)
);

create index building_blueprint_tiers_blueprint_id_idx on public.building_blueprint_tiers (building_blueprint_id);

create trigger building_blueprint_tiers_set_updated_at before
update on public.building_blueprint_tiers for each row
execute function public.set_updated_at ();

alter table public.building_blueprint_tiers enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies – building_blueprint_tiers
-- World context is resolved by joining to the parent building_blueprints row.
-- ---------------------------------------------------------------------------
create policy "building_blueprint_tiers_select_world_access" on public.building_blueprint_tiers for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.building_blueprints bb
      where
        bb.id = building_blueprint_id
        and public.has_world_access (bb.world_id)
    )
  );

create policy "building_blueprint_tiers_insert_world_admin" on public.building_blueprint_tiers for insert to authenticated
with
  check (
    exists (
      select
        1
      from
        public.building_blueprints bb
      where
        bb.id = building_blueprint_id
        and (
          public.is_world_admin (bb.world_id)
          or public.is_super_admin ()
        )
    )
  );

create policy "building_blueprint_tiers_update_world_admin" on public.building_blueprint_tiers
for update
  to authenticated using (
    exists (
      select
        1
      from
        public.building_blueprints bb
      where
        bb.id = building_blueprint_id
        and (
          public.is_world_admin (bb.world_id)
          or public.is_super_admin ()
        )
    )
  )
with
  check (
    exists (
      select
        1
      from
        public.building_blueprints bb
      where
        bb.id = building_blueprint_id
        and (
          public.is_world_admin (bb.world_id)
          or public.is_super_admin ()
        )
    )
  );

create policy "building_blueprint_tiers_delete_world_admin" on public.building_blueprint_tiers for delete to authenticated using (
  exists (
    select
      1
    from
      public.building_blueprints bb
    where
      bb.id = building_blueprint_id
      and (
        public.is_world_admin (bb.world_id)
        or public.is_super_admin ()
      )
  )
);
