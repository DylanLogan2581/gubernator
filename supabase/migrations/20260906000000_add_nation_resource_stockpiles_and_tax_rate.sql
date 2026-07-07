-- Migration: add_nation_resource_stockpiles_and_tax_rate
-- Adds the national treasury v1 (#1082): a per-nation resource stockpile
-- table mirroring public.settlement_resource_stockpiles, plus a
-- nations.tax_rate column and an RPC to set it. No collection/taxation
-- logic is added here — that is the national economy phase issue; this is
-- schema only.
--
-- Deliberately not a "gold" resource — commodities only until the currency
-- issues land.
--
-- Write access to nation_resource_stockpiles is intentionally NOT exposed to
-- authenticated at all (no grants, no RLS write policies): unlike settlement
-- stockpiles (which allow direct world-admin writes), nation stockpiles are
-- only ever written by the seed triggers below (SECURITY DEFINER, bypass
-- RLS/grants as the function owner) and, later, by the simulation service
-- role / RPC ladder from the economy phase issue.
-- ---------------------------------------------------------------------------
-- nation_resource_stockpiles
-- ---------------------------------------------------------------------------
create table public.nation_resource_stockpiles (
  id uuid primary key default gen_random_uuid(),
  nation_id uuid not null references public.nations (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  quantity numeric(18, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nation_resource_stockpiles_nation_resource_unique unique (nation_id, resource_id),
  constraint nation_resource_stockpiles_quantity_non_negative check (quantity >= 0)
);

create index nation_resource_stockpiles_nation_id_idx on public.nation_resource_stockpiles (nation_id);

create index nation_resource_stockpiles_resource_id_idx on public.nation_resource_stockpiles (resource_id);

create trigger nation_resource_stockpiles_set_updated_at before
update on public.nation_resource_stockpiles for each row
execute function public.set_updated_at ();

alter table public.nation_resource_stockpiles enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- SELECT: any user with world access may read nation stockpiles, matching
-- settlement stockpile visibility (v1: world members, not nation-scoped).
create policy "nation_resource_stockpiles_select_world_access" on public.nation_resource_stockpiles for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.nations n
      where
        n.id = nation_resource_stockpiles.nation_id
        and public.current_user_has_world_access (n.world_id)
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated: rows are written only
-- by the seed triggers below (SECURITY DEFINER) and, later, by the
-- simulation service role / RPC ladder from the economy phase issue.
-- ---------------------------------------------------------------------------
-- Seed trigger: nation INSERT → seed one row per active resource in world.
-- SECURITY DEFINER so the trigger bypasses RLS regardless of who creates the
-- nation.
-- ---------------------------------------------------------------------------
create or replace function public.seed_nation_stockpiles_on_nation_insert () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  insert into
    public.nation_resource_stockpiles (nation_id, resource_id, quantity)
  select
    new.id,
    r.id,
    0
  from
    public.resources r
  where
    r.world_id = new.world_id
    and r.is_trashed = false
  on conflict (nation_id, resource_id) do nothing;

  return new;
end;
$$;

create trigger nations_seed_stockpiles
after insert on public.nations for each row
execute function public.seed_nation_stockpiles_on_nation_insert ();

revoke
execute on function public.seed_nation_stockpiles_on_nation_insert ()
from
  public,
  anon;

-- ---------------------------------------------------------------------------
-- Seed trigger: resource INSERT → seed one row per existing nation in world.
-- SECURITY DEFINER for the same reason as above.
-- ---------------------------------------------------------------------------
create or replace function public.seed_nation_stockpiles_on_resource_insert () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if new.is_trashed then
    return new;
  end if;

  insert into
    public.nation_resource_stockpiles (nation_id, resource_id, quantity)
  select
    n.id,
    new.id,
    0
  from
    public.nations n
  where
    n.world_id = new.world_id
  on conflict (nation_id, resource_id) do nothing;

  return new;
end;
$$;

create trigger resources_seed_nation_stockpiles
after insert on public.resources for each row
execute function public.seed_nation_stockpiles_on_resource_insert ();

revoke
execute on function public.seed_nation_stockpiles_on_resource_insert ()
from
  public,
  anon;

-- ---------------------------------------------------------------------------
-- Backfill: seed zero-quantity rows for all existing (nation × active-
-- resource) pairs so worlds seeded before this migration are fully populated.
-- ---------------------------------------------------------------------------
insert into
  public.nation_resource_stockpiles (nation_id, resource_id, quantity)
select
  n.id,
  r.id,
  0
from
  public.nations n
  join public.resources r on r.world_id = n.world_id
where
  r.is_trashed = false
on conflict (nation_id, resource_id) do nothing;

-- ---------------------------------------------------------------------------
-- nations.tax_rate
-- ---------------------------------------------------------------------------
alter table public.nations
add column tax_rate numeric not null default 0 check (
  tax_rate >= 0
  and tax_rate <= 0.5
);

-- ---------------------------------------------------------------------------
-- RPC: set_nation_tax_rate
-- Mirrors set_nation_flag_path / set_nation_capital_and_founded_turn: gated
-- by current_user_manages_nation (super admin, world admin, or the nation's
-- own nation_manager citizen), rejects writes to archived worlds. Invalid
-- rates are rejected by the column CHECK constraint (23514).
-- ---------------------------------------------------------------------------
create or replace function public.set_nation_tax_rate (p_nation_id uuid, p_rate numeric) returns setof public.nations language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  if p_nation_id is null or p_rate is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select world_id into v_world_id
  from public.nations
  where id = p_nation_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.current_user_manages_nation (p_nation_id) then
    raise exception 'You do not have permission to manage this nation.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  return query
  update public.nations
  set tax_rate = p_rate
  where id = p_nation_id
  returning *;
end;
$$;

revoke all on function public.set_nation_tax_rate (uuid, numeric)
from
  public;

grant
execute on function public.set_nation_tax_rate (uuid, numeric) to authenticated;
