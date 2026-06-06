-- Migration: remove_owner_id_from_worlds
-- Removes public.worlds.owner_id, consolidating world admin authority
-- exclusively in the world_admins table. World creators now receive an
-- explicit world_admins row via an AFTER INSERT trigger instead.
--
-- Order matters:
--   1. Backfill world_admins rows before dropping any policies.
--   2. Verify the backfill is complete (fail fast if any world has no admin).
--   3. Drop owner-dependent policies and update helpers.
--   4. Install the after-insert trigger.
--   5. Drop the column and index last.
-- ---------------------------------------------------------------------------
-- ===========================================================================
-- 1. Backfill: world_admins rows for every existing owner
-- ===========================================================================
insert into
  public.world_admins (world_id, user_id)
select
  id,
  owner_id
from
  public.worlds
where
  owner_id is not null
on conflict (world_id, user_id) do nothing;

-- ===========================================================================
-- 2. Safety check: every world must have at least one world_admins row
-- ===========================================================================
do $$
begin
  if exists (
    select 1
    from public.worlds w
    where not exists (
      select 1 from public.world_admins wa where wa.world_id = w.id
    )
  ) then
    raise exception 'backfill incomplete: some worlds have no world_admins row — aborting';
  end if;
end;
$$;

-- ===========================================================================
-- 3a. Drop owner-dependent SELECT / UPDATE policies
-- ===========================================================================
drop policy "worlds_select_owner" on public.worlds;

drop policy "worlds_update_owner" on public.worlds;

-- worlds_delete_owner was already dropped in 20260608000001.
-- ===========================================================================
-- 3b. Replace worlds_insert_authenticated: no owner_id check
-- ===========================================================================
drop policy "worlds_insert_authenticated" on public.worlds;

create policy "worlds_insert_authenticated" on public.worlds for insert to authenticated
with
  check (public.is_active_app_user ());

