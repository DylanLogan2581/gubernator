-- Migration: rpc_error_contract_citizen_settlement_partnership
-- Converts all silent RETURN (no-op) failure paths in the citizen-identity,
-- settlement-readiness, and partnership mutation RPCs to explicit RAISE so
-- callers can distinguish forbidden from not-found from domain violation
-- instead of being left with an empty result set.
--
-- Error contract (all converted RPCs):
--   42501 (insufficient_privilege) – caller lacks required admin / manager rights,
--                                     or auth.uid() is null (unauthenticated)
--   P0002 (no_data_found)          – null required params; target row does not exist
--   P0001 (raise_exception)        – domain / state constraint (archived world,
--                                     wrong citizen type, invalid role scope,
--                                     turn-number ordering, etc.)
-- ===========================================================================
-- Citizen identity / role mutations (originally 20260522000002)
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- link_user_to_citizen
-- Error contract:
--   P0002 – p_citizen_id or p_user_id is null; citizen not found; user not found
--   42501 – caller is not super admin or world admin of the citizen's world
--   P0001 – world is archived
-- ---------------------------------------------------------------------------
create or replace function public.link_user_to_citizen (p_citizen_id uuid, p_user_id uuid) returns setof public.citizens language plpgsql security definer
set
  search_path = '' as $$
declare
  v_citizen public.citizens%rowtype;
  v_world_status text;
  v_world_archived_at timestamptz;
begin
  if p_citizen_id is null or p_user_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_citizen from public.citizens where id = p_citizen_id;
  if v_citizen.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_citizen.world_id)
  ) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_citizen.world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.users u where u.id = p_user_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  return query
  update public.citizens c
  set
    citizen_type = 'player_character',
    user_id = p_user_id,
    role_type = case
      when public.citizen_role_scope_matches (
        c.settlement_id, c.role_type, c.role_nation_id, c.role_settlement_id
      ) then c.role_type
      else 'none'
    end,
    role_nation_id = case
      when public.citizen_role_scope_matches (
        c.settlement_id, c.role_type, c.role_nation_id, c.role_settlement_id
      ) then c.role_nation_id
      else null
    end,
    role_settlement_id = case
      when public.citizen_role_scope_matches (
        c.settlement_id, c.role_type, c.role_nation_id, c.role_settlement_id
      ) then c.role_settlement_id
      else null
    end
  where c.id = p_citizen_id
  returning c.*;
end;
$$;

-- ---------------------------------------------------------------------------
-- unlink_user_from_citizen
-- Error contract:
--   P0002 – p_citizen_id is null; citizen not found
--   42501 – caller is not super admin or world admin of the citizen's world
--   P0001 – world is archived
-- ---------------------------------------------------------------------------
create or replace function public.unlink_user_from_citizen (p_citizen_id uuid) returns setof public.citizens language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_world_status text;
  v_world_archived_at timestamptz;
begin
  if p_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select c.world_id, w.status, w.archived_at
  into v_world_id, v_world_status, v_world_archived_at
  from public.citizens c
  inner join public.worlds w on w.id = c.world_id
  where c.id = p_citizen_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
  ) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  return query
  update public.citizens c
  set
    citizen_type = 'npc',
    user_id = null,
    role_type = 'none',
    role_nation_id = null,
    role_settlement_id = null
  where c.id = p_citizen_id
  returning c.*;
end;
$$;

-- ---------------------------------------------------------------------------
-- assign_citizen_role
-- Error contract:
--   P0002 – p_citizen_id or p_role_type is null; citizen not found;
--            settlement's nation not found
--   42501 – caller lacks the required admin or nation-manager rights
--   P0001 – invalid role_type; citizen is not a player_character;
--            citizen has no settlement; archived world; role scope mismatch
-- ---------------------------------------------------------------------------
create or replace function public.assign_citizen_role (
  p_citizen_id uuid,
  p_role_type text,
  p_role_nation_id uuid default null,
  p_role_settlement_id uuid default null
) returns setof public.citizens language plpgsql security definer
set
  search_path = '' as $$
declare
  v_citizen public.citizens%rowtype;
  v_settlement_nation_id uuid;
  v_world_status text;
  v_world_archived_at timestamptz;
  v_is_world_admin boolean;
