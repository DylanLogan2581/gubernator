-- Migration: add_unit_types
-- Epic 13 (#1107): world-admin-defined unit types (levy, spearman, knight...)
-- Foundation registry for the future armies feature -- costs, upkeep,
-- desertion rate, and optional recruitment requirements (minimum education
-- level and/or a settlement building at a minimum active tier). No consumer
-- (recruited army units) exists yet; both null = recruit anywhere.
-- ---------------------------------------------------------------------------
create table public.unit_types (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  name text not null,
  description text,
  soldiers_per_unit integer not null,
  required_education_level_id uuid references public.education_levels (id) on delete set null,
  required_building_blueprint_id uuid references public.building_blueprints (id) on delete set null,
  required_building_tier_number integer,
  recruitment_costs_json jsonb not null default '[]',
  upkeep_costs_json jsonb not null default '[]',
  desertion_rate numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_types_world_name_unique unique (world_id, name),
  constraint unit_types_name_length_check check (char_length(btrim(name)) >= 1),
  constraint unit_types_name_max_length_check check (char_length(name) <= 64),
  constraint unit_types_description_max_length_check check (
    description is null
    or char_length(description) <= 1000
  ),
  constraint unit_types_soldiers_per_unit_check check (soldiers_per_unit > 0),
  constraint unit_types_desertion_rate_check check (
    desertion_rate >= 0
    and desertion_rate <= 1
  ),
  -- Both null (recruit anywhere) or both set -- a tier number without a
  -- blueprint (or vice versa) is meaningless.
  constraint unit_types_building_requirement_pair_check check (
    (required_building_blueprint_id is null) = (required_building_tier_number is null)
  ),
  -- Composite FK (rather than a plain integer check) so the configured tier
  -- number must be a real tier of the referenced blueprint. MATCH SIMPLE
  -- (Postgres default) skips enforcement when either column is null, which
  -- is exactly the "recruit anywhere" case above.
  constraint unit_types_required_building_tier_fk foreign key (
    required_building_blueprint_id,
    required_building_tier_number
  ) references public.building_blueprint_tiers (building_blueprint_id, tier_number) on delete set null
);

create index unit_types_world_id_idx on public.unit_types (world_id);

create index unit_types_required_education_level_id_idx on public.unit_types (required_education_level_id);

create index unit_types_required_building_blueprint_id_idx on public.unit_types (required_building_blueprint_id);

create trigger unit_types_set_updated_at before
update on public.unit_types for each row
execute function public.set_updated_at ();

alter table public.unit_types enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies -- standard config-table pattern (select: world access,
-- writes: world admin/super admin)
-- ---------------------------------------------------------------------------
create policy "unit_types_select_world_access" on public.unit_types for
select
  to authenticated using (public.has_world_access (world_id));

create policy "unit_types_insert_world_admin" on public.unit_types for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "unit_types_update_world_admin" on public.unit_types
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

create policy "unit_types_delete_world_admin" on public.unit_types for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);
