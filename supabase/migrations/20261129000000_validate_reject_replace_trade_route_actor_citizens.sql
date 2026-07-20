-- Migration: validate_reject_replace_trade_route_actor_citizens
--
-- #1293: propose_trade_route and approve_trade_route_side already validate
-- (since #1145 / 20261023000000_validate_treaty_trade_decree_actor_citizens)
-- that the passed audit-stamp citizen is alive and affiliated with one of
-- the route's two endpoints -- that check is an intentional admin-override
-- design: authority to act is derived from current_user_manages_settlement
-- (which already covers super admin / world admin / nation manager /
-- settlement manager), while the recorded actor citizen only has to belong
-- to the relevant nation/settlement, not to the caller personally. This
-- lets an admin who controls no player_character in the affected nation
-- still record a real, affiliated citizen as the audit stamp. See the
-- added function comments below for this decision. Comment source: #1145 PR
-- discussion; there is no separate issue link to cite from SQL.
--
-- reject_trade_route_side and replace_trade_route never received the
-- equivalent fix -- they still store p_rejector_citizen_id /
-- p_proposing_citizen_id as-is with no validation at all, so a direct RPC
-- call by an authorized side manager can stamp the audit column with any
-- citizen uuid in the world (not even one affiliated with the route). This
-- migration brings both up to parity with propose_trade_route /
-- approve_trade_route_side's existing validation.
-- ---------------------------------------------------------------------------
-- reject_trade_route_side: p_rejector_citizen_id must be alive and belong to
-- one of the trade route endpoints (nation_manager / settlement_manager role,
-- OR settlement residency) -- same shape as approve_trade_route_side's
-- validation. Body copied from the latest redefinition (20260626000000) with
-- the citizen validation added right before the rejection update.
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
  v_side_settlement_id          uuid;
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
    v_side_settlement_id := v_origin_settlement_id;
  else
    v_side_settlement_id := v_destination_settlement_id;
  end if;

  -- Authority is role-based for the side's settlement. No citizen-residency
  -- check on the specific side: the rejector citizen id is an audit stamp,
  -- validated below against the route's two endpoints as a whole.
  if not public.current_user_manages_settlement (v_side_settlement_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.citizens c
     where c.id = p_rejector_citizen_id
       and c.status = 'alive'
       and (
         (c.role_type = 'nation_manager' and c.role_nation_id in (v_origin_nation_id, v_destination_nation_id))
         or (c.role_type = 'settlement_manager' and c.role_settlement_id in (v_origin_settlement_id, v_destination_settlement_id))
         or c.settlement_id in (v_origin_settlement_id, v_destination_settlement_id)
       )
  ) then
    raise exception 'p_rejector_citizen_id must be alive and belong to one of the trade route endpoints'
      using errcode = 'P0001';
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

-- ---------------------------------------------------------------------------
-- replace_trade_route: p_proposing_citizen_id must be alive and belong to one
-- of the NEW route's endpoints -- same shape as propose_trade_route's
-- validation. Body copied from the latest redefinition (20260912000000) with
-- the citizen validation added right before the old route is superseded.
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
  v_old_origin_settlement_id      uuid;
  v_old_destination_settlement_id uuid;
  v_old_world_id                  uuid;
  v_new_origin_settlement_id      uuid;
  v_new_destination_settlement_id uuid;
  v_new_origin_nation_id          uuid;
  v_new_destination_nation_id     uuid;
  v_is_international                boolean;
  v_new_origin_trade_policy         text;
  v_new_destination_trade_policy    text;
  v_new_origin_nation_name          text;
  v_new_destination_nation_name     text;
  v_manages_new_origin            boolean;
  v_manages_new_destination       boolean;
  v_new_trade_route_id            uuid;
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
         tr.origin_settlement_id,
         tr.destination_settlement_id,
         on2.world_id
    into v_old_status_text,
         v_old_origin_settlement_id,
         v_old_destination_settlement_id,
         v_old_world_id
    from public.trade_routes tr
    join public.settlements os on os.id = tr.origin_settlement_id
    join public.nations on2 on on2.id = os.nation_id
   where tr.id = p_old_id
   for update of tr;

  if v_old_status_text is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_old_status_text in ('cancelled', 'replaced') then
    raise exception 'trade route cannot be replaced in its current status'
      using errcode = 'P0001';
  end if;

  -- Authority to replace: manage either endpoint of the OLD route.
  if not (
    public.current_user_manages_settlement (v_old_origin_settlement_id)
    or public.current_user_manages_settlement (v_old_destination_settlement_id)
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

  if not public.nations_have_met (v_new_origin_nation_id, v_new_destination_nation_id) then
    raise exception 'Nations have not met.' using errcode = 'P0001';
  end if;

  -- Trade policy gate (#1087): internal (same-nation) routes are always
  -- governed by settlement-level authority only, regardless of policy.
  v_is_international := v_new_origin_nation_id <> v_new_destination_nation_id;

  if v_is_international then
    select trade_policy, name into v_new_origin_trade_policy, v_new_origin_nation_name
      from public.nations n where n.id = v_new_origin_nation_id;
    select trade_policy, name into v_new_destination_trade_policy, v_new_destination_nation_name
      from public.nations n where n.id = v_new_destination_nation_id;

    if v_new_origin_trade_policy = 'closed' then
      raise exception '% has closed its borders to trade', v_new_origin_nation_name
        using errcode = 'P0001';
    end if;

    if v_new_destination_trade_policy = 'closed' then
      raise exception '% has closed its borders to trade', v_new_destination_nation_name
        using errcode = 'P0001';
    end if;
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

  if not exists (
    select 1
      from public.citizens c
     where c.id = p_proposing_citizen_id
       and c.status = 'alive'
       and (
         (c.role_type = 'nation_manager' and c.role_nation_id in (v_new_origin_nation_id, v_new_destination_nation_id))
         or (c.role_type = 'settlement_manager' and c.role_settlement_id in (v_new_origin_settlement_id, v_new_destination_settlement_id))
         or c.settlement_id in (v_new_origin_settlement_id, v_new_destination_settlement_id)
       )
  ) then
    raise exception 'p_proposing_citizen_id must be alive and belong to one of the new trade route endpoints'
      using errcode = 'P0001';
  end if;

  -- Auto-approve every NEW side the proposer effectively manages (nation
  -- authority is required instead of settlement authority when that side's
  -- nation is state_controlled on this international route); the
  -- counterpart stays pending until its own manager approves.
  if v_is_international and v_new_origin_trade_policy = 'state_controlled' then
    v_manages_new_origin := public.current_user_manages_nation (v_new_origin_nation_id);
  else
    v_manages_new_origin := public.current_user_manages_settlement (v_new_origin_settlement_id);
  end if;

  if v_is_international and v_new_destination_trade_policy = 'state_controlled' then
    v_manages_new_destination := public.current_user_manages_nation (v_new_destination_nation_id);
  else
    v_manages_new_destination := public.current_user_manages_settlement (v_new_destination_settlement_id);
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
    -- A proposer who manages both new endpoints approves both sides at once, so
    -- the replacement route has no separate recipient and goes active immediately.
    case when v_manages_new_origin and v_manages_new_destination then 'active' else 'proposed' end,
    p_proposing_citizen_id,
    case when v_manages_new_origin then 'approved' else 'pending' end,
    case when v_manages_new_origin then p_proposing_citizen_id else null end,
    case when v_manages_new_destination then 'approved' else 'pending' end,
    case when v_manages_new_destination then p_proposing_citizen_id else null end,
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
    v_old_world_id,
    v_new_trade_route_id,
    'trade_proposal_received',
    'A new trade route proposal has been received.'
  from all_recipients ar;

  old_route_id               := p_old_id;
  new_route_id               := v_new_trade_route_id;
  origin_settlement_id      := v_new_origin_settlement_id;
  destination_settlement_id := v_new_destination_settlement_id;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Document the audit-stamp design on the two RPCs that already validate
-- (#1145): the passed citizen id must be alive and affiliated with the
-- route's endpoints, but need not belong to the calling user. Authority to
-- act is already fully re-checked server-side via
-- current_user_manages_settlement; this is an intentional admin-override so
-- a super admin / world admin / nation manager with no player_character of
-- their own in the affected nation can still record a real, affiliated
-- citizen as the audit stamp.
-- ---------------------------------------------------------------------------
comment on function public.propose_trade_route (uuid, uuid, jsonb, uuid) is 'Proposes a trade route between two settlements, auto-approving each side the caller manages. Authority is current_user_manages_settlement (or current_user_manages_nation for a state_controlled international side). p_proposed_by_citizen_id is an audit stamp: validated (alive, affiliated with an endpoint via manager role or settlement residency) but intentionally not required to belong to the calling user -- an admin override lets an admin with no player_character in the affected nation still stamp a real, affiliated citizen (#1145, #1293).';

comment on function public.approve_trade_route_side (uuid, text, uuid) is 'Approves one side of a proposed/paused trade route. Authority is current_user_manages_settlement (or current_user_manages_nation for a state_controlled international side). p_approver_citizen_id is an audit stamp: validated (alive, affiliated with either endpoint via manager role or settlement residency) but intentionally not required to belong to the calling user -- an admin override lets an admin with no player_character in the affected nation still stamp a real, affiliated citizen (#1145, #1293).';
