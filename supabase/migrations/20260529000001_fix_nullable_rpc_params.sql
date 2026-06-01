-- Migration: fix_nullable_rpc_params
-- Adds DEFAULT NULL to all nullable parameters in create_npc,
-- create_player_character, and assign_citizen_role. This makes the supabase
-- type generator emit optional (?) args instead of required non-nullable ones,
-- so the TypeScript callers can pass undefined (dropped from the JSON payload)
-- rather than null (which the old generator accepted, the new one rejects).
-- Function bodies are identical to the originals; only parameter defaults
-- change.
-- ---------------------------------------------------------------------------
-- create_npc
-- ---------------------------------------------------------------------------
create or replace function public.create_npc (
  p_world_id uuid,
  p_settlement_id uuid default null,
  p_name text default null,
  p_sex text default null,
  p_born_on_turn_number integer default null,
  p_parent_a_citizen_id uuid default null,
  p_parent_b_citizen_id uuid default null,
  p_personality_text text default null,
  p_skills_text text default null,
  p_profile_photo_url text default null,
  p_npc_trait_1 text default null,
  p_npc_trait_2 text default null,
  p_npc_secret_contradiction text default null,
  p_npc_goal text default null,
  p_npc_flaw text default null
) returns setof public.citizens language sql security definer
set
  search_path = '' as $$
  select *
  from public.create_citizen_internal (
    p_world_id,
    p_settlement_id,
    'npc',
    p_name,
    p_sex,
    null,
    p_born_on_turn_number,
    p_parent_a_citizen_id,
    p_parent_b_citizen_id,
    p_personality_text,
    p_skills_text,
    p_profile_photo_url,
    p_npc_trait_1,
    p_npc_trait_2,
    p_npc_secret_contradiction,
    p_npc_goal,
    p_npc_flaw
  );
$$;

-- ---------------------------------------------------------------------------
-- create_player_character
-- ---------------------------------------------------------------------------
create or replace function public.create_player_character (
  p_world_id uuid,
  p_settlement_id uuid default null,
  p_user_id uuid default null,
  p_name text default null,
  p_sex text default null,
  p_born_on_turn_number integer default null,
  p_parent_a_citizen_id uuid default null,
  p_parent_b_citizen_id uuid default null,
  p_personality_text text default null,
  p_skills_text text default null,
  p_profile_photo_url text default null
) returns setof public.citizens language sql security definer
set
  search_path = '' as $$
  select *
  from public.create_citizen_internal (
    p_world_id,
    p_settlement_id,
    'player_character',
    p_name,
    p_sex,
    p_user_id,
    p_born_on_turn_number,
    p_parent_a_citizen_id,
    p_parent_b_citizen_id,
    p_personality_text,
    p_skills_text,
    p_profile_photo_url,
    null,
    null,
    null,
    null,
    null
  );
$$;

-- ---------------------------------------------------------------------------
-- assign_citizen_role
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
    return;
  end if;

  if p_role_type not in ('nation_manager', 'settlement_manager') then
    return;
  end if;

  select * into v_citizen from public.citizens where id = p_citizen_id;
  if v_citizen.id is null then
    return;
  end if;

  if v_citizen.citizen_type <> 'player_character' then
    return;
  end if;

  if v_citizen.settlement_id is null then
    return;
  end if;

  select s.nation_id into v_settlement_nation_id
  from public.settlements s
  where s.id = v_citizen.settlement_id;

  if v_settlement_nation_id is null then
    return;
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_citizen.world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    return;
  end if;

  v_is_world_admin :=
    public.is_super_admin ()
    or public.is_world_admin (v_citizen.world_id);

  if not v_is_world_admin then
    if p_role_type <> 'settlement_manager' then
      return;
    end if;
    if not public.is_nation_manager_of (v_settlement_nation_id) then
      return;
    end if;
  end if;

  if not public.citizen_role_scope_matches (
    v_citizen.settlement_id,
    p_role_type,
    p_role_nation_id,
    p_role_settlement_id
  ) then
    return;
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
