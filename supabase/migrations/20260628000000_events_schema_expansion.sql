-- Migration: events_schema_expansion
-- Epic 7: Expand events schema with event_groups, scopes, sustained durations,
-- and expanded targets (job, building, managed_population).
--
-- New tables:
-- - event_groups: narrative grouping for multi-target events. One group + multiple
--   events rows (one per target/scope).
--
-- Extended events columns:
-- - event_group_id: nullable FK to event_groups
-- - scope_type: 'world' | 'nation' | 'settlement' with CHECK that exactly one
--   of scope_nation_id, scope_settlement_id is set per scope_type
-- - duration_type: 'instant' | 'sustained'
-- - duration_transitions: integer (number of transitions to resolve; required for sustained)
-- - remaining_transitions: integer (countdown; starts = duration_transitions)
-- - activate_on_transition_after_turn_number: already exists; used for both instant/sustained
-- - Target FKs: job_id, building_blueprint_id, managed_population_type_id
-- - amount_value: numeric (effect payload value)
-- - multiplier_value: numeric (effect payload multiplier)
-- - extra_data_jsonb: jsonb for extensibility
-- - create_citizen_memories: boolean (flag for auto-memory generation)
-- - memory_text: text (memory content when create_citizen_memories=true)
-- - Status enum: 'pending' | 'active' | 'expired' | 'cancelled'
--   (existing 'resolved' rows backfilled to 'expired')
--
-- RLS:
-- - event_groups: world members read, world admin/superadmin write
-- - events: same as event_groups
--
-- Cross-world guard:
-- - Trigger ensures nation_id and settlement_id belong to world_id
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- event_groups table
-- ---------------------------------------------------------------------------
create table public.event_groups (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  name text not null,
  description text,
  created_during_turn_number integer not null,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_groups_name_length_check check (char_length(btrim(name)) >= 1),
  constraint event_groups_turn_nonneg_check check (created_during_turn_number >= 0)
);

create index event_groups_world_id_idx on public.event_groups (world_id);

create trigger event_groups_set_updated_at before
update on public.event_groups for each row
execute function public.set_updated_at ();

alter table public.event_groups enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies: event_groups
-- ---------------------------------------------------------------------------
-- SELECT: any user with world access may read event_groups
create policy "event_groups_select_world_access" on public.event_groups for
select
  to authenticated using (public.current_user_has_world_access (world_id));

-- INSERT: world admin or super admin only
create policy "event_groups_insert_world_admin" on public.event_groups for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

-- UPDATE: world admin or super admin only
create policy "event_groups_update_world_admin" on public.event_groups
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

-- DELETE: world admin or super admin only
create policy "event_groups_delete_world_admin" on public.event_groups for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- Column grants for authenticated users
grant
select
  (
    id,
    world_id,
    name,
    description,
    created_during_turn_number,
    created_by_user_id,
    created_at,
    updated_at
  ) on public.event_groups to authenticated;

-- ---------------------------------------------------------------------------
-- Extend public.events table
-- ---------------------------------------------------------------------------
-- Add event_group_id (nullable FK)
alter table public.events
add column event_group_id uuid references public.event_groups (id) on delete set null;

-- Add scope columns: scope_type enum + scope-specific FKs
alter table public.events
add column scope_type text;

alter table public.events
add column scope_nation_id uuid references public.nations (id) on delete set null;

alter table public.events
add column scope_settlement_id uuid references public.settlements (id) on delete set null;

-- Add duration columns
alter table public.events
add column duration_type text not null default 'instant';

alter table public.events
add column duration_transitions integer;

alter table public.events
add column remaining_transitions integer;

-- Add target FKs for expanded effects
alter table public.events
add column job_id bigint;

alter table public.events
add column building_blueprint_id uuid references public.building_blueprints (id) on delete set null;

alter table public.events
add column managed_population_type_id uuid references public.managed_population_types (id) on delete set null;

-- Add effect payload fields
alter table public.events
add column amount_value numeric(18, 4);

alter table public.events
add column multiplier_value numeric(18, 4);

