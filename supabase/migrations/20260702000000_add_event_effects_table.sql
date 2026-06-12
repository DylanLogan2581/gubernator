-- Migration: add_event_effects_table
-- Purpose: Support multiple typed effects per event.
--
-- New table: event_effects
-- - Links to events (FK)
-- - effect_type: one of 10 types (building_damage, consumption_multiplier, etc.)
-- - amount_value: numeric for flat amounts (resource drain/grant, population loss/boost)
-- - multiplier_value: numeric for multipliers (production, consumption, upkeep)
-- - is_percent: boolean, true if amount_value is a percent of current value
-- - resource_id: FK to resources (for resource_grant, resource_drain)
-- - job_id: FK to job_definitions (filter for population_loss)
-- - managed_population_instance_id: FK to managed_population_instances (for managed_population_change)
-- - deposit_instance_id: FK to deposit_instances (for deposit_discovered)
-- - Extra fields for extensibility
--
-- RLS:
-- - SELECT: world members
-- - INSERT/UPDATE/DELETE: world admin or superadmin
--
-- Note: event_effects replaces the single free-text effect_type field.
-- Existing events.effect_type kept for backward compat; new flows use event_effects.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Create event_effects table
-- ---------------------------------------------------------------------------
create table public.event_effects (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  effect_type text not null check (
    effect_type in (
      'building_damage',
      'consumption_multiplier',
      'deposit_discovered',
      'managed_population_change',
      'population_boost',
      'population_loss',
      'production_multiplier',
      'resource_drain',
      'resource_grant',
      'upkeep_multiplier'
    )
  ),
  -- Effect payload fields
  amount_value numeric(18, 4),
  multiplier_value numeric(18, 4),
  is_percent boolean not null default false,
  -- Target FKs
  resource_id uuid references public.resources (id) on delete set null,
  job_id uuid references public.job_definitions (id) on delete set null,
  managed_population_instance_id uuid references public.managed_population_instances (id) on delete set null,
  deposit_instance_id uuid references public.deposit_instances (id) on delete set null,
  -- Extra data for future extensions
  extra_data_jsonb jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Constraints: each effect type has required and optional fields
  -- building_damage: no fields required (payload in event itself if needed)
  -- consumption_multiplier: multiplier_value required
  -- deposit_discovered: no fields required
  -- managed_population_change: amount_value required
  -- population_boost: amount_value required, is_percent optional
  -- population_loss: amount_value required, is_percent optional, job_id optional
  -- production_multiplier: multiplier_value required
  -- resource_grant: resource_id + amount_value required, is_percent optional
  -- resource_drain: resource_id + amount_value required, is_percent optional
  -- upkeep_multiplier: multiplier_value required
  constraint event_effects_multiplier_required_for_multiplier_types check (
    (
      effect_type in (
        'consumption_multiplier',
        'production_multiplier',
        'upkeep_multiplier'
      )
      and multiplier_value is not null
    )
    or effect_type not in (
      'consumption_multiplier',
      'production_multiplier',
      'upkeep_multiplier'
    )
  ),
  constraint event_effects_amount_required_for_amount_types check (
    (
      effect_type in (
        'managed_population_change',
        'population_boost',
        'population_loss',
        'resource_grant',
        'resource_drain'
      )
      and amount_value is not null
    )
    or effect_type not in (
      'managed_population_change',
      'population_boost',
      'population_loss',
      'resource_grant',
      'resource_drain'
    )
  ),
  constraint event_effects_resource_required_for_resource_types check (
    (
      effect_type in ('resource_grant', 'resource_drain')
      and resource_id is not null
    )
    or effect_type not in ('resource_grant', 'resource_drain')
  )
);

-- Indexes for query performance
create index event_effects_event_id_idx on public.event_effects (event_id);

create index event_effects_effect_type_idx on public.event_effects (effect_type);

create index event_effects_resource_id_idx on public.event_effects (resource_id)
where
  resource_id is not null;

create index event_effects_job_id_idx on public.event_effects (job_id)
where
  job_id is not null;

-- Updated_at trigger
create trigger event_effects_set_updated_at before
update on public.event_effects for each row
execute function public.set_updated_at ();

-- Enable RLS
alter table public.event_effects enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies for event_effects
-- ---------------------------------------------------------------------------
-- SELECT: any user with world access (via event)
create policy "event_effects_select_world_access" on public.event_effects for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.events e
      where
        e.id = event_id
        and public.current_user_has_world_access (e.world_id)
    )
  );

-- INSERT: world admin or superadmin only
create policy "event_effects_insert_world_admin" on public.event_effects for insert to authenticated
with
  check (
    exists (
      select
        1
      from
        public.events e
      where
        e.id = event_id
        and (
          public.is_world_admin (e.world_id)
          or public.is_super_admin ()
        )
    )
  );

-- UPDATE: world admin or superadmin only
create policy "event_effects_update_world_admin" on public.event_effects
for update
  to authenticated using (
    exists (
      select
        1
      from
        public.events e
      where
        e.id = event_id
        and (
          public.is_world_admin (e.world_id)
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
        public.events e
      where
        e.id = event_id
        and (
          public.is_world_admin (e.world_id)
          or public.is_super_admin ()
        )
    )
  );

-- DELETE: world admin or superadmin only
create policy "event_effects_delete_world_admin" on public.event_effects for delete to authenticated using (
  exists (
    select
      1
    from
      public.events e
    where
      e.id = event_id
      and (
        public.is_world_admin (e.world_id)
        or public.is_super_admin ()
      )
  )
);

-- Column grants for authenticated users
grant
select
  (
    id,
    event_id,
    effect_type,
    amount_value,
    multiplier_value,
    is_percent,
    resource_id,
    job_id,
    managed_population_instance_id,
    deposit_instance_id,
    extra_data_jsonb,
    created_at,
    updated_at
  ) on public.event_effects to authenticated;