begin
  if p_citizen_id is null or p_role_type is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_role_type not in ('nation_manager', 'settlement_manager') then
    raise exception 'invalid role type' using errcode = 'P0001';
  end if;

  select * into v_citizen from public.citizens where id = p_citizen_id;
  if v_citizen.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_citizen.citizen_type <> 'player_character' then
    raise exception 'citizen is not a player_character' using errcode = 'P0001';
  end if;

  if v_citizen.settlement_id is null then
    raise exception 'citizen has no settlement' using errcode = 'P0001';
  end if;

  select s.nation_id into v_settlement_nation_id
  from public.settlements s
  where s.id = v_citizen.settlement_id;

  if v_settlement_nation_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  v_is_world_admin :=
    public.is_super_admin ()
    or public.is_world_admin (v_citizen.world_id);

  if not v_is_world_admin then
    if p_role_type <> 'settlement_manager' then
      raise exception 'insufficient privilege' using errcode = '42501';
    end if;
    if not public.is_nation_manager_of (v_settlement_nation_id) then
      raise exception 'insufficient privilege' using errcode = '42501';
    end if;
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_citizen.world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  if not public.citizen_role_scope_matches (
    v_citizen.settlement_id,
    p_role_type,
    p_role_nation_id,
    p_role_settlement_id
  ) then
    raise exception 'role scope does not match citizen settlement or nation' using errcode = 'P0001';
  end if;

  return query
  update public.citizens c
  set
    role_type = p_role_type,
    role_nation_id = p_role_nation_id,
    role_settlement_id = p_role_settlement_id
  where c.id = p_citizen_id
  returning c.*;
end;
$$;

-- ---------------------------------------------------------------------------
-- revoke_citizen_role
-- Error contract:
--   P0002 – p_citizen_id is null; citizen not found; (nation-manager path)
--            citizen has no settlement, or settlement has no nation
--   42501 – caller lacks required admin or nation-manager rights
--   P0001 – world is archived
-- ---------------------------------------------------------------------------
create or replace function public.revoke_citizen_role (p_citizen_id uuid) returns setof public.citizens language plpgsql security definer
set
  search_path = '' as $$
declare
  v_citizen public.citizens%rowtype;
  v_settlement_nation_id uuid;
  v_world_status text;
  v_world_archived_at timestamptz;
  v_is_world_admin boolean;
begin
  if p_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_citizen from public.citizens where id = p_citizen_id;
  if v_citizen.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  v_is_world_admin :=
    public.is_super_admin ()
    or public.is_world_admin (v_citizen.world_id);

  if not v_is_world_admin then
    if v_citizen.role_type <> 'settlement_manager' then
      raise exception 'insufficient privilege' using errcode = '42501';
    end if;
    if v_citizen.settlement_id is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;
    select s.nation_id into v_settlement_nation_id
    from public.settlements s
    where s.id = v_citizen.settlement_id;
    if v_settlement_nation_id is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;
    if not public.is_nation_manager_of (v_settlement_nation_id) then
      raise exception 'insufficient privilege' using errcode = '42501';
    end if;
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_citizen.world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  return query
  update public.citizens c
  set
    role_type = 'none',
    role_nation_id = null,
    role_settlement_id = null
  where c.id = p_citizen_id
  returning c.*;
end;
$$;

