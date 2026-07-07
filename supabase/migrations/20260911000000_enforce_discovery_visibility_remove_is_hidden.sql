-- Migration: enforce_discovery_visibility_remove_is_hidden
-- #1086: nation_discoveries (20260910000000) introduced pairwise "have met"
-- state but did not yet enforce it. This migration makes discovery the sole
-- visibility gate between nations, replacing the old is_hidden flag, and
-- blocks relationship/trade interaction between nations that have not met.
--
-- New visibility rule (nation_visible_to_current_user):
--   • super admin, or world admin of the nation's world -- unchanged.
--   • the caller controls a living player_character in the nation itself --
--     unchanged (current_user_has_player_character_in_nation).
--   • NEW: the nation has met (nations_have_met) the nation of the caller's
--     active player_character in the same world.
-- There is no more "non-hidden + world access" fallback arm, so a caller with
-- world access but no player_character (a pure spectator) now sees NO
-- nations except through the admin paths above. This is an intentional v1
-- product decision (see issue #1086 notes) and is documented here rather
-- than in a separate design doc.
-- ---------------------------------------------------------------------------
-- 1. nation_visible_to_current_user: add the met-nation path, drop nothing
--    (the existing admin / own-PC paths are still correct).
-- ---------------------------------------------------------------------------
create or replace function public.nation_visible_to_current_user (p_nation_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.nations n
      where n.id = p_nation_id
        and public.is_world_admin(n.world_id)
    )
    or public.current_user_has_player_character_in_nation(p_nation_id)
    or exists (
      select 1
      from public.nations n
      join public.citizens c
        on c.id = public.current_user_active_player_character_id(n.world_id)
      join public.settlements s on s.id = c.settlement_id
      where n.id = p_nation_id
        and public.nations_have_met(s.nation_id, p_nation_id)
    )
$$;

-- ---------------------------------------------------------------------------
-- 2. nations SELECT: visibility is now solely nation_visible_to_current_user.
--    The old non-hidden + world-access fallback arm is removed.
-- ---------------------------------------------------------------------------
drop policy "nations_select_world_access" on public.nations;

create policy "nations_select_visible" on public.nations for
select
  to authenticated using (public.nation_visible_to_current_user (id));

-- ---------------------------------------------------------------------------
-- 3. nation_relationships SELECT: BOTH participants must be visible (not
--    either). Under the old is_hidden model an OR was safe because a
--    non-hidden nation leaked nothing; now the from/to nation of an unmet
--    pair would otherwise be inferable through a relationship row rooted on
--    the caller's own (visible) nation.
-- ---------------------------------------------------------------------------
drop policy "nation_relationships_select_visible" on public.nation_relationships;

create policy "nation_relationships_select_visible" on public.nation_relationships for
select
  to authenticated using (
    public.nation_visible_to_current_user (from_nation_id)
    and public.nation_visible_to_current_user (to_nation_id)
  );

-- ---------------------------------------------------------------------------
-- 4. trade_routes SELECT: both endpoint settlements' nations must be visible.
--    Same leak rationale as nation_relationships above.
-- ---------------------------------------------------------------------------
drop policy "trade_routes_select_visible" on public.trade_routes;

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
        and public.nation_visible_to_current_user (n.id)
    )
    and exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = trade_routes.destination_settlement_id
        and public.nation_visible_to_current_user (n.id)
    )
  );

-- ---------------------------------------------------------------------------
-- 5. trade_route_legs SELECT: visible when the parent route is visible, i.e.
--    both endpoint nations are visible (mirrors trade_routes above).
-- ---------------------------------------------------------------------------
drop policy "trade_route_legs_select_visible" on public.trade_route_legs;

create policy "trade_route_legs_select_visible" on public.trade_route_legs for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.trade_routes tr
        join public.settlements os on os.id = tr.origin_settlement_id
        join public.nations on2 on on2.id = os.nation_id
      where
        tr.id = trade_route_legs.trade_route_id
        and public.nation_visible_to_current_user (on2.id)
    )
    and exists (
      select
        1
      from
        public.trade_routes tr
        join public.settlements ds on ds.id = tr.destination_settlement_id
        join public.nations dn on dn.id = ds.nation_id
      where
        tr.id = trade_route_legs.trade_route_id
        and public.nation_visible_to_current_user (dn.id)
    )
  );

