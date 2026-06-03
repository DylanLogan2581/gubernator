-- Migration: add_settlement_turn_resource_snapshots
-- Adds public.settlement_turn_resource_snapshots for Epic 6: one row per
-- (turn_transition_id, settlement_id, resource_id) per completed turn
-- transition, tracking quantity deltas across the turn. Required by the
-- Epic 6 stockpile-clamp phase and Epic 8 reporting.
--
-- world_id is denormalized so the SELECT RLS check avoids a join through the
-- settlement → nation → world chain. A composite FK
--   (turn_transition_id, world_id) → turn_transitions (id, world_id)
-- mirrors the settlement_turn_snapshots pattern and guarantees referential
-- integrity across the world boundary.
--
-- turn_transition_id is nullable to support the §6c baseline backfill, where
-- a snapshot is created before the first turn transition has been recorded.
-- ---------------------------------------------------------------------------
-- settlement_turn_resource_snapshots
-- ---------------------------------------------------------------------------
create table public.settlement_turn_resource_snapshots (
  id uuid primary key default gen_random_uuid(),
  turn_transition_id uuid,
  world_id uuid not null references public.worlds (id) on delete cascade,
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  turn_number integer not null,
  quantity_before numeric(18, 4) not null default 0,
  quantity_after numeric(18, 4) not null default 0,
  produced_amount numeric(18, 4) not null default 0,
  consumed_amount numeric(18, 4) not null default 0,
  trade_in_amount numeric(18, 4) not null default 0,
  trade_out_amount numeric(18, 4) not null default 0,
  created_at timestamptz not null default now(),
  constraint settlement_turn_resource_snapshots_transition_world_fkey foreign key (turn_transition_id, world_id) references public.turn_transitions (id, world_id) on delete cascade,
  constraint settlement_turn_resource_snapshots_unique unique (turn_transition_id, settlement_id, resource_id)
);

comment on column public.settlement_turn_resource_snapshots.turn_transition_id is 'Nullable to allow §6c baseline backfill snapshots created before the first recorded turn transition.';

create index settlement_turn_resource_snapshots_transition_settlement_idx on public.settlement_turn_resource_snapshots (turn_transition_id, settlement_id);

create index settlement_turn_resource_snapshots_settlement_resource_turn_idx on public.settlement_turn_resource_snapshots (settlement_id, resource_id, turn_number desc);

alter table public.settlement_turn_resource_snapshots enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
create policy "settlement_turn_resource_snapshots_select_world_access" on public.settlement_turn_resource_snapshots for
select
  to authenticated using (public.current_user_has_world_access (world_id));

create policy "settlement_turn_resource_snapshots_insert_world_admin" on public.settlement_turn_resource_snapshots for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "settlement_turn_resource_snapshots_update_world_admin" on public.settlement_turn_resource_snapshots
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

create policy "settlement_turn_resource_snapshots_delete_world_admin" on public.settlement_turn_resource_snapshots for delete to authenticated using (
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
update on public.settlement_turn_resource_snapshots
from
  authenticated;

grant insert (
  id,
  turn_transition_id,
  world_id,
  settlement_id,
  resource_id,
  turn_number,
  quantity_before,
  quantity_after,
  produced_amount,
  consumed_amount,
  trade_in_amount,
  trade_out_amount
) on public.settlement_turn_resource_snapshots to authenticated;
