-- Migration: allow_npc_manager_role_assignment
-- Epic 11 requires that any citizen -- including NPCs -- can hold the
-- nation_manager or settlement_manager role, so world admins can operate a
-- nation/settlement on behalf of an NPC ruler when no player controls one.
-- Relaxes assign_citizen_role's "must be a player_character" guard to also
-- accept alive NPCs (a dead NPC, like a dead player_character today, is still
-- rejected). No RLS/authority change: is_nation_manager_of and
-- current_user_manages_nation still key off user_id = auth.uid(), so an
-- NPC-held role never grants a player manage authority -- only world admins
-- / super admins (already covered by current_user_manages_nation) can act on
-- its behalf. revoke_citizen_role already had no citizen_type restriction and
-- is unchanged.
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

  if v_citizen.citizen_type = 'npc' and v_citizen.status <> 'alive' then
    raise exception 'npc citizen must be alive to hold a manager role' using errcode = 'P0001';
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
