-- Migration: fix_super_admin_trade_notifications
-- Issue #581 / Finding M/Q23.
--
-- Super admins should receive trade-route notifications (trade_proposal_received,
-- trade_proposal_accepted, trade_proposal_rejected, trade_route_cancelled) for
-- every world, matching the global-oversight behaviour they have for
-- turn.completed notifications.
--
-- Fix: extend the world_admin_users CTE in every trade-route RPC to include
-- active super admins, and add an unconditional super-admin union to
-- all_recipients so they are notified even when both sides have active managers
-- (which would otherwise suppress the world_admin_users fallback branches).
--
-- Functions updated (current signature after 20260611000001):
--   propose_trade_route(uuid, uuid, jsonb, uuid)
--   approve_trade_route_side(uuid, text, uuid)
--   reject_trade_route_side(uuid, text, uuid)
--   cancel_trade_route(uuid)
--   replace_trade_route(uuid, jsonb, uuid)
-- ---------------------------------------------------------------------------
-- ############################################################
-- propose_trade_route
-- ############################################################
create or replace function public.propose_trade_route (
  p_origin uuid,
  p_destination uuid,
  p_legs jsonb,
  p_proposed_by_citizen_id uuid
) returns table (
  id uuid,
  origin_settlement_id uuid,
  destination_settlement_id uuid
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id                    uuid;
  v_origin_nation_id            uuid;
  v_destination_nation_id       uuid;
  v_origin_settlement_id        uuid;
  v_destination_settlement_id   uuid;
  v_citizen_nation_id           uuid;
  v_trade_route_id              uuid;
  v_is_admin                    boolean;
  v_origin_manager_count        integer;
  v_destination_manager_count   integer;
  v_leg                         jsonb;
  v_leg_direction               text;
  v_leg_resource_id             uuid;
  v_leg_quantity                numeric;
  v_resource_world_id           uuid;
  v_resource_is_trashed         boolean;
  v_leg_count                   integer;
begin
  if p_origin is null
     or p_destination is null
     or p_legs is null
     or p_proposed_by_citizen_id is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  v_origin_settlement_id      := p_origin;
  v_destination_settlement_id := p_destination;

  if p_origin = p_destination then
    raise exception 'origin and destination settlements must be different'
      using errcode = 'P0001';
  end if;

  v_leg_count := jsonb_array_length(p_legs);
  if v_leg_count is null or v_leg_count = 0 then
    raise exception 'trade route must have at least one leg'
      using errcode = 'P0001';
  end if;

  select s.nation_id, n.world_id
    into v_origin_nation_id, v_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = v_origin_settlement_id;

  if v_origin_nation_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select s.nation_id
    into v_destination_nation_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = v_destination_settlement_id
     and n.world_id = v_world_id;

  if v_destination_nation_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (
    public.current_user_manages_nation (v_origin_nation_id)
    or public.current_user_manages_nation (v_destination_nation_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for v_leg in select * from jsonb_array_elements(p_legs)
  loop
    v_leg_direction   := v_leg->>'direction';
    v_leg_resource_id := (v_leg->>'resource_id')::uuid;
    v_leg_quantity    := (v_leg->>'quantity')::numeric;

    if v_leg_direction is null or v_leg_direction not in ('send', 'receive') then
      raise exception 'each leg must have direction ''send'' or ''receive'''
        using errcode = 'P0001';
    end if;

    if v_leg_resource_id is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_leg_quantity is null or v_leg_quantity <= 0 then
      raise exception 'quantity per transition must be greater than zero'
        using errcode = 'P0001';
    end if;

    select r.world_id, r.is_trashed
      into v_resource_world_id, v_resource_is_trashed
      from public.resources r
     where r.id = v_leg_resource_id;

    if v_resource_world_id is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_resource_world_id <> v_world_id then
      raise exception 'resource does not belong to the same world as the trade route endpoints'
        using errcode = 'P0001';
    end if;

    if v_resource_is_trashed then
      raise exception 'resource is trashed' using errcode = 'P0001';
    end if;
  end loop;

  v_is_admin := public.is_super_admin () or public.is_world_admin (v_world_id);

  select s.nation_id
    into v_citizen_nation_id
    from public.citizens c
    join public.settlements s on s.id = c.settlement_id
   where c.id = p_proposed_by_citizen_id
     and c.status = 'alive';

  if not v_is_admin then
    if v_citizen_nation_id is null then
      raise exception 'proposing citizen not found or has no settlement membership'
        using errcode = 'P0001';
    end if;

    if v_citizen_nation_id not in (v_origin_nation_id, v_destination_nation_id) then
      raise exception 'proposing citizen must belong to an endpoint nation'
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.trade_routes (
    origin_settlement_id,
    destination_settlement_id,
    status,
    proposed_by_citizen_id,
    origin_approval_status,
    origin_approved_by_citizen_id,
    destination_approval_status,
    destination_approved_by_citizen_id
  )
  values (
    v_origin_settlement_id,
    v_destination_settlement_id,
    'proposed',
    p_proposed_by_citizen_id,
    case when v_citizen_nation_id = v_origin_nation_id then 'approved' else 'pending' end,
    case when v_citizen_nation_id = v_origin_nation_id then p_proposed_by_citizen_id else null end,
    case when v_citizen_nation_id = v_destination_nation_id then 'approved' else 'pending' end,
    case when v_citizen_nation_id = v_destination_nation_id then p_proposed_by_citizen_id else null end
  )
  returning public.trade_routes.id into v_trade_route_id;

  insert into public.trade_route_legs (trade_route_id, direction, resource_id, quantity_per_transition)
  select
    v_trade_route_id,
    (elem->>'direction'),
    (elem->>'resource_id')::uuid,
    (elem->>'quantity')::numeric
  from jsonb_array_elements(p_legs) as elem;

  select count(*)
    into v_origin_manager_count
    from public.citizens c
   where c.status = 'alive'
     and c.citizen_type = 'player_character'
     and c.user_id is not null
     and (
       (c.role_type = 'nation_manager' and c.role_nation_id = v_origin_nation_id)
       or (c.role_type = 'settlement_manager' and c.role_settlement_id = v_origin_settlement_id)
     );

  select count(*)
    into v_destination_manager_count
    from public.citizens c
   where c.status = 'alive'
     and c.citizen_type = 'player_character'
     and c.user_id is not null
     and (
       (c.role_type = 'nation_manager' and c.role_nation_id = v_destination_nation_id)
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
           (c.role_type = 'nation_manager' and c.role_nation_id = v_origin_nation_id)
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
           (c.role_type = 'nation_manager' and c.role_nation_id = v_destination_nation_id)
           or (c.role_type = 'settlement_manager' and c.role_settlement_id = v_destination_settlement_id)
         )
    ),
    world_admin_users as (
      select wa.user_id
        from public.world_admins wa
        join public.users u on u.id = wa.user_id
       where wa.world_id = v_world_id
         and u.status = 'active'
      union
      -- Super admins have global oversight authority over every world.
      select u.id
        from public.users u
       where u.is_super_admin = true
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
      union
      -- Super admins always receive trade notifications regardless of manager counts.
      select u.id from public.users u where u.is_super_admin = true and u.status = 'active'
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
    v_trade_route_id,
    'trade_proposal_received',
    'A new trade route proposal has been received.'
  from all_recipients ar;

  id                        := v_trade_route_id;
  origin_settlement_id      := v_origin_settlement_id;
  destination_settlement_id := v_destination_settlement_id;
  return next;
end;
$$;

revoke all on function public.propose_trade_route (uuid, uuid, jsonb, uuid)
from
  public;

grant
execute on function public.propose_trade_route (uuid, uuid, jsonb, uuid) to authenticated;

-- ############################################################
-- approve_trade_route_side
-- ############################################################
create or replace function public.approve_trade_route_side (
  p_route_id uuid,
  p_side text,
  p_approver_citizen_id uuid
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
  v_origin_approval_status      text;
  v_destination_approval_status text;
  v_side_nation_id              uuid;
  v_approver_nation_id          uuid;
  v_is_admin                    boolean;
  v_new_status                  text;
  v_origin_manager_count        integer;
  v_destination_manager_count   integer;
begin
  if p_route_id is null or p_side is null or p_approver_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_side not in ('origin', 'destination') then
    raise exception 'side must be ''origin'' or ''destination'''
      using errcode = 'P0001';
  end if;

  select
    tr.origin_settlement_id,
    tr.destination_settlement_id,
    tr.status,
    tr.origin_approval_status,
    tr.destination_approval_status,
    s_orig.nation_id,
    s_dest.nation_id,
    n_orig.world_id
  into
    v_origin_settlement_id,
    v_destination_settlement_id,
    v_route_status,
    v_origin_approval_status,
    v_destination_approval_status,
    v_origin_nation_id,
    v_destination_nation_id,
    v_world_id
  from public.trade_routes tr
  join public.settlements s_orig on s_orig.id = tr.origin_settlement_id
  join public.settlements s_dest on s_dest.id = tr.destination_settlement_id
  join public.nations     n_orig on n_orig.id  = s_orig.nation_id
  where tr.id = p_route_id
  for update of tr;

  if v_origin_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_route_status not in ('proposed', 'paused') then
    raise exception 'trade route cannot be approved in its current status'
      using errcode = 'P0001';
  end if;

  if p_side = 'origin' then
    v_side_nation_id := v_origin_nation_id;
  else
    v_side_nation_id := v_destination_nation_id;
  end if;

  if not public.current_user_manages_nation (v_side_nation_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if (p_side = 'origin'      and v_origin_approval_status      = 'approved')
  or (p_side = 'destination' and v_destination_approval_status = 'approved') then
    raise exception 'this side of the trade route is already approved'
      using errcode = 'P0001';
  end if;

  v_is_admin := public.is_super_admin () or public.is_world_admin (v_world_id);

  if not v_is_admin then
    select s.nation_id
      into v_approver_nation_id
      from public.citizens c
      join public.settlements s on s.id = c.settlement_id
     where c.id = p_approver_citizen_id
       and c.status = 'alive';

    if v_approver_nation_id is null then
      raise exception 'approver citizen not found or has no settlement membership'
        using errcode = 'P0001';
    end if;

    if v_approver_nation_id <> v_side_nation_id then
      raise exception 'approver citizen does not belong to the side nation'
        using errcode = 'P0001';
    end if;
  end if;

  if p_side = 'origin' then
    update public.trade_routes
       set origin_approval_status        = 'approved',
           origin_approved_by_citizen_id = p_approver_citizen_id
     where public.trade_routes.id = p_route_id;
  else
    update public.trade_routes
       set destination_approval_status        = 'approved',
           destination_approved_by_citizen_id = p_approver_citizen_id
     where public.trade_routes.id = p_route_id;
  end if;

  if (p_side = 'origin'      and v_destination_approval_status = 'approved')
  or (p_side = 'destination' and v_origin_approval_status      = 'approved') then

    update public.trade_routes
       set status = 'active'
     where public.trade_routes.id = p_route_id;

    v_new_status := 'active';

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
        select wa.user_id
          from public.world_admins wa
          join public.users u on u.id = wa.user_id
         where wa.world_id = v_world_id
           and u.status = 'active'
        union
        -- Super admins have global oversight authority over every world.
        select u.id
          from public.users u
         where u.is_super_admin = true
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
        union
        -- Super admins always receive trade notifications regardless of manager counts.
        select u.id from public.users u where u.is_super_admin = true and u.status = 'active'
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
      'trade_proposal_accepted',
      'A trade route proposal has been accepted.'
    from all_recipients ar;

  else
    v_new_status := v_route_status;
  end if;

  id                        := p_route_id;
  origin_settlement_id      := v_origin_settlement_id;
  destination_settlement_id := v_destination_settlement_id;
  status                    := v_new_status;
  return next;
end;
$$;

revoke all on function public.approve_trade_route_side (uuid, text, uuid)
from
  public;

grant
execute on function public.approve_trade_route_side (uuid, text, uuid) to authenticated;

-- ############################################################
-- reject_trade_route_side
-- ############################################################
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
  if p_route_id is null or p_side is null or p_rejector_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_side not in ('origin', 'destination') then
    raise exception 'side must be ''origin'' or ''destination'''
      using errcode = 'P0001';
  end if;

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
  where tr.id = p_route_id
  for update of tr;

  if v_origin_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_route_status not in ('proposed', 'paused') then
    raise exception 'trade route cannot be rejected in its current status'
      using errcode = 'P0001';
  end if;

  if p_side = 'origin' then
    v_side_nation_id := v_origin_nation_id;
  else
    v_side_nation_id := v_destination_nation_id;
  end if;

  if not public.current_user_manages_nation (v_side_nation_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

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
      select wa.user_id
        from public.world_admins wa
        join public.users u on u.id = wa.user_id
       where wa.world_id = v_world_id
         and u.status = 'active'
      union
      -- Super admins have global oversight authority over every world.
      select u.id
        from public.users u
       where u.is_super_admin = true
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
      union
      -- Super admins always receive trade notifications regardless of manager counts.
      select u.id from public.users u where u.is_super_admin = true and u.status = 'active'
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

-- ############################################################
-- cancel_trade_route
-- ############################################################
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
  if p_route_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

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
  where tr.id = p_route_id
  for update of tr;

  if v_origin_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_route_status in ('cancelled', 'replaced') then
    raise exception 'trade route cannot be cancelled in its current status'
      using errcode = 'P0001';
  end if;

  if not (
    public.current_user_manages_nation (v_origin_nation_id)
    or public.current_user_manages_nation (v_destination_nation_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.trade_routes
     set status = 'cancelled'
   where public.trade_routes.id = p_route_id;

  delete from public.citizen_assignments ca
   where ca.trade_route_id = p_route_id;

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
      select wa.user_id
        from public.world_admins wa
        join public.users u on u.id = wa.user_id
       where wa.world_id = v_world_id
         and u.status = 'active'
      union
      -- Super admins have global oversight authority over every world.
      select u.id
        from public.users u
       where u.is_super_admin = true
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
      union
      -- Super admins always receive trade notifications regardless of manager counts.
      select u.id from public.users u where u.is_super_admin = true and u.status = 'active'
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

-- ############################################################
-- replace_trade_route
-- ############################################################
create or replace function public.replace_trade_route (
  p_old_id uuid,
  p_new_payload jsonb,
  p_proposing_citizen_id uuid
) returns table (
  old_route_id uuid,
  new_route_id uuid,
  origin_settlement_id uuid,
  destination_settlement_id uuid
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_old_origin_nation_id          uuid;
  v_old_destination_nation_id     uuid;
  v_old_world_id                  uuid;
  v_new_origin_settlement_id      uuid;
  v_new_destination_settlement_id uuid;
  v_new_origin_nation_id          uuid;
  v_new_destination_nation_id     uuid;
  v_citizen_nation_id             uuid;
  v_new_trade_route_id            uuid;
  v_is_admin                      boolean;
  v_origin_manager_count          integer;
  v_destination_manager_count     integer;
  v_legs                          jsonb;
  v_leg                           jsonb;
  v_leg_direction                 text;
  v_leg_resource_id               uuid;
  v_leg_quantity                  numeric;
  v_resource_world_id             uuid;
  v_resource_is_trashed           boolean;
  v_leg_count                     integer;
  v_old_status_text               text;
begin
  if p_old_id is null or p_new_payload is null or p_proposing_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select tr.status,
         os.nation_id,
         ds.nation_id,
         on2.world_id
    into v_old_status_text,
         v_old_origin_nation_id,
         v_old_destination_nation_id,
         v_old_world_id
    from public.trade_routes tr
    join public.settlements os on os.id = tr.origin_settlement_id
    join public.nations on2 on on2.id = os.nation_id
    join public.settlements ds on ds.id = tr.destination_settlement_id
   where tr.id = p_old_id
   for update of tr;

  if v_old_status_text is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_old_status_text in ('cancelled', 'replaced') then
    raise exception 'trade route cannot be replaced in its current status'
      using errcode = 'P0001';
  end if;

  if not (
    public.current_user_manages_nation (v_old_origin_nation_id)
    or public.current_user_manages_nation (v_old_destination_nation_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_new_origin_settlement_id      := (p_new_payload->>'origin_settlement_id')::uuid;
  v_new_destination_settlement_id := (p_new_payload->>'destination_settlement_id')::uuid;
  v_legs                          := p_new_payload->'legs';

  if v_new_origin_settlement_id is null or v_new_destination_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_new_origin_settlement_id = v_new_destination_settlement_id then
    raise exception 'origin and destination settlements must be different'
      using errcode = 'P0001';
  end if;

  v_leg_count := jsonb_array_length(v_legs);
  if v_leg_count is null or v_leg_count = 0 then
    raise exception 'trade route must have at least one leg'
      using errcode = 'P0001';
  end if;

  select s.nation_id
    into v_new_origin_nation_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = v_new_origin_settlement_id
     and n.world_id = v_old_world_id;

  if v_new_origin_nation_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select s.nation_id
    into v_new_destination_nation_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = v_new_destination_settlement_id
     and n.world_id = v_old_world_id;

  if v_new_destination_nation_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  for v_leg in select * from jsonb_array_elements(v_legs)
  loop
    v_leg_direction   := v_leg->>'direction';
    v_leg_resource_id := (v_leg->>'resource_id')::uuid;
    v_leg_quantity    := (v_leg->>'quantity')::numeric;

    if v_leg_direction is null or v_leg_direction not in ('send', 'receive') then
      raise exception 'each leg must have direction ''send'' or ''receive'''
        using errcode = 'P0001';
    end if;

    if v_leg_resource_id is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_leg_quantity is null or v_leg_quantity <= 0 then
      raise exception 'quantity per transition must be greater than zero'
        using errcode = 'P0001';
    end if;

    select r.world_id, r.is_trashed
      into v_resource_world_id, v_resource_is_trashed
      from public.resources r
     where r.id = v_leg_resource_id;

    if v_resource_world_id is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_resource_world_id <> v_old_world_id then
      raise exception 'resource does not belong to the same world as the trade route endpoints'
        using errcode = 'P0001';
    end if;

    if v_resource_is_trashed then
      raise exception 'resource is trashed' using errcode = 'P0001';
    end if;
  end loop;

  v_is_admin := public.is_super_admin () or public.is_world_admin (v_old_world_id);

  select s.nation_id
    into v_citizen_nation_id
    from public.citizens c
    join public.settlements s on s.id = c.settlement_id
   where c.id = p_proposing_citizen_id
     and c.status = 'alive';

  if not v_is_admin then
    if v_citizen_nation_id is null then
      raise exception 'proposing citizen not found or has no settlement membership'
        using errcode = 'P0001';
    end if;

    if v_citizen_nation_id not in (v_new_origin_nation_id, v_new_destination_nation_id) then
      raise exception 'proposing citizen must belong to an endpoint nation'
        using errcode = 'P0001';
    end if;
  end if;

  update public.trade_routes
     set status = 'replaced',
         updated_at = now()
   where id = p_old_id;

  insert into public.trade_routes (
    origin_settlement_id,
    destination_settlement_id,
    status,
    proposed_by_citizen_id,
    origin_approval_status,
    origin_approved_by_citizen_id,
    destination_approval_status,
    destination_approved_by_citizen_id,
    replacement_for_trade_route_id
  )
  values (
    v_new_origin_settlement_id,
    v_new_destination_settlement_id,
    'proposed',
    p_proposing_citizen_id,
    case when v_citizen_nation_id = v_new_origin_nation_id then 'approved' else 'pending' end,
    case when v_citizen_nation_id = v_new_origin_nation_id then p_proposing_citizen_id else null end,
    case when v_citizen_nation_id = v_new_destination_nation_id then 'approved' else 'pending' end,
    case when v_citizen_nation_id = v_new_destination_nation_id then p_proposing_citizen_id else null end,
    p_old_id
  )
  returning public.trade_routes.id into v_new_trade_route_id;

  insert into public.trade_route_legs (trade_route_id, direction, resource_id, quantity_per_transition)
  select
    v_new_trade_route_id,
    (elem->>'direction'),
    (elem->>'resource_id')::uuid,
    (elem->>'quantity')::numeric
  from jsonb_array_elements(v_legs) as elem;

  select count(*)
    into v_origin_manager_count
    from public.citizens c
   where c.status = 'alive'
     and c.citizen_type = 'player_character'
     and c.user_id is not null
     and (
       (c.role_type = 'nation_manager' and c.role_nation_id = v_new_origin_nation_id)
       or (c.role_type = 'settlement_manager' and c.role_settlement_id = v_new_origin_settlement_id)
     );

  select count(*)
    into v_destination_manager_count
    from public.citizens c
   where c.status = 'alive'
     and c.citizen_type = 'player_character'
     and c.user_id is not null
     and (
       (c.role_type = 'nation_manager' and c.role_nation_id = v_new_destination_nation_id)
       or (c.role_type = 'settlement_manager' and c.role_settlement_id = v_new_destination_settlement_id)
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
           (c.role_type = 'nation_manager' and c.role_nation_id = v_new_origin_nation_id)
           or (c.role_type = 'settlement_manager' and c.role_settlement_id = v_new_origin_settlement_id)
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
           (c.role_type = 'nation_manager' and c.role_nation_id = v_new_destination_nation_id)
           or (c.role_type = 'settlement_manager' and c.role_settlement_id = v_new_destination_settlement_id)
         )
    ),
    world_admin_users as (
      select wa.user_id
        from public.world_admins wa
        join public.users u on u.id = wa.user_id
       where wa.world_id = v_old_world_id
         and u.status = 'active'
      union
      -- Super admins have global oversight authority over every world.
      select u.id
        from public.users u
       where u.is_super_admin = true
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
      union
      -- Super admins always receive trade notifications regardless of manager counts.
      select u.id from public.users u where u.is_super_admin = true and u.status = 'active'
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
    v_old_world_id,
    v_new_trade_route_id,
    'trade_proposal_received',
    'A trade route replacement proposal has been received.'
  from all_recipients ar;

  old_route_id              := p_old_id;
  new_route_id              := v_new_trade_route_id;
  origin_settlement_id      := v_new_origin_settlement_id;
  destination_settlement_id := v_new_destination_settlement_id;
  return next;
end;
$$;

revoke all on function public.replace_trade_route (uuid, jsonb, uuid)
from
  public;

grant
execute on function public.replace_trade_route (uuid, jsonb, uuid) to authenticated;