-- ===========================================================================
-- Settlement readiness helpers (originally 20260519000002)
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- set_settlement_readiness
-- Error contract:
--   P0002 – p_settlement_id or p_is_ready is null; settlement not found
--   42501 – caller is not super admin or world admin of the settlement's world
--   P0001 – world is archived
-- ---------------------------------------------------------------------------
create or replace function public.set_settlement_readiness (p_settlement_id uuid, p_is_ready boolean) returns table (
  id uuid,
  is_ready_current_turn boolean,
  ready_set_at timestamptz,
  last_ready_at timestamptz
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_world_status text;
  v_world_archived_at timestamptz;
begin
  if p_settlement_id is null or p_is_ready is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select
    n.world_id,
    w.status,
    w.archived_at
  into v_world_id, v_world_status, v_world_archived_at
  from
    public.settlements s
    inner join public.nations n on n.id = s.nation_id
    inner join public.worlds w on w.id = n.world_id
  where
    s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  return query
  update public.settlements s
  set
    is_ready_current_turn = p_is_ready,
    ready_set_at = case
      when p_is_ready then now()
      else null
    end,
    last_ready_at = case
      when p_is_ready then now()
      else s.last_ready_at
    end
  where
    s.id = p_settlement_id
  returning
    s.id,
    s.is_ready_current_turn,
    s.ready_set_at,
    s.last_ready_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_settlement_auto_ready
-- Error contract:
--   P0002 – p_settlement_id or p_auto_ready_enabled is null; settlement not found
--   42501 – caller is not super admin or world admin of the settlement's world
--   P0001 – world is archived
-- ---------------------------------------------------------------------------
create or replace function public.set_settlement_auto_ready (
  p_settlement_id uuid,
  p_auto_ready_enabled boolean
) returns table (
  id uuid,
  auto_ready_enabled boolean,
  is_ready_current_turn boolean,
  ready_set_at timestamptz
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_world_status text;
  v_world_archived_at timestamptz;
begin
  if p_settlement_id is null or p_auto_ready_enabled is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select
    n.world_id,
    w.status,
    w.archived_at
  into v_world_id, v_world_status, v_world_archived_at
  from
    public.settlements s
    inner join public.nations n on n.id = s.nation_id
    inner join public.worlds w on w.id = n.world_id
  where
    s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  return query
  update public.settlements s
  set
    auto_ready_enabled = p_auto_ready_enabled
  where
    s.id = p_settlement_id
  returning
    s.id,
    s.auto_ready_enabled,
    s.is_ready_current_turn,
    s.ready_set_at;
end;
$$;

-- ===========================================================================
-- Partnership mutations (originally 20260522000003, updated 20260526000000)
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- create_partnership
-- Error contract:
--   42501 – auth.uid() is null (unauthenticated); caller is not super admin or
--            world admin of the citizens' world
--   P0002 – null required params; citizen(s) not found; turn transition not found
--   P0001 – same citizen on both sides; formed_on_turn_number negative;
--            invalid status value; active+ended_on_turn_number inconsistency;
--            widowed+null ended_on_turn_number; citizens in different worlds;
--            archived world; active partnership with non-alive citizen
-- ---------------------------------------------------------------------------
create or replace function public.create_partnership (
  p_citizen_a_id uuid,
  p_citizen_b_id uuid,
  p_formed_on_turn_number integer,
  p_change_reason text,
  p_turn_transition_id uuid,
  p_status text default 'active',
  p_ended_on_turn_number integer default null
) returns setof public.partnerships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_citizen_a public.citizens%rowtype;
  v_citizen_b public.citizens%rowtype;
  v_world_status text;
  v_world_archived_at timestamptz;
  v_actor_id uuid;
  v_partnership public.partnerships%rowtype;
  v_status text;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if p_citizen_a_id is null or p_citizen_b_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_citizen_a_id = p_citizen_b_id then
    raise exception 'citizen_a and citizen_b must be different citizens' using errcode = 'P0001';
  end if;

  if p_formed_on_turn_number is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_formed_on_turn_number < 0 then
    raise exception 'formed_on_turn_number cannot be negative' using errcode = 'P0001';
  end if;

  if p_change_reason is null or btrim(p_change_reason) = '' then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_turn_transition_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  v_status := coalesce(p_status, 'active');
  if v_status not in ('active', 'widowed') then
    raise exception 'invalid status value' using errcode = 'P0001';
  end if;

  if v_status = 'active' and p_ended_on_turn_number is not null then
    raise exception 'active partnership must not have ended_on_turn_number' using errcode = 'P0001';
  end if;

  if v_status = 'widowed' and p_ended_on_turn_number is null then
    raise exception 'widowed partnership requires ended_on_turn_number' using errcode = 'P0001';
  end if;

  select * into v_citizen_a from public.citizens where id = p_citizen_a_id;
  select * into v_citizen_b from public.citizens where id = p_citizen_b_id;

  if v_citizen_a.id is null or v_citizen_b.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_citizen_a.world_id <> v_citizen_b.world_id then
    raise exception 'citizens must be in the same world' using errcode = 'P0001';
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_citizen_a.world_id)
  ) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_citizen_a.world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  if v_status = 'active'
    and (v_citizen_a.status <> 'alive' or v_citizen_b.status <> 'alive')
  then
    raise exception 'both citizens must be alive to form an active partnership' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.turn_transitions tt
    where tt.id = p_turn_transition_id
      and tt.world_id = v_citizen_a.world_id
  ) then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  insert into public.partnerships (
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number,
    ended_on_turn_number,
    changed_by_user_id,
    change_reason
  ) values (
    p_citizen_a_id,
    p_citizen_b_id,
    v_status,
    p_formed_on_turn_number,
    p_ended_on_turn_number,
    v_actor_id,
    p_change_reason
  ) returning * into v_partnership;

  insert into public.turn_log_entries (
    turn_transition_id,
    world_id,
    citizen_id,
    log_category,
    payload_jsonb
  ) values (
    p_turn_transition_id,
    v_citizen_a.world_id,
    p_citizen_a_id,
    'partnership_created',
    jsonb_build_object(
      'partnership_id', v_partnership.id,
      'citizen_a_id', v_partnership.citizen_a_id,
      'citizen_b_id', v_partnership.citizen_b_id,
      'status', v_partnership.status,
      'formed_on_turn_number', v_partnership.formed_on_turn_number,
      'ended_on_turn_number', v_partnership.ended_on_turn_number,
      'change_reason', p_change_reason,
      'changed_by_user_id', v_actor_id
    )
  );

  return next v_partnership;
