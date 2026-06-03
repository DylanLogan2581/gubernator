-- Migration: cancel_trade_route_rpc
-- SECURITY DEFINER RPC that allows a Nation Manager from either endpoint or an
-- admin to cancel an active, paused, or proposed trade route. Cancellation is
-- a hard stop; replacement chaining is handled separately (Card 23).
--
-- Error contract:
--   P0002 (no_data_found)          – null param, route not found
--   42501 (insufficient_privilege) – caller does not manage either nation
--   P0001 (raise_exception)        – route already cancelled or replaced
--
-- Side effects:
--   • Sets trade_routes.status = 'cancelled'.
--   • Deletes all citizen_assignments rows for the route (cascade-unassign).
--   • Fires 'trade_route_cancelled' notifications for managers on both endpoint
--     sides. If a side has no active managers the world admins receive it instead.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_trade_route (p_route_id uuid) returns table (
  id uuid,
  origin_settlement_id uuid,
  destination_settlement_id uuid,
  status text
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_origin_settlement_id        uuid;
  v_destination_settlement_id   uuid;
  v_origin_nation_id            uuid;
  v_destination_nation_id       uuid;
  v_world_id                    uuid;
  v_route_status                text;
  v_origin_manager_count        integer;
  v_destination_manager_count   integer;
begin
  -- Null guard
  if p_route_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Load route data along with settlements and nations
  select
    tr.origin_settlement_id,
    tr.destination_settlement_id,
    tr.status,
    s_orig.nation_id,
    s_dest.nation_id,
    n_orig.world_id
  into
    v_origin_settlement_id,
    v_destination_settlement_id,
    v_route_status,
    v_origin_nation_id,
    v_destination_nation_id,
    v_world_id
  from public.trade_routes tr
  join public.settlements s_orig on s_orig.id = tr.origin_settlement_id
  join public.settlements s_dest on s_dest.id = tr.destination_settlement_id
  join public.nations     n_orig on n_orig.id  = s_orig.nation_id
  where tr.id = p_route_id;

  if v_origin_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Route must not be in a terminal state
  if v_route_status in ('cancelled', 'replaced') then
    raise exception 'trade route cannot be cancelled in its current status'
      using errcode = 'P0001';
  end if;

  -- Authorization: caller must manage at least one of the two endpoint nations.
  -- current_user_manages_nation already covers super admin and world admin.
  if not (
    public.current_user_manages_nation (v_origin_nation_id)
    or public.current_user_manages_nation (v_destination_nation_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Cancel the route
  update public.trade_routes
     set status = 'cancelled'
   where public.trade_routes.id = p_route_id;

  -- Cascade-unassign: remove all citizen assignments for this route
  delete from public.citizen_assignments ca
   where ca.trade_route_id = p_route_id;

  -- Notify managers on both sides
  select count(*)
    into v_origin_manager_count
    from public.citizens c
   where c.status = 'alive'
     and c.citizen_type = 'player_character'
     and c.user_id is not null
     and (
         (c.role_type = 'nation_manager'     and c.role_nation_id     = v_origin_nation_id)
      or (c.role_type = 'settlement_manager' and c.role_settlement_id = v_origin_settlement_id)
     );

  select count(*)
    into v_destination_manager_count
    from public.citizens c
   where c.status = 'alive'
     and c.citizen_type = 'player_character'
     and c.user_id is not null
     and (
         (c.role_type = 'nation_manager'     and c.role_nation_id     = v_destination_nation_id)
      or (c.role_type = 'settlement_manager' and c.role_settlement_id = v_destination_settlement_id)
     );

  with
    origin_managers as (
      select c.user_id
        from public.citizens c
       where v_origin_manager_count > 0
         and c.status = 'alive'
         and c.citizen_type = 'player_character'
         and c.user_id is not null
         and (
             (c.role_type = 'nation_manager'     and c.role_nation_id     = v_origin_nation_id)
          or (c.role_type = 'settlement_manager' and c.role_settlement_id = v_origin_settlement_id)
         )
    ),
    destination_managers as (
      select c.user_id
        from public.citizens c
       where v_destination_manager_count > 0
         and c.status = 'alive'
         and c.citizen_type = 'player_character'
         and c.user_id is not null
         and (
             (c.role_type = 'nation_manager'     and c.role_nation_id     = v_destination_nation_id)
          or (c.role_type = 'settlement_manager' and c.role_settlement_id = v_destination_settlement_id)
         )
    ),
    world_admin_users as (
      select w.owner_id as user_id
        from public.worlds w
        join public.users u on u.id = w.owner_id
       where w.id = v_world_id
         and u.status = 'active'
      union
      select wa.user_id
        from public.world_admins wa
        join public.users u on u.id = wa.user_id
       where wa.world_id = v_world_id
         and u.status = 'active'
    ),
    all_recipients as (
      select user_id from origin_managers
      union
      select user_id from destination_managers
      union
      select user_id from world_admin_users where v_origin_manager_count = 0
      union
      select user_id from world_admin_users where v_destination_manager_count = 0
    )
  insert into public.notifications (
    recipient_user_id,
    world_id,
    trade_route_id,
    notification_type,
    message_text
  )
  select
    ar.user_id,
    v_world_id,
    p_route_id,
    'trade_route_cancelled',
    'A trade route has been cancelled.'
  from all_recipients ar;

  id                        := p_route_id;
  origin_settlement_id      := v_origin_settlement_id;
  destination_settlement_id := v_destination_settlement_id;
  status                    := 'cancelled';
  return next;
end;
$$;

revoke all on function public.cancel_trade_route (uuid)
from
  public;

grant
execute on function public.cancel_trade_route (uuid) to authenticated;
