-- Migration: add_construction_projects
-- Creates public.construction_projects for Epic 5 settlement operations.
-- Stores the planning-time backlog of construction projects targeting
-- building_blueprint_tiers. Supports multiple in-progress projects, worker
-- assignment, pause-on-shortfall, and cancellation per spec §7–8.
-- ---------------------------------------------------------------------------
-- construction_projects
-- ---------------------------------------------------------------------------
create table public.construction_projects (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  building_blueprint_id uuid not null references public.building_blueprints (id) on delete restrict,
  target_tier_id uuid not null references public.building_blueprint_tiers (id) on delete restrict,
  status text not null,
  queue_position integer not null,
  progress_worker_turns numeric(18, 4) not null default 0,
  completed_in_transition_id uuid references public.turn_transitions (id) on delete set null,
  activated_on_turn_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint construction_projects_status_check check (
    status in (
      'queued',
      'in_progress',
      'paused',
      'complete',
      'cancelled'
    )
  ),
  constraint construction_projects_progress_non_negative check (progress_worker_turns >= 0),
  constraint construction_projects_queue_position_positive check (queue_position >= 1)
);

-- Partial unique index: one active queue_position per settlement among non-terminal
-- statuses. Completed and cancelled rows are excluded so they do not block reordering.
create unique index construction_projects_settlement_queue_position_idx on public.construction_projects (settlement_id, queue_position)
where
  status in ('queued', 'in_progress', 'paused');

create index construction_projects_settlement_status_idx on public.construction_projects (settlement_id, status);

create index construction_projects_blueprint_id_idx on public.construction_projects (building_blueprint_id);

create index construction_projects_target_tier_id_idx on public.construction_projects (target_tier_id);

create trigger construction_projects_set_updated_at before
update on public.construction_projects for each row
execute function public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- Trigger: enforce that target_tier_id belongs to building_blueprint_id.
-- Named so it fires after check_max_instances (alphabetical order within the
-- same BEFORE INSERT event) — a tier-mismatch should produce a clear error
-- rather than being swallowed by the instance-cap check.
-- ---------------------------------------------------------------------------
create or replace function public.check_construction_project_tier_match () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if not exists (
    select 1
    from public.building_blueprint_tiers t
    where t.id = new.target_tier_id
      and t.building_blueprint_id = new.building_blueprint_id
  ) then
    raise exception 'target_tier_id does not belong to building_blueprint_id'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger construction_projects_tier_match before insert
or
update of target_tier_id,
building_blueprint_id on public.construction_projects for each row
execute function public.check_construction_project_tier_match ();

-- ---------------------------------------------------------------------------
-- Trigger: enforce max_instances_per_settlement limit on INSERT.
-- Counts in-flight (queued / in_progress / paused) construction_projects for
-- the same settlement × blueprint pair. settlement_buildings does not yet
-- exist (Epic 6); that count will be folded into this guard when that table
-- ships.
-- ---------------------------------------------------------------------------
create or replace function public.check_construction_project_max_instances () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_max          integer;
  v_active_count integer;
begin
  -- Only enforce the cap for non-terminal inserts.
  if new.status not in ('queued', 'in_progress', 'paused') then
    return new;
  end if;

  select max_instances_per_settlement
  into v_max
  from public.building_blueprints
  where id = new.building_blueprint_id;

  if v_max is null then
    return new;
  end if;

  -- The new row does not exist yet, so no self-exclusion is needed.
  select count(*)
  into v_active_count
  from public.construction_projects
  where settlement_id = new.settlement_id
    and building_blueprint_id = new.building_blueprint_id
    and status in ('queued', 'in_progress', 'paused');

  if v_active_count >= v_max then
    raise exception
      'settlement has reached the maximum number of in-flight construction projects for this blueprint (limit: %)',
      v_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger construction_projects_max_instances before insert on public.construction_projects for each row
execute function public.check_construction_project_max_instances ();

alter table public.construction_projects enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- SELECT: any user with world access via the settlement → nation → world chain
-- (including the player-character path).
create policy "construction_projects_select_world_access" on public.construction_projects for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = construction_projects.settlement_id
        and public.current_user_has_world_access (n.world_id)
    )
  );

-- INSERT / UPDATE / DELETE: super admin, world admin, nation manager of the
-- parent nation, or settlement manager of this settlement — all resolved by
-- current_user_manages_settlement.
create policy "construction_projects_insert_manager" on public.construction_projects for insert to authenticated
with
  check (
    public.current_user_manages_settlement (settlement_id)
  );

create policy "construction_projects_update_manager" on public.construction_projects
for update
  to authenticated using (
    public.current_user_manages_settlement (settlement_id)
  )
with
  check (
    public.current_user_manages_settlement (settlement_id)
  );

create policy "construction_projects_delete_manager" on public.construction_projects for delete to authenticated using (
  public.current_user_manages_settlement (settlement_id)
);
