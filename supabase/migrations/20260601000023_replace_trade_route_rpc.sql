-- Migration: replace_trade_route_rpc
-- SECURITY DEFINER RPC that marks an existing trade route as 'replaced' and
-- inserts a fresh 'proposed' route chained to it via replacement_for_trade_route_id.
-- Authorised callers: manager of either endpoint nation of the OLD route, or admin
-- (super admin / world admin).
--
-- p_new_payload jsonb keys (snake_case):
--   origin_settlement_id      uuid
--   destination_settlement_id uuid
--   resource_id               uuid
--   quantity_per_transition   numeric
--
-- Error contract:
--   P0002 (no_data_found)          – null param, old route not found
--   42501 (insufficient_privilege) – caller lacks authority over old route's nations
--   P0001 (raise_exception)        – old route already cancelled/replaced,
--                                    self-loop, cross-world resource, trashed resource,
--                                    quantity <= 0, proposing citizen not in endpoint nation
--
-- Side effects:
--   • Sets old trade_routes.status = 'replaced'.
--   • Inserts new trade route with status = 'proposed', both approval_status = 'pending',
--     replacement_for_trade_route_id = p_old_id.
--   • Fires 'trade_proposal_received' notifications for managers on both endpoint sides
--     of the NEW route (falls back to world admins when a side has no active managers).
-- ---------------------------------------------------------------------------
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
  -- old route context
  v_old_origin_settlement_id      uuid;
  v_old_destination_settlement_id uuid;
  v_old_origin_nation_id          uuid;
  v_old_destination_nation_id     uuid;
  v_old_world_id                  uuid;
  v_old_status                    text;

  -- new route payload
  v_new_origin_settlement_id      uuid;
  v_new_destination_settlement_id uuid;
  v_new_resource_id               uuid;
  v_new_quantity                  numeric;

  -- new route resolution
  v_new_origin_nation_id          uuid;
  v_new_destination_nation_id     uuid;
  v_new_world_id                  uuid;
  v_resource_world_id             uuid;
  v_resource_is_trashed           boolean;
  v_citizen_nation_id             uuid;
  v_is_admin                      boolean;
  v_new_trade_route_id            uuid;
  v_origin_manager_count          integer;
  v_destination_manager_count     integer;
begin
  -- Null guard
  if p_old_id is null or p_new_payload is null or p_proposing_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Extract new payload fields
  v_new_origin_settlement_id      := (p_new_payload->>'origin_settlement_id')::uuid;
  v_new_destination_settlement_id := (p_new_payload->>'destination_settlement_id')::uuid;
  v_new_resource_id               := (p_new_payload->>'resource_id')::uuid;
  v_new_quantity                  := (p_new_payload->>'quantity_per_transition')::numeric;

  if v_new_origin_settlement_id is null
     or v_new_destination_settlement_id is null
     or v_new_resource_id is null
     or v_new_quantity is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Load old route
  select
    tr.origin_settlement_id,
    tr.destination_settlement_id,
    tr.status,
    s_orig.nation_id,
    s_dest.nation_id,
    n_orig.world_id
  into
    v_old_origin_settlement_id,
    v_old_destination_settlement_id,
    v_old_status,
    v_old_origin_nation_id,
    v_old_destination_nation_id,
    v_old_world_id
  from public.trade_routes tr
  join public.settlements s_orig on s_orig.id = tr.origin_settlement_id
  join public.settlements s_dest on s_dest.id = tr.destination_settlement_id
  join public.nations     n_orig on n_orig.id  = s_orig.nation_id
  where tr.id = p_old_id;

  if v_old_origin_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Old route must be in a replaceable state
  if v_old_status in ('cancelled', 'replaced') then
    raise exception 'trade route cannot be replaced in its current status'
      using errcode = 'P0001';
  end if;

  -- Authorization: caller must manage at least one of the old route's endpoint nations
  if not (
    public.current_user_manages_nation (v_old_origin_nation_id)
    or public.current_user_manages_nation (v_old_destination_nation_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Validate new payload — same checks as propose_trade_route

  -- Self-loop check
  if v_new_origin_settlement_id = v_new_destination_settlement_id then
    raise exception 'origin and destination settlements must be different'
      using errcode = 'P0001';
  end if;

  -- Quantity check
  if v_new_quantity <= 0 then
    raise exception 'quantity per transition must be greater than zero'
      using errcode = 'P0001';
  end if;

  -- Resolve new origin settlement → nation → world
  select s.nation_id, n.world_id
    into v_new_origin_nation_id, v_new_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = v_new_origin_settlement_id;

  if v_new_origin_nation_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve new destination settlement → nation (must be same world)
  select s.nation_id
    into v_new_destination_nation_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = v_new_destination_settlement_id
     and n.world_id = v_new_world_id;

  if v_new_destination_nation_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve resource world + trash status
  select r.world_id, r.is_trashed
    into v_resource_world_id, v_resource_is_trashed
    from public.resources r
   where r.id = v_new_resource_id;

  if v_resource_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Cross-world resource check
  if v_resource_world_id <> v_new_world_id then
    raise exception 'resource does not belong to the same world as the trade route endpoints'
      using errcode = 'P0001';
  end if;

  -- Soft-deleted resource check
  if v_resource_is_trashed then
    raise exception 'resource is trashed' using errcode = 'P0001';
  end if;

  -- Proposing citizen nation check (admin can override)
  v_is_admin := public.is_super_admin () or public.is_world_admin (v_new_world_id);

  if not v_is_admin then
    select s.nation_id
      into v_citizen_nation_id
      from public.citizens c
      join public.settlements s on s.id = c.settlement_id
     where c.id = p_proposing_citizen_id
       and c.status = 'alive';

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
     set status = 'replaced'
   where public.trade_routes.id = p_old_id;

  -- Insert new route chained to old
  insert into public.trade_routes (
    origin_settlement_id,
    destination_settlement_id,
    resource_id,
    quantity_per_transition,
    status,
    proposed_by_citizen_id,
    origin_approval_status,
    destination_approval_status,
    replacement_for_trade_route_id
  )
  values (
    v_new_origin_settlement_id,
    v_new_destination_settlement_id,
    v_new_resource_id,
    v_new_quantity,
    'proposed',
    p_proposing_citizen_id,
    'pending',
    'pending',
    p_old_id
  )
  returning public.trade_routes.id into v_new_trade_route_id;

  -- Pre-compute manager counts for notification fallback logic
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

  -- Notify managers on both sides of the NEW route
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
       where w.id = v_new_world_id
         and u.status = 'active'
      union
      select wa.user_id
        from public.world_admins wa
        join public.users u on u.id = wa.user_id
       where wa.world_id = v_new_world_id
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
    v_new_world_id,
    v_new_trade_route_id,
    'trade_proposal_received',
    'A new trade route proposal has been received.'
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
