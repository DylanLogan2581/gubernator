-- Migration: add_trade_routes
-- Creates public.trade_routes per schema §7 / spec §11.
-- Each row represents a standing trade-route agreement between two settlements
-- with bilateral Nation Manager approval, replacement chaining, and pause state.
-- Approvals are stored on the route record — no separate approval table.
--
-- Visibility mirrors the nation_relationships_select_visible pattern from
-- 20260522000001_extend_rls_permission_helpers.sql: a route is visible when
-- either endpoint settlement's nation is visible (privileged path) or the
-- nation is non-hidden and the caller has world access.
--
-- Direct UPDATE of approval columns and status is restricted via column-level
-- grants. Cards 20–23 will supply SECURITY DEFINER RPCs for the approval
-- lifecycle; this migration puts in the data model and guard rails.
-- ---------------------------------------------------------------------------
-- trade_routes
-- ---------------------------------------------------------------------------
create table public.trade_routes (
  id uuid primary key default gen_random_uuid(),
  origin_settlement_id uuid not null references public.settlements (id) on delete cascade,
  destination_settlement_id uuid not null references public.settlements (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete restrict,
  quantity_per_transition numeric(18, 4) not null,
  status text not null default 'proposed',
  proposed_by_citizen_id uuid not null references public.citizens (id) on delete restrict,
  origin_approval_status text not null default 'pending',
  destination_approval_status text not null default 'pending',
  origin_approved_by_citizen_id uuid references public.citizens (id) on delete set null,
  destination_approved_by_citizen_id uuid references public.citizens (id) on delete set null,
  replacement_for_trade_route_id uuid references public.trade_routes (id) on delete set null,
  pause_reason_last_transition text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trade_routes_distinct_settlements_check check (origin_settlement_id <> destination_settlement_id),
  constraint trade_routes_quantity_positive_check check (quantity_per_transition > 0),
  constraint trade_routes_status_check check (
    status in (
      'proposed',
      'active',
      'paused',
      'cancelled',
      'replaced'
    )
  ),
  constraint trade_routes_origin_approval_status_check check (
    origin_approval_status in ('pending', 'approved', 'rejected')
  ),
  constraint trade_routes_destination_approval_status_check check (
    destination_approval_status in ('pending', 'approved', 'rejected')
  )
);

create index trade_routes_origin_status_idx on public.trade_routes (origin_settlement_id, status);

create index trade_routes_destination_status_idx on public.trade_routes (destination_settlement_id, status);

create index trade_routes_replacement_idx on public.trade_routes (replacement_for_trade_route_id);

create trigger trade_routes_set_updated_at before
update on public.trade_routes for each row
execute function public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- Trigger: resource_id must belong to the same world as both settlements.
-- A citizen approver nation check is a separate trigger below. The world is
-- reachable via settlement → nation → world; we check all three in one pass.
-- ---------------------------------------------------------------------------
create or replace function public.check_trade_route_resource_same_world () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_origin_world_id      uuid;
  v_destination_world_id uuid;
  v_resource_world_id    uuid;
begin
  select n.world_id into v_origin_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = new.origin_settlement_id;

  select n.world_id into v_destination_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = new.destination_settlement_id;

  select r.world_id into v_resource_world_id
  from public.resources r
  where r.id = new.resource_id;

  if v_origin_world_id is distinct from v_resource_world_id then
    raise exception 'resource % belongs to world % but origin settlement belongs to world %',
      new.resource_id, v_resource_world_id, v_origin_world_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_destination_world_id is distinct from v_resource_world_id then
    raise exception 'resource % belongs to world % but destination settlement belongs to world %',
      new.resource_id, v_resource_world_id, v_destination_world_id
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.check_trade_route_resource_same_world ()
from
  public;

create trigger trade_routes_resource_same_world before insert
or
update of origin_settlement_id,
destination_settlement_id,
resource_id on public.trade_routes for each row
execute function public.check_trade_route_resource_same_world ();

-- ---------------------------------------------------------------------------
-- Trigger: approver citizens must belong to the matching settlement's nation.
-- "Belongs to" is resolved via citizen.settlement_id → settlement.nation_id.
-- A citizen with no settlement (settlement_id IS NULL) is always rejected as
-- an approver because no nation membership can be established.
-- ---------------------------------------------------------------------------
create or replace function public.check_trade_route_approver_nation () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_origin_nation_id      uuid;
  v_destination_nation_id uuid;
  v_citizen_nation_id     uuid;
begin
  select s.nation_id into v_origin_nation_id
  from public.settlements s
  where s.id = new.origin_settlement_id;

  select s.nation_id into v_destination_nation_id
  from public.settlements s
  where s.id = new.destination_settlement_id;

  if new.origin_approved_by_citizen_id is not null then
    select s.nation_id into v_citizen_nation_id
    from public.citizens c
    join public.settlements s on s.id = c.settlement_id
    where c.id = new.origin_approved_by_citizen_id;

    if v_origin_nation_id is distinct from v_citizen_nation_id then
      raise exception 'origin approver citizen % does not belong to the origin settlement nation %',
        new.origin_approved_by_citizen_id, v_origin_nation_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  if new.destination_approved_by_citizen_id is not null then
    select s.nation_id into v_citizen_nation_id
    from public.citizens c
    join public.settlements s on s.id = c.settlement_id
    where c.id = new.destination_approved_by_citizen_id;

    if v_destination_nation_id is distinct from v_citizen_nation_id then
      raise exception 'destination approver citizen % does not belong to the destination settlement nation %',
        new.destination_approved_by_citizen_id, v_destination_nation_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.check_trade_route_approver_nation ()
from
  public;

create trigger trade_routes_approver_nation before insert
or
update of origin_approved_by_citizen_id,
destination_approved_by_citizen_id,
origin_settlement_id,
destination_settlement_id on public.trade_routes for each row
execute function public.check_trade_route_approver_nation ();

alter table public.trade_routes enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- SELECT: a route is visible when either endpoint settlement's nation is visible
-- to the caller. Mirrors the nation_relationships_select_visible pattern:
--   • privileged path: nation_visible_to_current_user (super admin, world admin,
--     or user with a living PC whose settlement belongs to the nation)
--   • non-hidden + world-access path: the nation is not hidden and the caller
--     has general world access (owner, public world, explicit world_admin, or PC)
create policy "trade_routes_select_visible" on public.trade_routes for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = trade_routes.origin_settlement_id
        and (
          public.nation_visible_to_current_user (n.id)
          or (
            n.is_hidden = false
            and public.current_user_has_world_access (n.world_id)
          )
        )
    )
    or exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = trade_routes.destination_settlement_id
        and (
          public.nation_visible_to_current_user (n.id)
          or (
            n.is_hidden = false
            and public.current_user_has_world_access (n.world_id)
          )
        )
    )
  );

