-- Migration: propose_trade_route_multi_leg
-- Rewrites propose_trade_route to accept an array of legs (send/receive) instead
-- of a single resource_id + quantity.
--
-- New RPC signature:
--   propose_trade_route(
--     p_origin               uuid,
--     p_destination          uuid,
--     p_legs                 jsonb,   -- [{direction, resource_id, quantity}]
--     p_proposed_by_citizen_id uuid
--   )
--
-- Legs must contain at least one entry. Each entry:
--   direction:   'send' or 'receive'
--   resource_id: uuid of resource in same world
--   quantity:    numeric > 0
--
-- Error contract: same as the old function.
-- ---------------------------------------------------------------------------
-- Drop old signature (uuid, uuid, uuid, numeric, uuid).
drop function if exists public.propose_trade_route (uuid, uuid, uuid, numeric, uuid);

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
  -- Null guard
  if p_origin is null
     or p_destination is null
     or p_legs is null
     or p_proposed_by_citizen_id is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  v_origin_settlement_id      := p_origin;
  v_destination_settlement_id := p_destination;

  -- Self-loop check
  if p_origin = p_destination then
    raise exception 'origin and destination settlements must be different'
      using errcode = 'P0001';
  end if;

  -- Legs must be a non-empty array
  v_leg_count := jsonb_array_length(p_legs);
  if v_leg_count is null or v_leg_count = 0 then
    raise exception 'trade route must have at least one leg'
      using errcode = 'P0001';
  end if;

  -- Resolve origin settlement → nation → world
  select s.nation_id, n.world_id
    into v_origin_nation_id, v_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = v_origin_settlement_id;

  if v_origin_nation_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve destination settlement → nation (must be in same world)
  select s.nation_id
    into v_destination_nation_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = v_destination_settlement_id
     and n.world_id = v_world_id;

  if v_destination_nation_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: manager of either endpoint nation (includes super admin and world admin)
  if not (
    public.current_user_manages_nation (v_origin_nation_id)
    or public.current_user_manages_nation (v_destination_nation_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Validate each leg
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

  -- Resolve proposing citizen's nation for auto-approve logic
  select s.nation_id
    into v_citizen_nation_id
    from public.citizens c
    join public.settlements s on s.id = c.settlement_id
   where c.id = p_proposed_by_citizen_id
     and c.status = 'alive';

  -- Non-admin checks
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

  -- Insert trade route, auto-approving the proposer's side
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

  -- Insert legs
  insert into public.trade_route_legs (trade_route_id, direction, resource_id, quantity_per_transition)
  select
    v_trade_route_id,
    (elem->>'direction'),
    (elem->>'resource_id')::uuid,
    (elem->>'quantity')::numeric
  from jsonb_array_elements(p_legs) as elem;

  -- Notifications
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
