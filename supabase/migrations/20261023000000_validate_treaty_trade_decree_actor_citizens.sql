-- Migration: validate_treaty_trade_decree_actor_citizens
-- #1145: propose_nation_treaty, respond_to_nation_treaty, break_nation_treaty,
-- propose_trade_route, and approve_trade_route_side trusted the client-supplied
-- p_*_citizen_id audit stamp with no check that it belonged to anyone relevant
-- -- any citizen uuid in the world could be recorded as proposer/responder/
-- breaker/approver. issue_decree's admin branch only checked the citizen
-- existed in the world, not that it was alive or scoped to the decree's
-- nation/settlement.
--
-- Fix: each RPC now validates the passed citizen is alive AND affiliated
-- (by manager role OR settlement residency) with a nation/settlement the RPC
-- is actually acting on -- for treaties, the proposer/responder nation; for
-- trade routes, either endpoint's nation (matching the existing
-- current_user_manages_settlement authority model, which already allows a
-- manager of one side to act using a citizen who resides on the other side);
-- for decrees, the decree's own nation/settlement scope. Authority to act is
-- unchanged (current_user_manages_nation / current_user_manages_settlement
-- still gate who may call these RPCs) -- this closes the separate hole where
-- the recorded actor citizen was unrelated to the action.
-- ---------------------------------------------------------------------------
-- propose_nation_treaty: p_proposed_by_citizen_id must be alive and belong to
-- the proposer nation (nation_manager role OR settlement residency).
-- ---------------------------------------------------------------------------
create or replace function public.propose_nation_treaty (
  p_proposer_nation_id uuid,
  p_responder_nation_id uuid,
  p_treaty_type text,
  p_terms jsonb,
  p_proposed_by_citizen_id uuid,
  p_duration_turns integer default null
) returns public.nation_treaties language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id             uuid;
  v_responder_world_id   uuid;
  v_terms                jsonb;
  v_payer                text;
  v_resource_id           uuid;
  v_quantity              numeric;
  v_resource_world_id     uuid;
  v_resource_trashed      boolean;
  v_citizen_a_id          uuid;
  v_citizen_b_id          uuid;
  v_citizen_a_status      text;
  v_citizen_b_status      text;
  v_citizen_a_nation_id   uuid;
  v_citizen_b_nation_id   uuid;
  v_treaty                public.nation_treaties;