-- INSERT (propose): super admin, world admin of either endpoint's world, or any
-- Nation Manager with authority over either endpoint settlement's nation. The
-- current_user_manages_nation helper includes super admin and world admin, so
-- the exists subqueries cover all cases with a single helper call per side.
create policy "trade_routes_insert_admin_or_manager" on public.trade_routes for insert to authenticated
with
  check (
    exists (
      select
        1
      from
        public.settlements s
      where
        s.id = trade_routes.origin_settlement_id
        and public.current_user_manages_nation (s.nation_id)
    )
    or exists (
      select
        1
      from
        public.settlements s
      where
        s.id = trade_routes.destination_settlement_id
        and public.current_user_manages_nation (s.nation_id)
    )
  );

-- UPDATE: super admin, world admin, or Nation Manager on either side. Column-
-- level grants (below) prevent direct writes to approval columns and status,
-- so managers reaching this policy can only touch quantity_per_transition and
-- pause_reason_last_transition. The approval lifecycle is handled by Cards 20–23
-- SECURITY DEFINER RPCs.
create policy "trade_routes_update_admin_or_manager" on public.trade_routes
for update
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
      where
        s.id = trade_routes.origin_settlement_id
        and public.current_user_manages_nation (s.nation_id)
    )
    or exists (
      select
        1
      from
        public.settlements s
      where
        s.id = trade_routes.destination_settlement_id
        and public.current_user_manages_nation (s.nation_id)
    )
  )
with
  check (
    exists (
      select
        1
      from
        public.settlements s
      where
        s.id = trade_routes.origin_settlement_id
        and public.current_user_manages_nation (s.nation_id)
    )
    or exists (
      select
        1
      from
        public.settlements s
      where
        s.id = trade_routes.destination_settlement_id
        and public.current_user_manages_nation (s.nation_id)
    )
  );

-- DELETE: world admin or super admin only. Managers cannot delete routes;
-- the status lifecycle (cancelled, replaced) is used for soft removal.
create policy "trade_routes_delete_world_admin" on public.trade_routes for delete to authenticated using (
  public.is_super_admin ()
  or exists (
    select
      1
    from
      public.settlements s
      join public.nations n on n.id = s.nation_id
    where
      s.id in (
        trade_routes.origin_settlement_id,
        trade_routes.destination_settlement_id
      )
      and public.is_world_admin (n.world_id)
  )
);

-- ---------------------------------------------------------------------------
-- Column-level grants: narrow direct INSERT/UPDATE to explicit user-editable
-- columns. Approval columns (origin_approval_status, destination_approval_status,
-- origin_approved_by_citizen_id, destination_approved_by_citizen_id) and status
-- are NOT granted for direct writes — all approval-lifecycle mutations go through
-- the SECURITY DEFINER RPCs in Cards 20–23.
-- ---------------------------------------------------------------------------
revoke insert,
update on public.trade_routes
from
  authenticated;

grant insert (
  id,
  origin_settlement_id,
  destination_settlement_id,
  resource_id,
  quantity_per_transition,
  proposed_by_citizen_id,
  replacement_for_trade_route_id
) on public.trade_routes to authenticated;

grant
update (
  quantity_per_transition,
  pause_reason_last_transition
) on public.trade_routes to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: add FK constraint to notifications.trade_route_id. The column was
-- added as a placeholder in 20260502000005_add_notifications.sql; trade_routes
-- now exists so the FK can be enforced. Existing NULL values are unaffected.
-- ---------------------------------------------------------------------------
alter table public.notifications
add constraint notifications_trade_route_fkey foreign key (trade_route_id) references public.trade_routes (id) on delete set null;

comment on column public.notifications.trade_route_id is 'Nullable FK to trade_routes; references the route that triggered this notification.';