end;
$$;

-- ---------------------------------------------------------------------------
-- end_partnership_internal: internal helper called only by dissolve_partnership
-- and mark_partnership_widowed. Raises typed exceptions so callers propagate
-- the correct SQLSTATE without duplicating validation logic.
--
-- Error contract:
--   42501 – auth.uid() is null; caller is not super admin or world admin
--   P0002 – null required params; partnership not found; world_id not resolvable;
--            turn transition not found
--   P0001 – invalid terminal_status; ended_on_turn_number negative;
--            ended_on_turn_number precedes formed_on_turn_number;
--            partnership is not currently active; archived world
-- ---------------------------------------------------------------------------
create or replace function public.end_partnership_internal (
  p_partnership_id uuid,
  p_terminal_status text,
  p_ended_on_turn_number integer,
  p_change_reason text,
  p_turn_transition_id uuid,
  p_log_category text
) returns setof public.partnerships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_existing public.partnerships%rowtype;
  v_world_id uuid;
  v_world_status text;
  v_world_archived_at timestamptz;
  v_actor_id uuid;
  v_updated public.partnerships%rowtype;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if p_partnership_id is null or p_turn_transition_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_terminal_status not in ('dissolved', 'widowed') then
    raise exception 'invalid terminal status' using errcode = 'P0001';
  end if;

  if p_ended_on_turn_number is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_ended_on_turn_number < 0 then
    raise exception 'ended_on_turn_number cannot be negative' using errcode = 'P0001';
  end if;

  if p_change_reason is null or btrim(p_change_reason) = '' then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_existing from public.partnerships where id = p_partnership_id;
  if v_existing.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_existing.status <> 'active' then
    raise exception 'partnership is not active' using errcode = 'P0001';
  end if;

  if p_ended_on_turn_number < v_existing.formed_on_turn_number then
    raise exception 'ended_on_turn_number cannot precede formed_on_turn_number' using errcode = 'P0001';
  end if;

  select c.world_id into v_world_id
  from public.citizens c
  where c.id = v_existing.citizen_a_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
  ) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.turn_transitions tt
    where tt.id = p_turn_transition_id
      and tt.world_id = v_world_id
  ) then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  update public.partnerships p
  set
    status = p_terminal_status,
    ended_on_turn_number = p_ended_on_turn_number,
    changed_by_user_id = v_actor_id,
    change_reason = p_change_reason
  where p.id = p_partnership_id
  returning * into v_updated;

  insert into public.turn_log_entries (
    turn_transition_id,
    world_id,
    citizen_id,
    log_category,
    payload_jsonb
  ) values (
    p_turn_transition_id,
    v_world_id,
    v_existing.citizen_a_id,
    p_log_category,
    jsonb_build_object(
      'partnership_id', v_updated.id,
      'citizen_a_id', v_updated.citizen_a_id,
      'citizen_b_id', v_updated.citizen_b_id,
      'status', v_updated.status,
      'formed_on_turn_number', v_updated.formed_on_turn_number,
      'ended_on_turn_number', v_updated.ended_on_turn_number,
      'change_reason', p_change_reason,
      'changed_by_user_id', v_actor_id
    )
  );

  return next v_updated;
end;
$$;

