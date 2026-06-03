-- Migration: add_events
-- Creates the public.events table — the persistence layer for world events that
-- drive the phaseEvents simulation phase (Epic 6, phase 11). Epic 7 will fill
-- in effect resolution per effect_type; for now every case is a no-op in the
-- simulation engine but the schema is fully defined so downstream foreign keys
-- (e.g. deposit_instances.discovered_by_event_id) can be constrained in Epic 7.
-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'pending',
  effect_type text not null,
  activate_on_transition_after_turn_number integer not null,
  effect_payload_jsonb jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_status_check check (
    status in ('pending', 'active', 'resolved', 'expired')
  ),
  constraint events_effect_type_check check (
    effect_type in (
      'deposit_discovered',
      'population_loss',
      'resource_grant'
    )
  ),
  constraint events_name_length_check check (char_length(btrim(name)) >= 1),
  constraint events_activate_turn_nonneg check (activate_on_transition_after_turn_number >= 0)
);

create index events_world_id_idx on public.events (world_id);

create index events_world_status_idx on public.events (world_id, status);

create trigger events_set_updated_at before
update on public.events for each row
execute function public.set_updated_at ();

alter table public.events enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies: events
-- ---------------------------------------------------------------------------
-- SELECT: any user with world access may read events.
create policy "events_select_world_access" on public.events for
select
  to authenticated using (public.current_user_has_world_access (world_id));

-- INSERT: world admin or super admin only.
create policy "events_insert_world_admin" on public.events for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

-- UPDATE: world admin or super admin only.
create policy "events_update_world_admin" on public.events
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

-- DELETE: world admin or super admin only.
create policy "events_delete_world_admin" on public.events for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- ---------------------------------------------------------------------------
-- Column grants: authenticated users may read events columns; writes are
-- restricted to admin RPCs (SECURITY DEFINER) or the policies above for
-- admin-role users.
-- ---------------------------------------------------------------------------
grant
select
  (
    id,
    world_id,
    name,
    description,
    status,
    effect_type,
    activate_on_transition_after_turn_number,
    effect_payload_jsonb,
    created_at,
    updated_at
  ) on public.events to authenticated;