alter table public.events
add column extra_data_jsonb jsonb not null default '{}';

-- Add memory fields for auto-memory generation
alter table public.events
add column create_citizen_memories boolean not null default false;

alter table public.events
add column memory_text text;

-- Create index on event_group_id for query performance
create index events_event_group_id_idx on public.events (event_group_id);

-- Create index on scope columns for scope-filtered queries
create index events_scope_nation_idx on public.events (scope_nation_id)
where
  scope_nation_id is not null;

create index events_scope_settlement_idx on public.events (scope_settlement_id)
where
  scope_settlement_id is not null;

-- ---------------------------------------------------------------------------
-- Update events status enum and backfill existing resolved → expired
-- ---------------------------------------------------------------------------
-- First, backfill existing 'resolved' rows to 'expired'
update public.events
set
  status = 'expired'
where
  status = 'resolved';

-- Remove old constraint and add new one with updated enum values
alter table public.events
drop constraint events_status_check;

alter table public.events
add constraint events_status_check check (
  status in ('pending', 'active', 'expired', 'cancelled')
);

-- ---------------------------------------------------------------------------
-- Constraints for duration and scope validation
-- ---------------------------------------------------------------------------
-- Duration constraints
alter table public.events
add constraint events_duration_type_check check (duration_type in ('instant', 'sustained'));

alter table public.events
add constraint events_sustained_duration_required check (
  (
    duration_type = 'sustained'
    and duration_transitions is not null
    and duration_transitions > 0
  )
  or duration_type = 'instant'
);

-- Scope type constraint
alter table public.events
add constraint events_scope_type_check check (scope_type in ('world', 'nation', 'settlement'));

-- Scope FK exclusivity: exactly one scope FK per scope_type
alter table public.events
add constraint events_scope_fk_exclusivity check (
  (
    scope_type = 'world'
    and scope_nation_id is null
    and scope_settlement_id is null
  )
  or (
    scope_type = 'nation'
    and scope_nation_id is not null
    and scope_settlement_id is null
  )
  or (
    scope_type = 'settlement'
    and scope_nation_id is null
    and scope_settlement_id is not null
  )
);

-- ---------------------------------------------------------------------------
-- Cross-world guard trigger: nation_id and settlement_id must belong to world_id
-- ---------------------------------------------------------------------------
create or replace function public.check_events_cross_world_scope () returns trigger language plpgsql as $$
declare
  v_nation_world_id uuid;
  v_settlement_world_id uuid;
begin
  -- Check scope_nation_id belongs to world_id if set
  if new.scope_nation_id is not null then
    select n.world_id
    into v_nation_world_id
    from public.nations n
    where n.id = new.scope_nation_id;

    if v_nation_world_id is distinct from new.world_id then
      raise exception 'scope_nation_id % does not belong to world_id %',
        new.scope_nation_id, new.world_id
      using errcode = 'P0001';
    end if;
  end if;

  -- Check scope_settlement_id belongs to world_id if set
  if new.scope_settlement_id is not null then
    select n.world_id
    into v_settlement_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
    where s.id = new.scope_settlement_id;

    if v_settlement_world_id is distinct from new.world_id then
      raise exception 'scope_settlement_id % does not belong to world_id %',
        new.scope_settlement_id, new.world_id
      using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger events_check_cross_world_scope before insert
or
update on public.events for each row
execute function public.check_events_cross_world_scope ();

-- ---------------------------------------------------------------------------
-- Update RLS policies to include new columns in column grants
-- ---------------------------------------------------------------------------
-- Revoke old grants
revoke
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
  ) on public.events
from
  authenticated;

-- Grant new comprehensive column set
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
    event_group_id,
    scope_type,
    scope_nation_id,
    scope_settlement_id,
    duration_type,
    duration_transitions,
    remaining_transitions,
    job_id,
    building_blueprint_id,
    managed_population_type_id,
    amount_value,
    multiplier_value,
    extra_data_jsonb,
    create_citizen_memories,
    memory_text,
    created_at,
    updated_at
  ) on public.events to authenticated;