-- ---------------------------------------------------------------------------
-- 5b. nation_world_id: a handful of unrelated tables (settlements, settlement
--    resource stockpiles, construction projects, settlement buildings,
--    deposit instances/resources, managed population instances, nation
--    images storage, nation readiness votes, nation resource stockpiles)
--    gate their own SELECT RLS on "does the caller have world access",
--    resolved by joining directly to public.nations to read its world_id.
--    That direct join is itself subject to nations' OWN RLS -- which, as of
--    this migration, no longer admits every world member (only admins, PC
--    holders in the nation, and met nations). Tightening nations visibility
--    would therefore have silently broken read access to settlements/etc. for
--    any ordinary world member whose own nation hasn't met the target
--    nation, even though those tables' visibility rules have nothing to do
--    with nation discovery.
--
--    Fix: resolve world_id via this SECURITY DEFINER helper (bypasses RLS,
--    like every other permission helper in this file) instead of a plain
--    join, so those tables' visibility stays exactly as it was before this
--    migration.
-- ---------------------------------------------------------------------------
create or replace function public.nation_world_id (p_nation_id uuid) returns uuid language sql stable security definer
set
  search_path = '' as $$
  select world_id from public.nations where id = p_nation_id
$$;

revoke all on function public.nation_world_id (uuid)
from
  public;

grant
execute on function public.nation_world_id (uuid) to authenticated;

drop policy "settlements_select_world_access" on public.settlements;

create policy "settlements_select_world_access" on public.settlements for
select
  to authenticated using (
    public.current_user_has_world_access (public.nation_world_id (settlements.nation_id))
  );

drop policy "settlement_resource_stockpiles_select_world_access" on public.settlement_resource_stockpiles;

create policy "settlement_resource_stockpiles_select_world_access" on public.settlement_resource_stockpiles for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
      where
        s.id = settlement_resource_stockpiles.settlement_id
        and public.current_user_has_world_access (public.nation_world_id (s.nation_id))
    )
  );

drop policy "construction_projects_select_world_access" on public.construction_projects;

create policy "construction_projects_select_world_access" on public.construction_projects for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
      where
        s.id = construction_projects.settlement_id
        and public.current_user_has_world_access (public.nation_world_id (s.nation_id))
    )
  );

drop policy "settlement_buildings_select_world_access" on public.settlement_buildings;

create policy "settlement_buildings_select_world_access" on public.settlement_buildings for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
      where
        s.id = settlement_buildings.settlement_id
        and public.current_user_has_world_access (public.nation_world_id (s.nation_id))
    )
  );

drop policy "deposit_instances_select_world_access" on public.deposit_instances;

create policy "deposit_instances_select_world_access" on public.deposit_instances for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
      where
        s.id = deposit_instances.settlement_id
        and public.current_user_has_world_access (public.nation_world_id (s.nation_id))
    )
  );

drop policy "deposit_instance_resources_select_world_access" on public.deposit_instance_resources;

create policy "deposit_instance_resources_select_world_access" on public.deposit_instance_resources for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.deposit_instances di
        join public.settlements s on s.id = di.settlement_id
      where
        di.id = deposit_instance_resources.deposit_instance_id
        and public.current_user_has_world_access (public.nation_world_id (s.nation_id))
    )
  );

drop policy "managed_population_instances_select_world_access" on public.managed_population_instances;

create policy "managed_population_instances_select_world_access" on public.managed_population_instances for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
      where
        s.id = managed_population_instances.settlement_id
        and public.current_user_has_world_access (public.nation_world_id (s.nation_id))
    )
  );

drop policy "nation_images_select_member" on storage.objects;

create policy "nation_images_select_member" on storage.objects for
select
  to authenticated using (
    bucket_id = 'nation-images'
    and public.current_user_has_world_access (
      public.nation_world_id (
        public.nation_images_path_nation_id (storage.objects.name)
      )
    )
  );

drop policy "nation_readiness_votes_select_world_access" on public.nation_readiness_votes;

create policy "nation_readiness_votes_select_world_access" on public.nation_readiness_votes for
select
  to authenticated using (
    public.current_user_has_world_access (
      public.nation_world_id (nation_readiness_votes.nation_id)
    )
  );

drop policy "nation_resource_stockpiles_select_world_access" on public.nation_resource_stockpiles;

