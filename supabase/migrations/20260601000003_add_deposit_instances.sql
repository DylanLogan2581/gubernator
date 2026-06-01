-- Migration: add_deposit_instances
-- Creates public.deposit_instances (per-settlement deposit registry) and
-- public.deposit_instance_resources (resource mix with starting and remaining
-- reserve quantities) together — they have tight coupling and arrive as one unit.
-- ---------------------------------------------------------------------------
-- deposit_instances
-- ---------------------------------------------------------------------------
create table public.deposit_instances (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  deposit_type_id uuid not null references public.deposit_types (id) on delete restrict,
  name text not null,
  status text not null,
  max_workers integer,
  discovered_by_event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deposit_instances_status_check check (status in ('active', 'depleted', 'removed')),
  constraint deposit_instances_max_workers_positive check (
    max_workers is null
    or max_workers > 0
  ),
  constraint deposit_instances_name_length_check check (char_length(btrim(name)) >= 1)
);

comment on column public.deposit_instances.discovered_by_event_id is 'Nullable placeholder for the future events table; intentionally not yet constrained by a foreign key. Epic 7 will add the FK constraint when events ships.';

create index deposit_instances_settlement_id_idx on public.deposit_instances (settlement_id);

create index deposit_instances_deposit_type_id_idx on public.deposit_instances (deposit_type_id);

create index deposit_instances_status_idx on public.deposit_instances (status);

create trigger deposit_instances_set_updated_at before
update on public.deposit_instances for each row
execute function public.set_updated_at ();

alter table public.deposit_instances enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies: deposit_instances
-- ---------------------------------------------------------------------------
-- SELECT: world access via settlement → nation chain (includes player-character path).
create policy "deposit_instances_select_world_access" on public.deposit_instances for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = deposit_instances.settlement_id
        and public.current_user_has_world_access (n.world_id)
    )
  );

-- INSERT: world admin or super admin only. Managers are intentionally excluded;
-- deposits arrive via admin action or future events (Epic 7).
create policy "deposit_instances_insert_world_admin" on public.deposit_instances for insert to authenticated
with
  check (
    exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = deposit_instances.settlement_id
        and (
          public.is_world_admin (n.world_id)
          or public.is_super_admin ()
        )
    )
  );

-- UPDATE: world admin or super admin only.
create policy "deposit_instances_update_world_admin" on public.deposit_instances
for update
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = deposit_instances.settlement_id
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
        s.id = deposit_instances.settlement_id
        and (
          public.is_world_admin (n.world_id)
          or public.is_super_admin ()
        )
    )
  );

-- DELETE: world admin or super admin only.
create policy "deposit_instances_delete_world_admin" on public.deposit_instances for delete to authenticated using (
  exists (
    select
      1
    from
      public.settlements s
      join public.nations n on n.id = s.nation_id
    where
      s.id = deposit_instances.settlement_id
      and (
        public.is_world_admin (n.world_id)
        or public.is_super_admin ()
      )
  )
);

