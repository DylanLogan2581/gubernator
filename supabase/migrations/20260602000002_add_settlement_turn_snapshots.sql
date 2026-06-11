-- Migration: add_settlement_turn_snapshots
-- Adds public.settlement_turn_snapshots for Epic 6: one row per settlement per
-- completed turn transition, used by Epic 7 (forecast comparison) and Epic 8
-- (reporting).
--
-- world_id is denormalized so the SELECT RLS check avoids a join through the
-- settlement → nation → world chain. A composite FK
--   (turn_transition_id, world_id) → turn_transitions (id, world_id)
-- mirrors the turn_log_entries pattern and guarantees referential integrity
-- across the world boundary.
--
-- turn_transition_id is nullable to support the §6c baseline backfill, where
-- a snapshot is created before the first turn transition has been recorded.
-- ---------------------------------------------------------------------------
-- settlement_turn_snapshots
-- ---------------------------------------------------------------------------
create table public.settlement_turn_snapshots (
  id uuid primary key default gen_random_uuid(),
  turn_transition_id uuid,
  world_id uuid not null references public.worlds (id) on delete cascade,
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  turn_number integer not null,
  population_total integer not null,
  population_npc integer not null,
  population_player_character integer not null,
  population_cap integer not null,
  birth_count integer not null default 0,
  death_count integer not null default 0,
  starvation_deaths_count integer not null default 0,
  homeless_deaths_count integer not null default 0,
  partnerships_formed_count integer not null default 0,
  managed_populations_summary_json jsonb,
  buildings_summary_json jsonb,
  trade_summary_json jsonb,
  warnings_summary_json jsonb,
  created_at timestamptz not null default now(),
  constraint settlement_turn_snapshots_transition_world_fkey foreign key (turn_transition_id, world_id) references public.turn_transitions (id, world_id) on delete cascade
);

comment on column public.settlement_turn_snapshots.turn_transition_id is 'Nullable to allow §6c baseline backfill snapshots created before the first recorded turn transition.';

create index settlement_turn_snapshots_world_transition_idx on public.settlement_turn_snapshots (world_id, turn_transition_id);

create index settlement_turn_snapshots_settlement_turn_idx on public.settlement_turn_snapshots (settlement_id, turn_number desc);

alter table public.settlement_turn_snapshots enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
create policy "settlement_turn_snapshots_select_world_access" on public.settlement_turn_snapshots for
select
  to authenticated using (public.current_user_has_world_access (world_id));

create policy "settlement_turn_snapshots_insert_world_admin" on public.settlement_turn_snapshots for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "settlement_turn_snapshots_update_world_admin" on public.settlement_turn_snapshots
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

create policy "settlement_turn_snapshots_delete_world_admin" on public.settlement_turn_snapshots for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- ---------------------------------------------------------------------------
-- Column-level grants: restrict direct INSERT to snapshot data columns;
-- UPDATE is revoked entirely to enforce append-only semantics. The production
-- write path goes through the Epic 6 SECURITY DEFINER RPC which bypasses
-- these grants by running as the function owner.
-- ---------------------------------------------------------------------------
revoke insert,
update on public.settlement_turn_snapshots
from
  authenticated;

grant insert (
  id,
  turn_transition_id,
  world_id,
  settlement_id,
  turn_number,
  population_total,
  population_npc,
  population_player_character,
  population_cap,
  birth_count,
  death_count,
  starvation_deaths_count,
  homeless_deaths_count,
  partnerships_formed_count,
  managed_populations_summary_json,
  buildings_summary_json,
  trade_summary_json,
  warnings_summary_json
) on public.settlement_turn_snapshots to authenticated;