-- ===========================================================================
-- 3c. Update is_world_admin: world_admins table only
-- ===========================================================================
create or replace function public.is_world_admin (p_world_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    public.is_active_app_user ()
    and exists (
      select 1
      from public.world_admins
      where world_id = p_world_id
        and user_id = auth.uid ()
    )
$$;

-- ===========================================================================
-- 3d. Update is_any_world_admin: world_admins table only
-- ===========================================================================
create or replace function public.is_any_world_admin () returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    public.is_active_app_user ()
    and exists (
      select 1
      from public.world_admins
      where user_id = auth.uid ()
    )
$$;

-- ===========================================================================
-- 4. After-insert trigger: auto-insert world_admins row for authenticated creator
-- ===========================================================================
-- Fires after every INSERT on public.worlds. When auth.uid() is non-null
-- (authenticated API caller), inserts the creator as the first world admin.
-- Skips when auth.uid() is null (service-role / migration paths).
create or replace function public.worlds_insert_creator_as_admin () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if auth.uid () is not null then
    insert into public.world_admins (world_id, user_id)
    values (new.id, auth.uid ())
    on conflict (world_id, user_id) do nothing;
  end if;
  return null;
end;
$$;

create trigger worlds_insert_creator_as_admin
after insert on public.worlds for each row
execute function public.worlds_insert_creator_as_admin ();

-- ===========================================================================
-- 5. Update create_world RPC: remove owner_id, rely on trigger for world_admins
-- ===========================================================================
create or replace function public.create_world (p_name text, p_visibility text default 'private') returns setof public.worlds language plpgsql security definer
set
  search_path = '' as $$
begin
  if not public.is_super_admin () then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if p_name is null or char_length (trim (p_name)) = 0 then
    raise exception 'World name is required.' using errcode = '22000';
  end if;

  if p_visibility not in ('public', 'private') then
    raise exception 'Visibility must be public or private.' using errcode = '22000';
  end if;

  return query
  insert into public.worlds (name, visibility)
  values (trim (p_name), p_visibility)
  returning *;
end;
$$;

-- ===========================================================================
-- 6. Update column grants: remove owner_id from INSERT privilege
-- ===========================================================================
revoke insert on public.worlds
from
  authenticated;

grant insert (id, name, visibility, calendar_config_json) on public.worlds to authenticated;

-- ===========================================================================
-- 7. Drop owner_id column and index
-- ===========================================================================
drop index public.worlds_owner_id_idx;

alter table public.worlds
drop column owner_id;

-- Fix RPC functions: remove owner_id union arm, keep world_admins lookup
-- Fix propose_trade_route: remove owner_id union arm
CREATE OR REPLACE FUNCTION public.propose_trade_route (
  p_origin uuid,
  p_destination uuid,
  p_legs jsonb,
  p_proposed_by_citizen_id uuid
) RETURNS TABLE (
  id uuid,
  origin_settlement_id uuid,
  destination_settlement_id uuid
) LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path TO '' AS $function$
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
$function$;

-- Fix approve_trade_route_side: remove owner_id union arm
CREATE OR REPLACE FUNCTION public.approve_trade_route_side (
  p_route_id uuid,
  p_side text,
  p_approver_citizen_id uuid
) RETURNS TABLE (
  id uuid,
  origin_settlement_id uuid,
  destination_settlement_id uuid,
  status text
) LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path TO '' AS $function$
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
  -- Null guard
  if p_route_id is null or p_side is null or p_approver_citizen_id is null then
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
  where tr.id = p_route_id;

  if v_origin_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Route must be in a state that allows approval
  if v_route_status not in ('proposed', 'paused') then
    raise exception 'trade route cannot be approved in its current status'
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

  -- Double-approval guard
  if (p_side = 'origin'      and v_origin_approval_status      = 'approved')
  or (p_side = 'destination' and v_destination_approval_status = 'approved') then
    raise exception 'this side of the trade route is already approved'
      using errcode = 'P0001';
  end if;

  -- Approver citizen must belong to the side's nation (admin may override).
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

  -- Record the approval
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

  -- When both sides are now approved, activate the route and notify managers.
  if (p_side = 'origin'      and v_destination_approval_status = 'approved')
  or (p_side = 'destination' and v_origin_approval_status      = 'approved') then

    update public.trade_routes
       set status = 'active'
     where public.trade_routes.id = p_route_id;

    v_new_status := 'active';

    -- Pre-compute manager counts (same pattern as propose_trade_route).
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
      world_admin_users as (select wa.user_id
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
$function$;

-- Fix cancel_trade_route: remove owner_id union arm
CREATE OR REPLACE FUNCTION public.cancel_trade_route (p_route_id uuid) RETURNS TABLE (
  id uuid,
  origin_settlement_id uuid,
  destination_settlement_id uuid,
  status text
) LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path TO '' AS $function$
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
    world_admin_users as (select wa.user_id
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
$function$;

-- Fix reject_trade_route_side: remove owner_id union arm
CREATE OR REPLACE FUNCTION public.reject_trade_route_side (
  p_route_id uuid,
  p_side text,
  p_rejector_citizen_id uuid
) RETURNS TABLE (
  id uuid,
  origin_settlement_id uuid,
  destination_settlement_id uuid,
  status text
) LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path TO '' AS $function$
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
    world_admin_users as (select wa.user_id
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
$function$;

-- Fix replace_trade_route: remove owner_id union arm
CREATE OR REPLACE FUNCTION public.replace_trade_route (
  p_old_id uuid,
  p_new_payload jsonb,
  p_proposing_citizen_id uuid
) RETURNS TABLE (
  old_route_id uuid,
  new_route_id uuid,
  origin_settlement_id uuid,
  destination_settlement_id uuid
) LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path TO '' AS $function$
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
    world_admin_users as (select wa.user_id
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
$function$;

-- Fix internal_apply_turn_transition_log_entries_and_notifications: remove owner_id union arm
CREATE OR REPLACE FUNCTION public.internal_apply_turn_transition_log_entries_and_notifications (
  p_transition_id uuid,
  p_world_id uuid,
  p_payload jsonb,
  OUT log_entry_count integer,
  OUT notification_count integer
) RETURNS record LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path TO '' AS $function$
declare
  v_notification jsonb;
  v_notif_type public.notification_type;
  v_notif_message text;
  v_notif_scope text;
  v_notif_settlement_id uuid;
  v_notif_nation_id uuid;
begin
  log_entry_count    := 0;
  notification_count := 0;

  -- §C33a: Bulk-insert simulation log entries.
  insert into public.turn_log_entries (
    turn_transition_id,
    world_id,
    settlement_id,
    nation_id,
    citizen_id,
    resource_id,
    log_category,
    payload_jsonb
  )
  select
    p_transition_id,
    p_world_id,
    (entry.value ->> 'settlementId')::uuid,
    (entry.value ->> 'nationId')::uuid,
    (entry.value ->> 'citizenId')::uuid,
    (entry.value ->> 'resourceId')::uuid,
    entry.value ->> 'category',
    coalesce(entry.value -> 'payload', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_payload -> 'logEntries', '[]'::jsonb)) as entry
  where entry.value ->> 'category' is not null;

  get diagnostics log_entry_count = row_count;

  -- §C33b: Fan out simulation notifications to scoped recipients.
  for v_notification in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'notifications', '[]'::jsonb))
  loop
    v_notif_type          := (v_notification ->> 'notificationType')::public.notification_type;
    v_notif_message       := v_notification ->> 'messageText';
    v_notif_scope         := v_notification ->> 'scope';
    v_notif_settlement_id := (v_notification ->> 'settlementId')::uuid;
    v_notif_nation_id     := (v_notification ->> 'nationId')::uuid;

    if v_notif_scope = 'settlement'
       and v_notif_settlement_id is not null
       and v_notif_nation_id is null
    then
      select s.nation_id
      into v_notif_nation_id
      from public.settlements s
      where s.id = v_notif_settlement_id;
    end if;

    insert into public.notifications (
      recipient_user_id,
      world_id,
      nation_id,
      settlement_id,
      notification_type,
      message_text,
      generated_in_transition_id
    )
    select
      recipients.user_id,
      p_world_id,
      v_notif_nation_id,
      v_notif_settlement_id,
      v_notif_type,
      v_notif_message,
      p_transition_id
    from (
      select c.user_id
      from public.citizens c
      inner join public.users u on u.id = c.user_id
      where v_notif_scope = 'settlement'
        and v_notif_settlement_id is not null
        and c.role_type = 'settlement_manager'
        and c.role_settlement_id = v_notif_settlement_id
        and c.status = 'alive'
        and c.citizen_type = 'player_character'
        and c.user_id is not null
        and u.status = 'active'
      union
      select c.user_id
      from public.citizens c
      inner join public.users u on u.id = c.user_id
      where v_notif_scope in ('settlement', 'nation')
        and v_notif_nation_id is not null
        and c.role_type = 'nation_manager'
        and c.role_nation_id = v_notif_nation_id
        and c.status = 'alive'
        and c.citizen_type = 'player_character'
        and c.user_id is not null
        and u.status = 'active'
      union
      select wa.user_id
      from public.world_admins wa
      inner join public.users u on u.id = wa.user_id
      where wa.world_id = p_world_id
        and u.status = 'active'
      union
      select u.id
      from public.users u
      where u.is_super_admin = true
        and u.status = 'active'
    ) as recipients (user_id)
    on conflict (
      generated_in_transition_id,
      recipient_user_id,
      notification_type,
      coalesce(settlement_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) where generated_in_transition_id is not null
    do nothing;

    notification_count := notification_count + 1;
  end loop;
end;
$function$;