create policy "nation_resource_stockpiles_select_world_access" on public.nation_resource_stockpiles for
select
  to authenticated using (
    public.current_user_has_world_access (
      public.nation_world_id (nation_resource_stockpiles.nation_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Block interaction: a fresh bilateral relationship propose (pending_status
--    transitioning to 'proposed') is rejected when the nations have not met.
--    Unilateral stance writes (neutral/friendly/hostile/at_war, which never
--    set pending_status = 'proposed') are untouched -- this migration only
--    gates the propose/respond lifecycle, per issue #1086.
-- ---------------------------------------------------------------------------
create or replace function public.guard_bilateral_relationship_propose () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_acting_citizen_id uuid;
begin
  if new.pending_status is distinct from 'proposed' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.pending_status = 'accepted' then
    raise exception 'This proposal has already been accepted. Withdraw the existing agreement before proposing again.'
      using errcode = 'P0001';
  end if;

  if not public.nations_have_met (new.from_nation_id, new.to_nation_id) then
    raise exception 'Nations have not met.'
      using errcode = 'P0001';
  end if;

  select
    c.id into v_acting_citizen_id
  from
    public.citizens c
  where
    c.user_id = auth.uid ()
    and c.citizen_type = 'player_character'
    and c.role_type = 'nation_manager'
    and c.role_nation_id = new.from_nation_id
    and c.status = 'alive'
  limit
    1;

  new.pending_changed_by_citizen_id := v_acting_citizen_id;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. respond_to_bilateral: reject (empty set, matching the function's
--    existing authorization-failure convention) when the nations have not
--    met. Covers the case where set_nations_unmet() ran between propose and
--    respond.
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_bilateral (
  p_from_nation_id uuid,
  p_to_nation_id uuid,
  p_response text
) returns setof public.nation_relationships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_proposal public.nation_relationships%rowtype;
  v_world_id uuid;
  v_updated public.nation_relationships%rowtype;
begin
  if p_from_nation_id is null
    or p_to_nation_id is null
    or p_from_nation_id = p_to_nation_id
  then
    return;
  end if;

  if p_response not in ('accepted', 'declined') then
    return;
  end if;

  if not public.nations_have_met (p_from_nation_id, p_to_nation_id) then
    return;
  end if;

  select *
  into v_proposal
  from public.nation_relationships
  where
    from_nation_id = p_from_nation_id
    and to_nation_id = p_to_nation_id;

  if v_proposal.id is null
    or v_proposal.pending_stance is null
    or v_proposal.pending_status <> 'proposed'
  then
    return;
  end if;

  select n.world_id
  into v_world_id
  from public.nations n
  where n.id = p_from_nation_id;

  if v_world_id is null then
    return;
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.is_nation_manager_of (p_to_nation_id)
  ) then
    return;
  end if;

  if p_response = 'accepted' then
    update public.nation_relationships
    set
      current_stance = v_proposal.pending_stance,
      pending_status = 'accepted'
    where
      from_nation_id = p_from_nation_id
      and to_nation_id = p_to_nation_id
    returning *
    into v_updated;
    -- The mirror trigger fires on this UPDATE and upserts the symmetric row
    -- (from=p_to_nation_id, to=p_from_nation_id) with the same bilateral stance.
  else
    update public.nation_relationships
    set
      pending_stance = null,
      pending_status = 'declined'
    where
      from_nation_id = p_from_nation_id
      and to_nation_id = p_to_nation_id
    returning *
    into v_updated;
  end if;

  return next v_updated;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. propose_trade_route: reject when the endpoint nations have not met.
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

  -- Authority is role-based per endpoint settlement (super admin / world admin /
  -- nation manager / settlement manager). The proposer must manage at least one
  -- endpoint.
  v_manages_origin      := public.current_user_manages_settlement (v_origin_settlement_id);
  v_manages_destination := public.current_user_manages_settlement (v_destination_settlement_id);

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
-- 9. replace_trade_route: reject when the NEW endpoint nations have not met.
--    (The old route's endpoints were already validated when it was proposed.)
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

  -- Auto-approve every NEW side the proposer manages; the counterpart stays
  -- pending until its own manager approves.
  v_manages_new_origin      := public.current_user_manages_settlement (v_new_origin_settlement_id);
  v_manages_new_destination := public.current_user_manages_settlement (v_new_destination_settlement_id);

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
    'A trade route replacement proposal has been received.'
  from all_recipients ar;

  old_route_id               := p_old_id;
  new_route_id               := v_new_trade_route_id;
  origin_settlement_id       := v_new_origin_settlement_id;
  destination_settlement_id  := v_new_destination_settlement_id;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Drop is_hidden: the flag is fully superseded by nation_discoveries.
--     All policies/functions above are rewritten to no longer reference it,
--     so this is safe to drop last.
-- ---------------------------------------------------------------------------
alter table public.nations
drop column is_hidden;
