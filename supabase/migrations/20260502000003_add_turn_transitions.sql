-- Migration: add_turn_transitions
-- Adds world-scoped metadata for each turn transition run.
-- ---------------------------------------------------------------------------
-- turn_transitions
-- ---------------------------------------------------------------------------
create table public.turn_transitions (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  from_turn_number integer not null,
  to_turn_number integer not null,
  initiated_by_user_id uuid not null references public.users (id) on delete restrict,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  readiness_summary_jsonb jsonb,
  forecast_snapshot_jsonb jsonb,
  constraint turn_transitions_turn_sequence_check check (to_turn_number = from_turn_number + 1),
  constraint turn_transitions_from_turn_number_check check (from_turn_number >= 0),
  constraint turn_transitions_status_check check (status in ('running', 'completed', 'failed'))
);

create index turn_transitions_world_id_idx on public.turn_transitions (world_id);

create index turn_transitions_initiated_by_user_id_idx on public.turn_transitions (initiated_by_user_id);

alter table public.turn_transitions enable row level security;

create policy "turn_transitions_select_world_access" on public.turn_transitions for
select
  to authenticated using (public.has_world_access (world_id));

create policy "turn_transitions_insert_world_admin" on public.turn_transitions for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "turn_transitions_update_world_admin" on public.turn_transitions
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

create policy "turn_transitions_delete_world_admin" on public.turn_transitions for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);
