-- Migration: propose_trade_route_auto_approve_proposer
-- The proposing side's approval is now recorded automatically at INSERT time:
-- the citizen identified by p_proposed_by_citizen_id belongs to either the
-- origin or destination nation; that side is set to 'approved' and
-- *_approved_by_citizen_id is populated. The counterpart side stays 'pending'.
--
-- This prevents the proposer from seeing Approve/Reject buttons for their own
-- side in the UI (the UI gates those buttons on *_approval_status = 'pending'),
-- and removes the underlying trigger mismatch error that occurred when the
-- proposer clicked Approve.
--
-- For admins whose citizen belongs to neither endpoint nation both sides remain
-- 'pending' (same behaviour as before this migration).
-- ---------------------------------------------------------------------------
create or replace function public.propose_trade_route (
  p_origin uuid,
  p_destination uuid,
  p_resource_id uuid,
  p_quantity numeric,
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
  v_resource_world_id           uuid;
  v_resource_is_trashed         boolean;
  v_citizen_nation_id           uuid;
  v_trade_route_id              uuid;
  v_is_admin                    boolean;
  v_origin_manager_count        integer;
  v_destination_manager_count   integer;
begin
  -- Null guard
  if p_origin is null
     or p_destination is null
     or p_resource_id is null
     or p_quantity is null
     or p_proposed_by_citizen_id is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Copy parameters to local variables for reliable SQL binding in CTEs
  v_origin_settlement_id      := p_origin;
  v_destination_settlement_id := p_destination;

  -- Self-loop check
  if p_origin = p_destination then
    raise exception 'origin and destination settlements must be different'
      using errcode = 'P0001';
  end if;

  -- Quantity check
  if p_quantity <= 0 then
    raise exception 'quantity per transition must be greater than zero'
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

  -- Resolve resource world + trash status
  select r.world_id, r.is_trashed
    into v_resource_world_id, v_resource_is_trashed
    from public.resources r
   where r.id = p_resource_id;

  if v_resource_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Cross-world resource check
  if v_resource_world_id <> v_world_id then
    raise exception 'resource does not belong to the same world as the trade route endpoints'
      using errcode = 'P0001';
  end if;

  -- Soft-deleted resource check
  if v_resource_is_trashed then
    raise exception 'resource is trashed' using errcode = 'P0001';
  end if;

  v_is_admin := public.is_super_admin () or public.is_world_admin (v_world_id);

  -- Resolve proposing citizen's nation unconditionally so we can use it to
  -- auto-approve the correct side in the INSERT below.
  select s.nation_id
    into v_citizen_nation_id
    from public.citizens c
    join public.settlements s on s.id = c.settlement_id
   where c.id = p_proposed_by_citizen_id
     and c.status = 'alive';

  -- Non-admin checks: citizen must exist and belong to an endpoint nation.
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

  -- Insert trade route. Auto-approve the proposer's side so the proposer does
  -- not see Approve/Reject buttons for their own side in the UI. The counterpart
  -- stays 'pending'. If the citizen belongs to neither endpoint nation (admin
  -- edge case) both sides remain 'pending'.
  insert into public.trade_routes (
    origin_settlement_id,
    destination_settlement_id,
    resource_id,
    quantity_per_transition,
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
    p_resource_id,
    p_quantity,
    'proposed',
    p_proposed_by_citizen_id,
    case when v_citizen_nation_id = v_origin_nation_id then 'approved' else 'pending' end,
    case when v_citizen_nation_id = v_origin_nation_id then p_proposed_by_citizen_id else null end,
    case when v_citizen_nation_id = v_destination_nation_id then 'approved' else 'pending' end,
    case when v_citizen_nation_id = v_destination_nation_id then p_proposed_by_citizen_id else null end
  )
  returning public.trade_routes.id into v_trade_route_id;

  -- Pre-compute manager counts for each side so the INSERT below can use
  -- them as plain scalar conditions rather than CTE cross-references, which
  -- are unreliable in some PostgreSQL CTE planner states.
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

  -- Notifications: notify Nation Manager and Settlement Manager PCs on each
  -- endpoint side. If a side has no active managers, fall back to world admins.
  -- The scalar v_origin_manager_count / v_destination_manager_count variables
  -- are resolved once before the statement and act as constants inside CTEs.
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

revoke all on function public.propose_trade_route (uuid, uuid, uuid, numeric, uuid)
from
  public;

grant
execute on function public.propose_trade_route (uuid, uuid, uuid, numeric, uuid) to authenticated;