begin
  if p_proposer_nation_id is null
     or p_responder_nation_id is null
     or p_treaty_type is null
     or p_proposed_by_citizen_id is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_proposer_nation_id = p_responder_nation_id then
    raise exception 'proposer and responder nations must be different'
      using errcode = 'P0001';
  end if;

  if p_treaty_type not in ('tribute', 'trade_agreement', 'royal_marriage', 'currency_exchange') then
    raise exception 'invalid treaty_type' using errcode = 'P0001';
  end if;

  if p_duration_turns is not null and p_duration_turns <= 0 then
    raise exception 'p_duration_turns must be greater than zero'
      using errcode = 'P0001';
  end if;

  select world_id into v_world_id
    from public.nations
   where id = p_proposer_nation_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select world_id into v_responder_world_id
    from public.nations
   where id = p_responder_nation_id;

  if v_responder_world_id is null or v_responder_world_id <> v_world_id then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.current_user_manages_nation (p_proposer_nation_id) then
    raise exception 'You do not have permission to manage this nation.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if not public.nations_have_met (p_proposer_nation_id, p_responder_nation_id) then
    raise exception 'Nations have not met.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.nation_relationships nr
     where (
             (nr.from_nation_id = p_proposer_nation_id and nr.to_nation_id = p_responder_nation_id)
          or (nr.from_nation_id = p_responder_nation_id and nr.to_nation_id = p_proposer_nation_id)
           )
       and nr.current_stance = 'at_war'
  ) then
    raise exception 'nations are at war' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
      from public.citizens c
     where c.id = p_proposed_by_citizen_id
       and c.status = 'alive'
       and (
         (c.role_type = 'nation_manager' and c.role_nation_id = p_proposer_nation_id)
         or exists (
           select 1
             from public.settlements s
            where s.id = c.settlement_id
              and s.nation_id = p_proposer_nation_id
         )
       )
  ) then
    raise exception 'p_proposed_by_citizen_id must be alive and belong to the proposer nation'
      using errcode = 'P0001';
  end if;

  v_terms := coalesce(p_terms, '{}'::jsonb);

  if jsonb_typeof(v_terms) <> 'object' then
    raise exception 'terms must be a json object' using errcode = 'P0001';
  end if;

  if p_treaty_type = 'tribute' then
    v_payer       := v_terms ->> 'payer';
    v_resource_id := (v_terms ->> 'resource_id')::uuid;
    v_quantity    := (v_terms ->> 'quantity_per_turn')::numeric;

    if v_payer is null or v_payer not in ('proposer', 'responder') then
      raise exception 'tribute terms.payer must be ''proposer'' or ''responder'''
        using errcode = 'P0001';
    end if;

    if v_resource_id is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'tribute terms.quantity_per_turn must be greater than zero'
        using errcode = 'P0001';
    end if;

    select r.world_id, r.is_trashed into v_resource_world_id, v_resource_trashed
      from public.resources r
     where r.id = v_resource_id;

    if v_resource_world_id is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_resource_world_id <> v_world_id then
      raise exception 'resource does not belong to the same world as the treaty nations'
        using errcode = 'P0001';
    end if;

    if v_resource_trashed then
      raise exception 'resource is trashed' using errcode = 'P0001';
    end if;
  elsif p_treaty_type = 'trade_agreement' then
    if v_terms <> '{}'::jsonb then
      raise exception 'trade_agreement terms must be an empty object'
        using errcode = 'P0001';
    end if;
  elsif p_treaty_type = 'royal_marriage' then
    v_citizen_a_id := (v_terms ->> 'citizen_a_id')::uuid;
    v_citizen_b_id := (v_terms ->> 'citizen_b_id')::uuid;

    if v_citizen_a_id is null or v_citizen_b_id is null or v_citizen_a_id = v_citizen_b_id then
      raise exception 'royal_marriage terms must reference two distinct citizens'
        using errcode = 'P0001';
    end if;

    select c.status, s.nation_id into v_citizen_a_status, v_citizen_a_nation_id
      from public.citizens c
      join public.settlements s on s.id = c.settlement_id
     where c.id = v_citizen_a_id;

    select c.status, s.nation_id into v_citizen_b_status, v_citizen_b_nation_id
      from public.citizens c
      join public.settlements s on s.id = c.settlement_id
     where c.id = v_citizen_b_id;

    if v_citizen_a_status is distinct from 'alive' or v_citizen_b_status is distinct from 'alive' then
      raise exception 'royal_marriage requires two living citizens' using errcode = 'P0001';
    end if;

    if not (
      (v_citizen_a_nation_id = p_proposer_nation_id and v_citizen_b_nation_id = p_responder_nation_id)
      or (v_citizen_a_nation_id = p_responder_nation_id and v_citizen_b_nation_id = p_proposer_nation_id)
    ) then
      raise exception 'royal_marriage citizens must belong one to each treaty nation'
        using errcode = 'P0001';
    end if;
  else
    raise exception 'currency exchange treaties are not supported until currencies exist'
      using errcode = 'P0001';
  end if;

  insert into public.nation_treaties (
    world_id,
    proposer_nation_id,
    responder_nation_id,
    treaty_type,
    terms,
    status,
    proposed_by_citizen_id,
    duration_turns
  )
  values (
    v_world_id,
    p_proposer_nation_id,
    p_responder_nation_id,
    p_treaty_type,
    v_terms,
    'proposed',
    p_proposed_by_citizen_id,
    p_duration_turns
  )
  returning * into v_treaty;

  return v_treaty;
end;
$$;

-- ---------------------------------------------------------------------------
-- respond_to_nation_treaty: p_responded_by_citizen_id must be alive and
-- belong to the responder nation (nation_manager role OR settlement
-- residency).
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_nation_treaty (
  p_treaty_id uuid,
  p_response text,
  p_responded_by_citizen_id uuid
) returns public.nation_treaties language plpgsql security definer
set
  search_path = '' as $$
declare
  v_treaty  public.nation_treaties;
  v_world_id uuid;
  v_turn_number integer;
