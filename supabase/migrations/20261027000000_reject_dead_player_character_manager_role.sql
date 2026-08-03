-- Migration: reject_dead_player_character_manager_role
-- assign_citizen_role's alive-guard only covered NPCs
-- (citizen_type = 'npc' and status <> 'alive'), so a dead player_character
-- could still be assigned nation_manager / settlement_manager -- contradicting
-- the allow_npc_manager_role_assignment migration's own intent that a dead
-- citizen, of any type, is rejected. Makes the guard unconditional on status.
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

  if v_citizen.status <> 'alive' then
    raise exception 'citizen must be alive to hold a manager role' using errcode = 'P0001';
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