-- dissolve_partnership and mark_partnership_widowed are thin wrappers;
-- exceptions from end_partnership_internal propagate automatically.
-- ---------------------------------------------------------------------------
-- reassign_partner
-- Error contract:
--   42501 – auth.uid() is null; caller is not super admin or world admin
--   P0002 – null required params; partnership not found; citizen(s) not found;
--            turn transition not found
--   P0001 – retained = new_partner; turn numbers negative;
--            ended_on_turn_number precedes old partnership's formed_on_turn_number;
--            partnership is not active; retained citizen not in the partnership;
--            citizens in different worlds; archived world; citizen not alive
-- ---------------------------------------------------------------------------
create or replace function public.reassign_partner (
  p_old_partnership_id uuid,
  p_retained_citizen_id uuid,
  p_new_partner_citizen_id uuid,
  p_ended_on_turn_number integer,
  p_formed_on_turn_number integer,
  p_change_reason text,
  p_turn_transition_id uuid
) returns setof public.partnerships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_existing public.partnerships%rowtype;
  v_world_id uuid;
  v_world_status text;
  v_world_archived_at timestamptz;
  v_actor_id uuid;
  v_new_partner public.citizens%rowtype;
  v_retained public.citizens%rowtype;
  v_dissolved public.partnerships%rowtype;
  v_created public.partnerships%rowtype;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if p_old_partnership_id is null
    or p_retained_citizen_id is null
    or p_new_partner_citizen_id is null
    or p_turn_transition_id is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_retained_citizen_id = p_new_partner_citizen_id then
    raise exception 'retained and new partner must be different citizens' using errcode = 'P0001';
  end if;

  if p_ended_on_turn_number is null or p_formed_on_turn_number is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_ended_on_turn_number < 0 or p_formed_on_turn_number < 0 then
    raise exception 'turn numbers cannot be negative' using errcode = 'P0001';
  end if;

  if p_change_reason is null or btrim(p_change_reason) = '' then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_existing from public.partnerships where id = p_old_partnership_id;
  if v_existing.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_existing.status <> 'active' then
    raise exception 'partnership is not active' using errcode = 'P0001';
  end if;

  if p_ended_on_turn_number < v_existing.formed_on_turn_number then
    raise exception 'ended_on_turn_number cannot precede the old partnership formed_on_turn_number' using errcode = 'P0001';
  end if;

  if p_retained_citizen_id <> v_existing.citizen_a_id
    and p_retained_citizen_id <> v_existing.citizen_b_id
  then
    raise exception 'retained citizen is not a participant in the old partnership' using errcode = 'P0001';
  end if;

  select * into v_retained from public.citizens where id = p_retained_citizen_id;
  select * into v_new_partner from public.citizens where id = p_new_partner_citizen_id;
  if v_retained.id is null or v_new_partner.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_retained.world_id <> v_new_partner.world_id then
    raise exception 'citizens must be in the same world' using errcode = 'P0001';
  end if;

  v_world_id := v_retained.world_id;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
  ) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  if v_retained.status <> 'alive' or v_new_partner.status <> 'alive' then
    raise exception 'both citizens must be alive to form a new partnership' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.turn_transitions tt
    where tt.id = p_turn_transition_id
      and tt.world_id = v_world_id
  ) then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  update public.partnerships p
  set
    status = 'dissolved',
    ended_on_turn_number = p_ended_on_turn_number,
    changed_by_user_id = v_actor_id,
    change_reason = p_change_reason
  where p.id = p_old_partnership_id
  returning * into v_dissolved;

  insert into public.partnerships (
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number,
    changed_by_user_id,
    change_reason
  ) values (
    p_retained_citizen_id,
    p_new_partner_citizen_id,
    'active',
    p_formed_on_turn_number,
    v_actor_id,
    p_change_reason
  ) returning * into v_created;

  insert into public.turn_log_entries (
    turn_transition_id,
    world_id,
    citizen_id,
    log_category,
    payload_jsonb
  ) values (
    p_turn_transition_id,
    v_world_id,
    p_retained_citizen_id,
    'partnership_reassigned',
    jsonb_build_object(
      'dissolved_partnership_id', v_dissolved.id,
      'created_partnership_id', v_created.id,
      'retained_citizen_id', p_retained_citizen_id,
      'new_partner_citizen_id', p_new_partner_citizen_id,
      'previous_partner_citizen_id', case
        when v_existing.citizen_a_id = p_retained_citizen_id then v_existing.citizen_b_id
        else v_existing.citizen_a_id
      end,
      'ended_on_turn_number', p_ended_on_turn_number,
      'formed_on_turn_number', p_formed_on_turn_number,
      'change_reason', p_change_reason,
      'changed_by_user_id', v_actor_id
    )
  );

  return next v_created;
end;
$$;