begin
  if p_treaty_id is null or p_response is null or p_responded_by_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_response not in ('accept', 'decline') then
    raise exception 'response must be ''accept'' or ''decline''' using errcode = 'P0001';
  end if;

  select * into v_treaty
    from public.nation_treaties
   where id = p_treaty_id
   for update;

  if v_treaty.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_treaty.status <> 'proposed' then
    raise exception 'treaty cannot be responded to in its current status'
      using errcode = 'P0001';
  end if;

  if not public.current_user_manages_nation (v_treaty.responder_nation_id) then
    raise exception 'You do not have permission to manage this nation.'
      using errcode = '42501';
  end if;

  v_world_id := v_treaty.world_id;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.citizens c
     where c.id = p_responded_by_citizen_id
       and c.status = 'alive'
       and (
         (c.role_type = 'nation_manager' and c.role_nation_id = v_treaty.responder_nation_id)
         or exists (
           select 1
             from public.settlements s
            where s.id = c.settlement_id
              and s.nation_id = v_treaty.responder_nation_id
         )
       )
  ) then
    raise exception 'p_responded_by_citizen_id must be alive and belong to the responder nation'
      using errcode = 'P0001';
  end if;

  if p_response = 'accept' then
    if not public.nations_have_met (v_treaty.proposer_nation_id, v_treaty.responder_nation_id) then
      raise exception 'Nations have not met.' using errcode = 'P0001';
    end if;

    if exists (
      select 1
        from public.nation_relationships nr
       where (
               (nr.from_nation_id = v_treaty.proposer_nation_id and nr.to_nation_id = v_treaty.responder_nation_id)
            or (nr.from_nation_id = v_treaty.responder_nation_id and nr.to_nation_id = v_treaty.proposer_nation_id)
             )
         and nr.current_stance = 'at_war'
    ) then
      raise exception 'nations are at war' using errcode = 'P0001';
    end if;

    select w.current_turn_number into v_turn_number
      from public.worlds w
     where w.id = v_world_id;

    update public.nation_treaties
       set status = 'active',
           starts_turn_number = v_turn_number,
           ends_turn_number = case
             when v_treaty.duration_turns is null then null
             else v_turn_number + v_treaty.duration_turns
           end,
           responded_by_citizen_id = p_responded_by_citizen_id
     where id = p_treaty_id
    returning * into v_treaty;
  else
    update public.nation_treaties
       set status = 'declined',
           responded_by_citizen_id = p_responded_by_citizen_id
     where id = p_treaty_id
    returning * into v_treaty;
  end if;

  return v_treaty;
end;
$$;

-- ---------------------------------------------------------------------------
-- break_nation_treaty: p_broken_by_citizen_id must be alive and belong to
-- either treaty nation (nation_manager role OR settlement residency).
-- ---------------------------------------------------------------------------
create or replace function public.break_nation_treaty (p_treaty_id uuid, p_broken_by_citizen_id uuid) returns public.nation_treaties language plpgsql security definer
set
  search_path = '' as $$
declare
  v_treaty                      public.nation_treaties;
  v_proposer_recipient_count    integer;
  v_responder_recipient_count   integer;
