-- Migration: diplomacy_consequences_trade
-- Fixes #1088: stances (supabase/migrations/20260520000003) become
-- mechanical instead of purely declarative for trade.
--   - propose_trade_route: international pairs where either direction is
--     'hostile' or 'at_war' are rejected outright, same as a 'closed'
--     trade_policy (#1087).
--   - approve_trade_route_side: international pairs where either direction
--     is 'at_war' are rejected — covers a war declared after proposal but
--     before the recipient side approves.
--   - end-turn simulation (phaseTradeRoutes, TypeScript side): pauses any
--     active/paused international route with reason 'nations_at_war' while
--     either direction reads 'at_war'; normal resume checks pick the route
--     back up once neither direction is at_war.
-- hostile/at_war are bilaterally mirrored (20260812000000), so a single
-- direction is authoritative in principle, but both directions are checked
-- here defensively — cheap, and immune to any future change that makes the
-- mirror best-effort.
-- ---------------------------------------------------------------------------
-- 1. propose_trade_route: reject hostile/at_war international pairs. Body
-- copied from the latest redefinition (20260912000000) with the stance gate
-- inserted right after the trade_policy gate.
-- ---------------------------------------------------------------------------
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
  v_is_international             boolean;
  v_origin_trade_policy          text;
  v_destination_trade_policy     text;
  v_origin_nation_name           text;
  v_destination_nation_name      text;
  v_manages_origin              boolean;
  v_manages_destination         boolean;
  v_trade_route_id              uuid;
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

  if not public.nations_have_met (v_origin_nation_id, v_destination_nation_id) then
    raise exception 'Nations have not met.' using errcode = 'P0001';
  end if;

  -- Trade policy gate (#1087) and diplomacy gate (#1088): internal
  -- (same-nation) routes are always governed by settlement-level authority
  -- only, regardless of policy or stance.
  v_is_international := v_origin_nation_id <> v_destination_nation_id;

  if v_is_international then
    select trade_policy, name into v_origin_trade_policy, v_origin_nation_name
      from public.nations n where n.id = v_origin_nation_id;
    select trade_policy, name into v_destination_trade_policy, v_destination_nation_name
      from public.nations n where n.id = v_destination_nation_id;

    if v_origin_trade_policy = 'closed' then
      raise exception '% has closed its borders to trade', v_origin_nation_name
        using errcode = 'P0001';
    end if;

    if v_destination_trade_policy = 'closed' then
      raise exception '% has closed its borders to trade', v_destination_nation_name
        using errcode = 'P0001';
    end if;

    -- Diplomacy gate (#1088): hostile or at_war in either direction blocks a
    -- new proposal outright.
    if exists (
      select 1
        from public.nation_relationships nr
       where (
               (nr.from_nation_id = v_origin_nation_id and nr.to_nation_id = v_destination_nation_id)
            or (nr.from_nation_id = v_destination_nation_id and nr.to_nation_id = v_origin_nation_id)
             )
         and nr.current_stance in ('hostile', 'at_war')
    ) then
      raise exception '% and % cannot trade while their nations are hostile or at war',
        v_origin_nation_name, v_destination_nation_name
        using errcode = 'P0001';
    end if;
  end if;

  -- Authority is role-based per endpoint settlement (super admin / world
  -- admin / nation manager / settlement manager) unless the side's nation is
  -- state_controlled on an international route, in which case only
  -- manage-NATION authority (not settlement) counts for that side.
  if v_is_international and v_origin_trade_policy = 'state_controlled' then
    v_manages_origin := public.current_user_manages_nation (v_origin_nation_id);
  else
    v_manages_origin := public.current_user_manages_settlement (v_origin_settlement_id);
  end if;

  if v_is_international and v_destination_trade_policy = 'state_controlled' then
    v_manages_destination := public.current_user_manages_nation (v_destination_nation_id);
  else
    v_manages_destination := public.current_user_manages_settlement (v_destination_settlement_id);
  end if;

  if not (v_manages_origin or v_manages_destination) then
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

  -- Auto-approve every side the proposer manages; the counterpart (recipient)
  -- stays pending until its own manager approves.
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
    -- A proposer who manages both endpoints approves both sides at once, so the
    -- route has no separate recipient to wait on and goes active immediately.
    case when v_manages_origin and v_manages_destination then 'active' else 'proposed' end,
    p_proposed_by_citizen_id,
    case when v_manages_origin then 'approved' else 'pending' end,
    case when v_manages_origin then p_proposed_by_citizen_id else null end,
    case when v_manages_destination then 'approved' else 'pending' end,
    case when v_manages_destination then p_proposed_by_citizen_id else null end
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

-- ---------------------------------------------------------------------------
-- 2. approve_trade_route_side: reject a side approval if at_war has arisen
-- between the two nations since the route was proposed. Body copied from the
-- latest redefinition (20260912000000) with the diplomacy gate inserted
-- right after the trade_policy gate.
-- ---------------------------------------------------------------------------
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
  v_side_settlement_id          uuid;
  v_side_nation_id               uuid;
  v_side_trade_policy            text;
  v_is_international             boolean;
  v_origin_trade_policy          text;
  v_destination_trade_policy     text;
  v_origin_nation_name           text;
  v_destination_nation_name      text;
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
    v_side_settlement_id := v_origin_settlement_id;
    v_side_nation_id     := v_origin_nation_id;
  else
    v_side_settlement_id := v_destination_settlement_id;
    v_side_nation_id     := v_destination_nation_id;
  end if;

  -- Trade policy gate (#1087) and diplomacy gate (#1088): internal
  -- (same-nation) routes are always governed by settlement-level authority
  -- only, regardless of policy or stance.
  v_is_international := v_origin_nation_id <> v_destination_nation_id;

  if v_is_international then
    select trade_policy, name into v_origin_trade_policy, v_origin_nation_name
      from public.nations n where n.id = v_origin_nation_id;
    select trade_policy, name into v_destination_trade_policy, v_destination_nation_name
      from public.nations n where n.id = v_destination_nation_id;

    if v_origin_trade_policy = 'closed' then
      raise exception '% has closed its borders to trade', v_origin_nation_name
        using errcode = 'P0001';
    end if;

    if v_destination_trade_policy = 'closed' then
      raise exception '% has closed its borders to trade', v_destination_nation_name
        using errcode = 'P0001';
    end if;

    -- Diplomacy gate (#1088): reject the approval if the two nations went to
    -- war after this route was proposed (hostile does not retroactively
    -- block an already-proposed approval — only outright war does).
    if exists (
      select 1
        from public.nation_relationships nr
       where (
               (nr.from_nation_id = v_origin_nation_id and nr.to_nation_id = v_destination_nation_id)
            or (nr.from_nation_id = v_destination_nation_id and nr.to_nation_id = v_origin_nation_id)
             )
         and nr.current_stance = 'at_war'
    ) then
      raise exception '% and % are at war — this trade route cannot be approved',
        v_origin_nation_name, v_destination_nation_name
        using errcode = 'P0001';
    end if;

    v_side_trade_policy := case when p_side = 'origin' then v_origin_trade_policy else v_destination_trade_policy end;
  end if;

  -- Authority is role-based for the side's settlement (super admin / world
  -- admin / nation manager / settlement manager) unless the side's nation is
  -- state_controlled on an international route, in which case only
  -- manage-NATION authority (not settlement) counts. No citizen-residency
  -- check: the approver citizen id is recorded purely as an audit stamp.
  if v_is_international and v_side_trade_policy = 'state_controlled' then
    if not public.current_user_manages_nation (v_side_nation_id) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  else
    if not public.current_user_manages_settlement (v_side_settlement_id) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  if (p_side = 'origin'      and v_origin_approval_status      = 'approved')
  or (p_side = 'destination' and v_destination_approval_status = 'approved') then
    raise exception 'this side of the trade route is already approved'
      using errcode = 'P0001';
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
