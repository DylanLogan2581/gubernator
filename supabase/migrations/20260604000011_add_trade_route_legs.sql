-- Migration: add_trade_route_legs
-- Extends the trade route model to support multiple send/receive resource legs
-- per route, enabling barter (multi-resource, bi-directional trades).
--
-- Schema changes:
--   1. Create trade_route_legs table (trade_route_id, direction, resource_id, qty)
--   2. Backfill existing single-resource routes as a 'send' leg
--   3. Drop resource_id, quantity_per_transition columns from trade_routes
--   4. Drop the trade_routes_resource_same_world trigger (resource no longer on routes)
-- ---------------------------------------------------------------------------
-- trade_route_legs
-- ---------------------------------------------------------------------------
create table public.trade_route_legs (
  id uuid primary key default gen_random_uuid(),
  trade_route_id uuid not null references public.trade_routes (id) on delete cascade,
  direction text not null,
  resource_id uuid not null references public.resources (id) on delete restrict,
  quantity_per_transition numeric(18, 4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trade_route_legs_direction_check check (direction in ('send', 'receive')),
  constraint trade_route_legs_quantity_positive_check check (quantity_per_transition > 0),
  constraint trade_route_legs_unique_resource unique (trade_route_id, direction, resource_id)
);

create index trade_route_legs_trade_route_id_idx on public.trade_route_legs (trade_route_id);

create trigger trade_route_legs_set_updated_at before
update on public.trade_route_legs for each row
execute function public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- Trigger: each leg's resource must belong to the same world as the route's
-- origin settlement.
-- ---------------------------------------------------------------------------
create or replace function public.check_trade_route_leg_resource_same_world () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_route_world_id   uuid;
  v_resource_world_id uuid;
begin
  select n.world_id into v_route_world_id
  from public.trade_routes tr
  join public.settlements s on s.id = tr.origin_settlement_id
  join public.nations n on n.id = s.nation_id
  where tr.id = new.trade_route_id;

  select r.world_id into v_resource_world_id
  from public.resources r
  where r.id = new.resource_id;

  if v_route_world_id is distinct from v_resource_world_id then
    raise exception 'resource % belongs to a different world than the trade route',
      new.resource_id
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.check_trade_route_leg_resource_same_world ()
from
  public;

create trigger trade_route_legs_resource_same_world before insert
or
update of trade_route_id,
resource_id on public.trade_route_legs for each row
execute function public.check_trade_route_leg_resource_same_world ();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.trade_route_legs enable row level security;

-- SELECT: visible when the parent trade route is visible.
-- Mirrors the trade_routes SELECT policy pattern (nation visibility check).
create policy trade_route_legs_select_visible on public.trade_route_legs for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.trade_routes tr
        join public.settlements os on os.id = tr.origin_settlement_id
        join public.nations on2 on on2.id = os.nation_id
      where
        tr.id = trade_route_legs.trade_route_id
        and (
          public.nation_visible_to_current_user (on2.id)
          or (
            on2.is_hidden = false
            and public.current_user_has_world_access (on2.world_id)
          )
        )
    )
    or exists (
      select
        1
      from
        public.trade_routes tr
        join public.settlements ds on ds.id = tr.destination_settlement_id
        join public.nations dn on dn.id = ds.nation_id
      where
        tr.id = trade_route_legs.trade_route_id
        and (
          public.nation_visible_to_current_user (dn.id)
          or (
            dn.is_hidden = false
            and public.current_user_has_world_access (dn.world_id)
          )
        )
    )
  );

grant
select
  on public.trade_route_legs to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: convert existing single-resource trade routes into send legs.
-- ---------------------------------------------------------------------------
insert into
  public.trade_route_legs (
    trade_route_id,
    direction,
    resource_id,
    quantity_per_transition
  )
select
  id,
  'send',
  resource_id,
  quantity_per_transition
from
  public.trade_routes
where
  resource_id is not null
  and quantity_per_transition is not null;

-- ---------------------------------------------------------------------------
-- Drop the resource-same-world trigger from trade_routes (resource_id is
-- being removed from that table). The equivalent check now lives on the
-- legs table above.
-- ---------------------------------------------------------------------------
drop trigger if exists trade_routes_resource_same_world on public.trade_routes;

drop function if exists public.check_trade_route_resource_same_world ();

-- ---------------------------------------------------------------------------
-- Drop resource_id and quantity_per_transition from trade_routes.
-- Also drop the quantity > 0 constraint that referenced the removed column.
-- ---------------------------------------------------------------------------
alter table public.trade_routes
drop constraint if exists trade_routes_quantity_positive_check,
drop column resource_id,
drop column quantity_per_transition;