begin
  if p_treaty_id is null or p_broken_by_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_treaty
    from public.nation_treaties
   where id = p_treaty_id
   for update;

  if v_treaty.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_treaty.status <> 'active' then
    raise exception 'only an active treaty can be broken' using errcode = 'P0001';
  end if;

  if not (
    public.current_user_manages_nation (v_treaty.proposer_nation_id)
    or public.current_user_manages_nation (v_treaty.responder_nation_id)
  ) then
    raise exception 'You do not have permission to manage either treaty nation.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_treaty.world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.citizens c
     where c.id = p_broken_by_citizen_id
       and c.status = 'alive'
       and (
         (c.role_type = 'nation_manager' and c.role_nation_id in (v_treaty.proposer_nation_id, v_treaty.responder_nation_id))
         or exists (
           select 1
             from public.settlements s
            where s.id = c.settlement_id
              and s.nation_id in (v_treaty.proposer_nation_id, v_treaty.responder_nation_id)
         )
       )
  ) then
    raise exception 'p_broken_by_citizen_id must be alive and belong to a treaty nation'
      using errcode = 'P0001';
  end if;

  update public.nation_treaties
     set status = 'broken'
   where id = p_treaty_id
  returning * into v_treaty;

  select count(*) into v_proposer_recipient_count
    from public.citizens c
   where c.status = 'alive'
     and c.citizen_type = 'player_character'
     and c.user_id is not null
     and c.role_type = 'nation_manager'
     and c.role_nation_id = v_treaty.proposer_nation_id;

  select count(*) into v_responder_recipient_count
    from public.citizens c
   where c.status = 'alive'
     and c.citizen_type = 'player_character'
     and c.user_id is not null
     and c.role_type = 'nation_manager'
     and c.role_nation_id = v_treaty.responder_nation_id;

  with
    proposer_managers as (
      select c.user_id, v_treaty.proposer_nation_id as nation_id
        from public.citizens c
       where v_proposer_recipient_count > 0
         and c.status = 'alive'
         and c.citizen_type = 'player_character'
         and c.user_id is not null
         and c.role_type = 'nation_manager'
         and c.role_nation_id = v_treaty.proposer_nation_id
    ),
    responder_managers as (
      select c.user_id, v_treaty.responder_nation_id as nation_id
        from public.citizens c
       where v_responder_recipient_count > 0
         and c.status = 'alive'
         and c.citizen_type = 'player_character'
         and c.user_id is not null
         and c.role_type = 'nation_manager'
         and c.role_nation_id = v_treaty.responder_nation_id
    ),
    world_admin_users as (
      select wa.user_id
        from public.world_admins wa
        join public.users u on u.id = wa.user_id
       where wa.world_id = v_treaty.world_id
         and u.status = 'active'
    ),
    all_recipients as (
      select user_id, nation_id from proposer_managers
      union
      select user_id, nation_id from responder_managers
      union
      select user_id, v_treaty.proposer_nation_id as nation_id from world_admin_users where v_proposer_recipient_count = 0
      union
      select user_id, v_treaty.responder_nation_id as nation_id from world_admin_users where v_responder_recipient_count = 0
    )
  insert into public.notifications (
    recipient_user_id,
    world_id,
    nation_id,
    notification_type,
    message_text
  )
  select
    ar.user_id,
    v_treaty.world_id,
    ar.nation_id,
    'nation.treaty_broken',
    'A nation treaty has been broken.'
  from all_recipients ar;

  return v_treaty;
end;
$$;

