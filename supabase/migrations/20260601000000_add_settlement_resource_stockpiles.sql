-- Migration: add_settlement_resource_stockpiles
-- Creates public.settlement_resource_stockpiles, the Epic 5 table that tracks
-- resource quantities held by each settlement.
--
-- Two seed triggers mirror the worlds_seed_system_resources pattern:
--   • settlements_seed_stockpiles fires on settlement INSERT and seeds one
--     zero-quantity row per active (non-deleted) resource in the world.
--   • resources_seed_stockpiles fires on resource INSERT and seeds one row per
--     existing settlement in the world.
--
-- A backfill step primes all existing settlement × active-resource pairs so
-- seeded worlds are fully valid after npx supabase db reset.
--
-- Write access is restricted to world admin / super admin only. Nation Managers
-- and Settlement Managers are intentionally excluded from direct table writes;
-- their mutations go through the RPC ladder (Card 8) and simulation (Epic 6).
-- ---------------------------------------------------------------------------
-- settlement_resource_stockpiles
-- ---------------------------------------------------------------------------
create table public.settlement_resource_stockpiles (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  quantity numeric(18, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlement_resource_stockpiles_settlement_resource_unique unique (settlement_id, resource_id),
  constraint settlement_resource_stockpiles_quantity_non_negative check (quantity >= 0)
);

create index settlement_resource_stockpiles_settlement_id_idx on public.settlement_resource_stockpiles (settlement_id);

create index settlement_resource_stockpiles_resource_id_idx on public.settlement_resource_stockpiles (resource_id);

create trigger settlement_resource_stockpiles_set_updated_at before
update on public.settlement_resource_stockpiles for each row
execute function public.set_updated_at ();

alter table public.settlement_resource_stockpiles enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- SELECT: any user with world access (including via the player-character path)
-- may read stockpiles through the settlement → nation → world chain.
create policy "settlement_resource_stockpiles_select_world_access" on public.settlement_resource_stockpiles for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = settlement_resource_stockpiles.settlement_id
        and public.current_user_has_world_access (n.world_id)
    )
  );

-- INSERT: world admin or super admin only. Nation Managers and Settlement
-- Managers are intentionally excluded; the explicit WITH CHECK enforces this
-- rather than relying on absence of a permissive policy.
create policy "settlement_resource_stockpiles_insert_world_admin" on public.settlement_resource_stockpiles for insert to authenticated
with
  check (
    exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = settlement_resource_stockpiles.settlement_id
        and (
          public.is_world_admin (n.world_id)
          or public.is_super_admin ()
        )
    )
  );

-- UPDATE: world admin or super admin only.
create policy "settlement_resource_stockpiles_update_world_admin" on public.settlement_resource_stockpiles
for update
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = settlement_resource_stockpiles.settlement_id
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
        s.id = settlement_resource_stockpiles.settlement_id
        and (
          public.is_world_admin (n.world_id)
          or public.is_super_admin ()
        )
    )
  );

-- DELETE: world admin or super admin only.
create policy "settlement_resource_stockpiles_delete_world_admin" on public.settlement_resource_stockpiles for delete to authenticated using (
  exists (
    select
      1
    from
      public.settlements s
      join public.nations n on n.id = s.nation_id
    where
      s.id = settlement_resource_stockpiles.settlement_id
      and (
        public.is_world_admin (n.world_id)
        or public.is_super_admin ()
      )
  )
);

-- ---------------------------------------------------------------------------
-- Column-level grants: narrow direct INSERT/UPDATE to user-editable columns.
-- Scope columns (settlement_id, resource_id) are INSERT-only so rows cannot be
-- relocated after creation. quantity is the only mutable column.
-- ---------------------------------------------------------------------------
revoke insert,
update on public.settlement_resource_stockpiles
from
  authenticated;

grant insert (id, settlement_id, resource_id, quantity) on public.settlement_resource_stockpiles to authenticated;

grant
update (quantity) on public.settlement_resource_stockpiles to authenticated;

-- ---------------------------------------------------------------------------
-- Seed trigger: settlement INSERT → seed one row per active resource in world.
-- SECURITY DEFINER so the trigger bypasses the RLS insert policy when fired by
-- a role that is not a world admin (e.g. service-role world-creation paths).
-- ---------------------------------------------------------------------------
create or replace function public.seed_settlement_stockpiles_on_settlement_insert () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  insert into
    public.settlement_resource_stockpiles (settlement_id, resource_id, quantity)
  select
    new.id,
    r.id,
    0
  from
    public.resources r
    join public.nations n on n.id = new.nation_id
  where
    r.world_id = n.world_id
    and r.is_trashed = false
  on conflict (settlement_id, resource_id) do nothing;

  return new;
end;
$$;

create trigger settlements_seed_stockpiles
after insert on public.settlements for each row
execute function public.seed_settlement_stockpiles_on_settlement_insert ();

-- ---------------------------------------------------------------------------
-- Seed trigger: resource INSERT → seed one row per existing settlement in world.
-- SECURITY DEFINER for the same reason as above. Guards against resources
-- inserted with is_deleted = true (not a normal path but defensive).
-- ---------------------------------------------------------------------------
create or replace function public.seed_stockpiles_on_resource_insert () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if new.is_trashed then
    return new;
  end if;

  insert into
    public.settlement_resource_stockpiles (settlement_id, resource_id, quantity)
  select
    s.id,
    new.id,
    0
  from
    public.settlements s
    join public.nations n on n.id = s.nation_id
  where
    n.world_id = new.world_id
  on conflict (settlement_id, resource_id) do nothing;

  return new;
end;
$$;

create trigger resources_seed_stockpiles
after insert on public.resources for each row
execute function public.seed_stockpiles_on_resource_insert ();

-- ---------------------------------------------------------------------------
-- Backfill: seed zero-quantity rows for all existing (settlement × active-
-- resource) pairs so worlds seeded before this migration are fully populated.
-- ---------------------------------------------------------------------------
insert into
  public.settlement_resource_stockpiles (settlement_id, resource_id, quantity)
select
  s.id,
  r.id,
  0
from
  public.settlements s
  join public.nations n on n.id = s.nation_id
  join public.resources r on r.world_id = n.world_id
where
  r.is_trashed = false
on conflict (settlement_id, resource_id) do nothing;
