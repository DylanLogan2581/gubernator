-- Migration: reject_trade_route_side_rpc
-- SECURITY DEFINER RPC that allows a Nation Manager to reject one side of a
-- proposed (or paused) trade route.  A single rejection immediately cancels
-- the whole proposal and sends trade_proposal_rejected notifications to
-- managers on both endpoint sides.
--
-- Error contract:
--   P0002 (no_data_found)          – null params, route not found
--   42501 (insufficient_privilege) – caller does not manage the side's nation
--   P0001 (raise_exception)        – invalid side value, route not in
--                                    proposed/paused status, rejector citizen
--                                    not in side nation
--
-- Notifications: fires 'trade_proposal_rejected' in the same transaction for
-- all Nation Manager and Settlement Manager PCs on each endpoint side when the
-- route is cancelled.  If a side has no active managers the world admins
-- receive the notification for that side instead.
-- ---------------------------------------------------------------------------
-- Extend the notification_type allowlist to include the new type.
alter table public.notifications
drop constraint notifications_notification_type_check;

alter table public.notifications
add constraint notifications_notification_type_check check (
  notification_type in (
    'turn.completed',
    'trade_proposal_received',
    'trade_proposal_accepted',
    'trade_proposal_rejected'
  )
);

-- ---------------------------------------------------------------------------
create or replace function public.reject_trade_route_side (
  p_route_id uuid,
  p_side text,
  p_rejector_citizen_id uuid
) returns table (
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
  v_side_nation_id              uuid;
  v_rejector_nation_id          uuid;
  v_is_admin                    boolean;
  v_origin_manager_count        integer;
  v_destination_manager_count   integer;
begin
  -- Null guard
  if p_route_id is null or p_side is null or p_rejector_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Side validation
  if p_side not in ('origin', 'destination') then
    raise exception 'side must be ''origin'' or ''destination'''
      using errcode = 'P0001';
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

  -- Route must be in a state that allows rejection (pre-active only)
  if v_route_status not in ('proposed', 'paused') then
    raise exception 'trade route cannot be rejected in its current status'
      using errcode = 'P0001';
  end if;

  -- Resolve the nation for the requested side
  if p_side = 'origin' then
    v_side_nation_id := v_origin_nation_id;
  else
    v_side_nation_id := v_destination_nation_id;
  end if;

  -- Authorization: caller must manage the side's nation (includes super admin
  -- and world admin via current_user_manages_nation).
  if not public.current_user_manages_nation (v_side_nation_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Rejector citizen must belong to the side's nation (admin may override).
  v_is_admin := public.is_super_admin () or public.is_world_admin (v_world_id);

  if not v_is_admin then
    select s.nation_id
      into v_rejector_nation_id
      from public.citizens c
      join public.settlements s on s.id = c.settlement_id
     where c.id = p_rejector_citizen_id
       and c.status = 'alive';

    if v_rejector_nation_id is null then
      raise exception 'rejector citizen not found or has no settlement membership'
        using errcode = 'P0001';
    end if;

    if v_rejector_nation_id <> v_side_nation_id then
      raise exception 'rejector citizen does not belong to the side nation'
        using errcode = 'P0001';
    end if;
  end if;

  -- Record the rejection and cancel the route in one statement
  if p_side = 'origin' then
    update public.trade_routes
       set origin_approval_status        = 'rejected',
           origin_approved_by_citizen_id = p_rejector_citizen_id,
           status                        = 'cancelled'
     where public.trade_routes.id = p_route_id;
  else
    update public.trade_routes
       set destination_approval_status        = 'rejected',
           destination_approved_by_citizen_id = p_rejector_citizen_id,
           status                             = 'cancelled'
     where public.trade_routes.id = p_route_id;
  end if;

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
    'trade_proposal_rejected',
    'A trade route proposal has been rejected.'
  from all_recipients ar;

  id                        := p_route_id;
  origin_settlement_id      := v_origin_settlement_id;
  destination_settlement_id := v_destination_settlement_id;
  status                    := 'cancelled';
  return next;
end;
$$;

revoke all on function public.reject_trade_route_side (uuid, text, uuid)
from
  public;

grant
execute on function public.reject_trade_route_side (uuid, text, uuid) to authenticated;