-- ---------------------------------------------------------------------------
-- propose_trade_route: p_proposed_by_citizen_id must be alive and belong to
-- either endpoint's nation (nation_manager / settlement_manager role, OR
-- settlement residency), matching the current_user_manages_settlement
-- authority model that already allows a manager of one endpoint to act
-- without residing there. Body copied from the latest redefinition
-- (20260913000000) with the citizen validation added right before the insert.
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

  if not exists (
    select 1
      from public.citizens c
     where c.id = p_proposed_by_citizen_id
       and c.status = 'alive'
       and (
         (c.role_type = 'nation_manager' and c.role_nation_id in (v_origin_nation_id, v_destination_nation_id))
         or (c.role_type = 'settlement_manager' and c.role_settlement_id in (v_origin_settlement_id, v_destination_settlement_id))
         or c.settlement_id in (v_origin_settlement_id, v_destination_settlement_id)
       )
  ) then
    raise exception 'p_proposed_by_citizen_id must be alive and belong to one of the trade route endpoints'
      using errcode = 'P0001';
  end if;

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
-- approve_trade_route_side: p_approver_citizen_id must be alive and belong to
-- either endpoint's nation (nation_manager / settlement_manager role, OR
-- settlement residency) of the route being approved, not necessarily the
-- specific side approved -- matching the existing (#1086) design intent that
-- authority is role-based per side while residency is not required. Body
-- copied from the latest redefinition (20260913000000) with the citizen
-- validation added right before the approval update.
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
  -- manage-NATION authority (not settlement) counts.
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

  if not exists (
    select 1
      from public.citizens c
     where c.id = p_approver_citizen_id
       and c.status = 'alive'
       and (
         (c.role_type = 'nation_manager' and c.role_nation_id in (v_origin_nation_id, v_destination_nation_id))
         or (c.role_type = 'settlement_manager' and c.role_settlement_id in (v_origin_settlement_id, v_destination_settlement_id))
         or c.settlement_id in (v_origin_settlement_id, v_destination_settlement_id)
       )
  ) then
    raise exception 'p_approver_citizen_id must be alive and belong to one of the trade route endpoints'
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

-- ---------------------------------------------------------------------------
-- issue_decree: the world/super admin branch now validates the explicitly
-- passed p_issued_by_citizen_id is alive and scoped to the decree's own
-- nation/settlement (manager role OR residency), not merely "exists in this
-- world". The non-admin branch already resolves the manager citizen from
-- auth.uid() server-side and is unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.issue_decree (
  p_world_id uuid,
  p_nation_id uuid,
  p_settlement_id uuid,
  p_title text,
  p_body_markdown text,
  p_issued_by_citizen_id uuid
) returns public.decrees language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_turn_number integer;
  v_owning_world_id uuid;
  v_is_admin boolean;
  v_issued_by uuid;
  v_decree public.decrees%rowtype;
begin
  if p_world_id is null or p_title is null or p_body_markdown is null then
    raise exception 'world, title, and body are required'
      using errcode = '22023';
  end if;

  if (p_nation_id is null) = (p_settlement_id is null) then
    raise exception 'exactly one of nation or settlement is required'
      using errcode = '22023';
  end if;

  if btrim(p_title) = '' then
    raise exception 'title must not be blank'
      using errcode = '22023';
  end if;

  if btrim(p_body_markdown) = '' then
    raise exception 'body must not be blank'
      using errcode = '22023';
  end if;

  select status, current_turn_number
  into v_world_status, v_turn_number
  from public.worlds
  where id = p_world_id;

  if v_world_status is null then
    raise exception 'world not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if p_nation_id is not null then
    select world_id into v_owning_world_id
    from public.nations
    where id = p_nation_id;

    if v_owning_world_id is null or v_owning_world_id <> p_world_id then
      raise exception 'nation not found in this world'
        using errcode = 'P0002';
    end if;

    if not public.current_user_manages_nation (p_nation_id) then
      raise exception 'insufficient privilege'
        using errcode = '42501';
    end if;
  else
    select n.world_id into v_owning_world_id
    from public.settlements s
    inner join public.nations n on n.id = s.nation_id
    where s.id = p_settlement_id;

    if v_owning_world_id is null or v_owning_world_id <> p_world_id then
      raise exception 'settlement not found in this world'
        using errcode = 'P0002';
    end if;

    if not public.current_user_manages_settlement (p_settlement_id) then
      raise exception 'insufficient privilege'
        using errcode = '42501';
    end if;
  end if;

  v_is_admin := public.is_world_admin (p_world_id) or public.is_super_admin ();

  if v_is_admin then
    if p_issued_by_citizen_id is null then
      raise exception 'p_issued_by_citizen_id is required'
        using errcode = '22023';
    end if;

    if p_nation_id is not null then
      if not exists (
        select 1 from public.citizens c
        where c.id = p_issued_by_citizen_id
          and c.world_id = p_world_id
          and c.status = 'alive'
          and (
            (c.role_type = 'nation_manager' and c.role_nation_id = p_nation_id)
            or exists (
              select 1 from public.settlements s
              where s.id = c.settlement_id and s.nation_id = p_nation_id
            )
          )
      ) then
        raise exception 'issuing citizen must be alive and belong to this nation'
          using errcode = 'P0001';
      end if;
    else
      if not exists (
        select 1 from public.citizens c
        where c.id = p_issued_by_citizen_id
          and c.world_id = p_world_id
          and c.status = 'alive'
          and (
            (c.role_type = 'settlement_manager' and c.role_settlement_id = p_settlement_id)
            or c.settlement_id = p_settlement_id
          )
      ) then
        raise exception 'issuing citizen must be alive and belong to this settlement'
          using errcode = 'P0001';
      end if;
    end if;

    v_issued_by := p_issued_by_citizen_id;
  elsif p_nation_id is not null then
    select c.id into v_issued_by
    from public.citizens c
    where c.role_type = 'nation_manager'
      and c.role_nation_id = p_nation_id
      and c.status = 'alive'
      and c.user_id = auth.uid ()
    limit 1;
  else
    select c.id into v_issued_by
    from public.citizens c
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = p_settlement_id
      and c.status = 'alive'
      and c.user_id = auth.uid ()
    limit 1;
  end if;

  if v_issued_by is null then
    raise exception 'no active manager citizen found for the current user'
      using errcode = '42501';
  end if;

  insert into public.decrees (
    world_id, nation_id, settlement_id, title, body_markdown,
    issued_by_citizen_id, issued_turn_number
  )
  values (
    p_world_id, p_nation_id, p_settlement_id, btrim(p_title), p_body_markdown,
    v_issued_by, v_turn_number
  )
  returning * into v_decree;

  return v_decree;
end;
$$;