-- ---------------------------------------------------------------------------
-- deposit_instance_resources
-- ---------------------------------------------------------------------------
create table public.deposit_instance_resources (
  id uuid primary key default gen_random_uuid(),
  deposit_instance_id uuid not null references public.deposit_instances (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete restrict,
  initial_quantity numeric(18, 4) not null,
  remaining_quantity numeric(18, 4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deposit_instance_resources_unique unique (deposit_instance_id, resource_id),
  constraint deposit_instance_resources_initial_quantity_positive check (initial_quantity > 0),
  constraint deposit_instance_resources_remaining_quantity_range check (
    remaining_quantity >= 0
    and remaining_quantity <= initial_quantity
  )
);

create index deposit_instance_resources_deposit_instance_id_idx on public.deposit_instance_resources (deposit_instance_id);

create trigger deposit_instance_resources_set_updated_at before
update on public.deposit_instance_resources for each row
execute function public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- Trigger: resource_id must belong to the same world as the deposit instance's
-- settlement. Enforced as a BEFORE trigger rather than a composite FK because
-- the world_id is reachable only via a 4-level join
-- (instance → settlement → nation → world); denormalizing world_id all the way
-- down is not practical here.
-- ---------------------------------------------------------------------------
create or replace function public.check_deposit_instance_resource_same_world () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_world_id uuid;
  v_resource_world_id   uuid;
begin
  select n.world_id into v_settlement_world_id
  from public.deposit_instances di
    join public.settlements s on s.id = di.settlement_id
    join public.nations n on n.id = s.nation_id
  where di.id = new.deposit_instance_id;

  select r.world_id into v_resource_world_id
  from public.resources r
  where r.id = new.resource_id;

  if v_settlement_world_id is distinct from v_resource_world_id then
    raise exception 'resource % belongs to world % but deposit instance belongs to world %',
      new.resource_id, v_resource_world_id, v_settlement_world_id
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.check_deposit_instance_resource_same_world ()
from
  public;

create trigger deposit_instance_resources_same_world before insert
or
update of resource_id,
deposit_instance_id on public.deposit_instance_resources for each row
execute function public.check_deposit_instance_resource_same_world ();

-- ---------------------------------------------------------------------------
-- Trigger: resource must not be soft-deleted on INSERT. Existing rows survive a
-- subsequent soft-delete (grandfathered); only new inserts are blocked.
-- ---------------------------------------------------------------------------
create or replace function public.check_deposit_instance_resource_not_trashed () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_is_trashed boolean;
begin
  select r.is_trashed into v_is_trashed
  from public.resources r
  where r.id = new.resource_id;

  if v_is_trashed then
    raise exception 'resource % is soft-deleted and cannot be referenced by a new deposit_instance_resources row',
      new.resource_id
      using errcode = '23001';
  end if;

  return new;
end;
$$;

revoke all on function public.check_deposit_instance_resource_not_trashed ()
from
  public;

create trigger deposit_instance_resources_not_trashed before insert on public.deposit_instance_resources for each row
execute function public.check_deposit_instance_resource_not_trashed ();

alter table public.deposit_instance_resources enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies: deposit_instance_resources
-- ---------------------------------------------------------------------------
-- SELECT: world access via deposit_instance → settlement → nation chain.
create policy "deposit_instance_resources_select_world_access" on public.deposit_instance_resources for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.deposit_instances di
        join public.settlements s on s.id = di.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        di.id = deposit_instance_resources.deposit_instance_id
        and public.current_user_has_world_access (n.world_id)
    )
  );

-- INSERT: world admin or super admin only.
create policy "deposit_instance_resources_insert_world_admin" on public.deposit_instance_resources for insert to authenticated
with
  check (
    exists (
      select
        1
      from
        public.deposit_instances di
        join public.settlements s on s.id = di.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        di.id = deposit_instance_resources.deposit_instance_id
        and (
          public.is_world_admin (n.world_id)
          or public.is_super_admin ()
        )
    )
  );

-- UPDATE: world admin or super admin only.
create policy "deposit_instance_resources_update_world_admin" on public.deposit_instance_resources
for update
  to authenticated using (
    exists (
      select
        1
      from
        public.deposit_instances di
        join public.settlements s on s.id = di.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        di.id = deposit_instance_resources.deposit_instance_id
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
        public.deposit_instances di
        join public.settlements s on s.id = di.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        di.id = deposit_instance_resources.deposit_instance_id
        and (
          public.is_world_admin (n.world_id)
          or public.is_super_admin ()
        )
    )
  );

-- DELETE: world admin or super admin only.
create policy "deposit_instance_resources_delete_world_admin" on public.deposit_instance_resources for delete to authenticated using (
  exists (
    select
      1
    from
      public.deposit_instances di
      join public.settlements s on s.id = di.settlement_id
      join public.nations n on n.id = s.nation_id
    where
      di.id = deposit_instance_resources.deposit_instance_id
      and (
        public.is_world_admin (n.world_id)
        or public.is_super_admin ()
      )
  )
);
