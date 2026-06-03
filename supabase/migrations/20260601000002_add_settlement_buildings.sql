-- Migration: add_settlement_buildings
-- Creates public.settlement_buildings - the instance table tracking active
-- buildings in settlements. Includes the tier-blueprint mismatch guard, RLS
-- (read: world access via settlement chain; write: world admin / super admin
-- only), and two STABLE SECURITY DEFINER helpers for Epic-5 UI derivation:
--   settlement_population_cap(p_settlement_id)
--   settlement_job_capacity(p_settlement_id, p_job_id)
-- ---------------------------------------------------------------------------
-- settlement_buildings
-- ---------------------------------------------------------------------------
create table public.settlement_buildings (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  building_blueprint_id uuid not null references public.building_blueprints (id) on delete restrict,
  current_tier_id uuid not null references public.building_blueprint_tiers (id) on delete restrict,
  source_project_id uuid references public.construction_projects (id) on delete set null,
  state text not null,
  missed_upkeep_count integer not null default 0,
  activated_on_turn_number integer not null,
  deactivated_in_transition_id uuid references public.turn_transitions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlement_buildings_state_check check (
    state in (
      'active',
      'suspended',
      'auto_deconstructed',
      'manually_deconstructed'
    )
  ),
  constraint settlement_buildings_missed_upkeep_non_negative check (missed_upkeep_count >= 0)
);

create index settlement_buildings_settlement_state_idx on public.settlement_buildings (settlement_id, state);

create index settlement_buildings_blueprint_id_idx on public.settlement_buildings (building_blueprint_id);

create trigger settlement_buildings_set_updated_at before
update on public.settlement_buildings for each row
execute function public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- Trigger: enforce that current_tier_id belongs to building_blueprint_id.
-- ---------------------------------------------------------------------------
create or replace function public.check_settlement_building_tier_match () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if not exists (
    select 1
    from public.building_blueprint_tiers t
    where t.id = new.current_tier_id
      and t.building_blueprint_id = new.building_blueprint_id
  ) then
    raise exception 'current_tier_id does not belong to building_blueprint_id'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger settlement_buildings_tier_match before insert
or
update of current_tier_id,
building_blueprint_id on public.settlement_buildings for each row
execute function public.check_settlement_building_tier_match ();

alter table public.settlement_buildings enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- SELECT: any user with world access via the settlement → nation → world chain
-- (including the player-character path).
create policy "settlement_buildings_select_world_access" on public.settlement_buildings for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = settlement_buildings.settlement_id
        and public.current_user_has_world_access (n.world_id)
    )
  );

-- INSERT: world admin or super admin only. Nation/Settlement Managers are
-- intentionally excluded; their mutations go through admin-gated RPCs.
create policy "settlement_buildings_insert_world_admin" on public.settlement_buildings for insert to authenticated
with
  check (
    exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = settlement_buildings.settlement_id
        and (
          public.is_world_admin (n.world_id)
          or public.is_super_admin ()
        )
    )
  );

-- UPDATE: world admin or super admin only.
create policy "settlement_buildings_update_world_admin" on public.settlement_buildings
for update
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = settlement_buildings.settlement_id
        and (
          public.is_world_admin (n.world_id)
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
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = settlement_buildings.settlement_id
        and (
          public.is_world_admin (n.world_id)
          or public.is_super_admin ()
        )
    )
  );

-- DELETE: world admin or super admin only.
create policy "settlement_buildings_delete_world_admin" on public.settlement_buildings for delete to authenticated using (
  exists (
    select
      1
    from
      public.settlements s
      join public.nations n on n.id = s.nation_id
    where
      s.id = settlement_buildings.settlement_id
      and (
        public.is_world_admin (n.world_id)
        or public.is_super_admin ()
      )
  )
);

-- ---------------------------------------------------------------------------
-- Helper: settlement_population_cap
-- Sums population_cap_increase amounts from effects_json of the current_tier_id
-- for all active settlement_buildings in the given settlement.
-- Returns 0 when no rows match (spec: "a settlement with no
-- population-cap buildings has cap 0").
-- ---------------------------------------------------------------------------
create or replace function public.settlement_population_cap (p_settlement_id uuid) returns numeric language sql stable security definer
set
  search_path = '' as $$
  select coalesce(
    (
      select sum((e.entry ->> 'amount')::numeric)
      from public.settlement_buildings sb
      join public.building_blueprint_tiers t on t.id = sb.current_tier_id
      cross join lateral jsonb_array_elements(t.effects_json) as e (entry)
      where sb.settlement_id = p_settlement_id
        and sb.state = 'active'
        and (e.entry ->> 'type') = 'population_cap_increase'
    ),
    0
  )
$$;

revoke all on function public.settlement_population_cap (uuid)
from
  public;

grant
execute on function public.settlement_population_cap (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Helper: settlement_job_capacity
-- Returns job_definitions.base_capacity (0 if null) plus the sum of
-- job_capacity_increase effect amounts (filtered to p_job_id) from every
-- active settlement_buildings row for the given settlement.
-- Used by Card 24 to enforce the bulk-count ceiling for standard jobs.
-- ---------------------------------------------------------------------------
create or replace function public.settlement_job_capacity (p_settlement_id uuid, p_job_id uuid) returns integer language sql stable security definer
set
  search_path = '' as $$
  select
    coalesce(
      (
        select j.base_capacity
        from public.job_definitions j
        where j.id = p_job_id
      ),
      0
    )
    +
    coalesce(
      (
        select sum((e.entry ->> 'amount')::numeric)::integer
        from public.settlement_buildings sb
        join public.building_blueprint_tiers t on t.id = sb.current_tier_id
        cross join lateral jsonb_array_elements(t.effects_json) as e (entry)
        where sb.settlement_id = p_settlement_id
          and sb.state = 'active'
          and (e.entry ->> 'type') = 'job_capacity_increase'
          and (e.entry ->> 'job_id')::uuid = p_job_id
      ),
      0
    )
$$;

revoke all on function public.settlement_job_capacity (uuid, uuid)
from
  public;

grant
execute on function public.settlement_job_capacity (uuid, uuid) to authenticated;
