-- Migration: replace_trade_route_multi_leg
-- Rewrites replace_trade_route to accept p_new_payload with a legs array instead
-- of resource_id / quantity_per_transition.
--
-- New p_new_payload shape:
--   {
--     "origin_settlement_id":      uuid,
--     "destination_settlement_id": uuid,
--     "legs": [{direction, resource_id, quantity}]
--   }
-- ---------------------------------------------------------------------------
-- Drop old function signature
drop function if exists public.replace_trade_route (uuid, jsonb, uuid);

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
  v_old_status                  text;
  v_old_origin_nation_id        uuid;
  v_old_destination_nation_id   uuid;
  v_old_world_id                uuid;
  v_new_origin_settlement_id    uuid;
  v_new_destination_settlement_id uuid;
  v_new_origin_nation_id        uuid;
  v_new_destination_nation_id   uuid;
  v_citizen_nation_id           uuid;
  v_new_trade_route_id          uuid;
  v_is_admin                    boolean;
  v_origin_manager_count        integer;
  v_destination_manager_count   integer;
  v_legs                        jsonb;
  v_leg                         jsonb;
  v_leg_direction               text;
  v_leg_resource_id             uuid;
  v_leg_quantity                numeric;
  v_resource_world_id           uuid;
  v_resource_is_trashed         boolean;
  v_leg_count                   integer;
begin
  if p_old_id is null or p_new_payload is null or p_proposing_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Load old route
  select tr.status,
         os.nation_id,
         ds.nation_id,
         on2.world_id
    into v_old_status,
         v_old_origin_nation_id,
         v_old_destination_nation_id,
         v_old_world_id
    from public.trade_routes tr
    join public.settlements os on os.id = tr.origin_settlement_id
    join public.nations on2 on on2.id = os.nation_id
    join public.settlements ds on ds.id = tr.destination_settlement_id
   where tr.id = p_old_id;

  if v_old_status is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_old_status in ('cancelled', 'replaced') then
    raise exception 'trade route cannot be replaced in its current status'
      using errcode = 'P0001';
  end if;

  -- Auth: manager of either endpoint of the OLD route
  if not (
    public.current_user_manages_nation (v_old_origin_nation_id)
    or public.current_user_manages_nation (v_old_destination_nation_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Parse new payload
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

  -- Legs must be a non-empty array
  v_leg_count := jsonb_array_length(v_legs);
  if v_leg_count is null or v_leg_count = 0 then
    raise exception 'trade route must have at least one leg'
      using errcode = 'P0001';
  end if;

  -- Resolve new origin settlement → nation (must be same world as old route)
  select s.nation_id
    into v_new_origin_nation_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = v_new_origin_settlement_id
     and n.world_id = v_old_world_id;

  if v_new_origin_nation_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve new destination settlement → nation
  select s.nation_id
    into v_new_destination_nation_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = v_new_destination_settlement_id
     and n.world_id = v_old_world_id;

  if v_new_destination_nation_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Validate each leg
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

  -- Resolve proposing citizen's nation
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

  -- Mark old route as replaced
  update public.trade_routes
     set status = 'replaced',
         updated_at = now()
   where id = p_old_id;

  -- Insert new trade route
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

  -- Insert legs for new route
  insert into public.trade_route_legs (trade_route_id, direction, resource_id, quantity_per_transition)
  select
    v_new_trade_route_id,
    (elem->>'direction'),
    (elem->>'resource_id')::uuid,
    (elem->>'quantity')::numeric
  from jsonb_array_elements(v_legs) as elem;

  -- Notifications
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
      select w.owner_id as user_id
        from public.worlds w
        join public.users u on u.id = w.owner_id
       where w.id = v_old_world_id
         and u.status = 'active'
      union
      select wa.user_id
        from public.world_admins wa
        join public.users u on u.id = wa.user_id
       where wa.world_id = v_old_world_id
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
