-- Migration: add_player_character_role_mutations
-- Introduces the dedicated SECURITY DEFINER mutations that govern the four
-- admin-scoped citizen identity transitions: link a user to a citizen, unlink
-- a user from a citizen, assign a Nation/Settlement Manager role, and revoke
-- an assigned role. Direct writes to user_id, role_type, role_nation_id, and
-- role_settlement_id are already blocked by the column-level grants installed
-- in 20260520000000_add_citizens.sql, so these RPCs are the only path through
-- which those columns can change.
--
-- Authorization summary:
--   • Super admin and World Admin of the citizen's world may use all four.
--   • Nation Manager of the citizen's nation may use assign_citizen_role and
--     revoke_citizen_role, restricted to the 'settlement_manager' role on
--     citizens whose settlement belongs to the Nation Manager's nation.
--   • All four mutations are no-ops against archived worlds.
--
-- Scope invariants enforced by each RPC:
--   • link_user_to_citizen flips citizen_type to 'player_character', sets
--     user_id, and clears any pre-existing role whose scope no longer matches
--     the citizen's current settlement / nation.
--   • unlink_user_from_citizen flips citizen_type back to 'npc', nulls
--     user_id, and resets the role to 'none'.
--   • assign_citizen_role requires the citizen to be a player_character and
--     validates that the requested role scope matches the citizen's
--     settlement and nation.
--   • revoke_citizen_role resets the role columns to ('none', null, null).
-- ---------------------------------------------------------------------------
-- citizen_role_scope_matches: shared scope check reused by link/assign so the
-- "is this role still valid for this citizen?" rule lives in exactly one
-- place.
-- ---------------------------------------------------------------------------
create or replace function public.citizen_role_scope_matches (
  p_citizen_settlement_id uuid,
  p_role_type text,
  p_role_nation_id uuid,
  p_role_settlement_id uuid
) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select case
    when p_role_type = 'none' then
      p_role_nation_id is null and p_role_settlement_id is null
    when p_role_type = 'nation_manager' then
      p_role_settlement_id is null
      and p_role_nation_id is not null
      and exists (
        select 1
        from public.settlements s
        where s.id = p_citizen_settlement_id
          and s.nation_id = p_role_nation_id
      )
    when p_role_type = 'settlement_manager' then
      p_role_nation_id is null
      and p_role_settlement_id is not null
      and p_role_settlement_id = p_citizen_settlement_id
    else
      false
  end
$$;

revoke all on function public.citizen_role_scope_matches (uuid, text, uuid, uuid)
from
  public;

grant
execute on function public.citizen_role_scope_matches (uuid, text, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- link_user_to_citizen: admin-only. Flips an NPC into a player_character and
-- attaches the given user. Any existing role survives only when its scope
-- still matches the citizen's settlement / nation; otherwise the role is
-- reset to 'none'.
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
    return;
  end if;

  select * into v_citizen from public.citizens where id = p_citizen_id;
  if v_citizen.id is null then
    return;
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_citizen.world_id)
  ) then
    return;
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_citizen.world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    return;
  end if;

  if not exists (select 1 from public.users u where u.id = p_user_id) then
    return;
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

revoke all on function public.link_user_to_citizen (uuid, uuid)
from
  public;

grant
execute on function public.link_user_to_citizen (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- unlink_user_from_citizen: admin-only. Detaches the user, flips the citizen
-- back to 'npc', and always resets the role to 'none' since NPCs cannot hold
-- manager roles.
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
    return;
  end if;

  select c.world_id, w.status, w.archived_at
  into v_world_id, v_world_status, v_world_archived_at
  from public.citizens c
  inner join public.worlds w on w.id = c.world_id
  where c.id = p_citizen_id;

  if v_world_id is null then
    return;
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
  ) then
    return;
  end if;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    return;
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

revoke all on function public.unlink_user_from_citizen (uuid)
from
  public;

grant
execute on function public.unlink_user_from_citizen (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- assign_citizen_role: admin path covers any role on any player_character in
-- the citizen's world. Nation Manager path is narrower — it can only assign
-- the 'settlement_manager' role on a player_character whose settlement
-- belongs to the Nation Manager's nation. Scope columns must match the
-- citizen's settlement / nation in every case.
-- ---------------------------------------------------------------------------
create or replace function public.assign_citizen_role (
  p_citizen_id uuid,
  p_role_type text,
  p_role_nation_id uuid,
  p_role_settlement_id uuid
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

revoke all on function public.assign_citizen_role (uuid, text, uuid, uuid)
from
  public;

grant
execute on function public.assign_citizen_role (uuid, text, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_citizen_role: admin path always works. Nation Manager path is
-- limited to revoking 'settlement_manager' from a player_character in their
-- nation. Always resets the role columns to ('none', null, null).
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
    return;
  end if;

  select * into v_citizen from public.citizens where id = p_citizen_id;
  if v_citizen.id is null then
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
    if v_citizen.role_type <> 'settlement_manager' then
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
    if not public.is_nation_manager_of (v_settlement_nation_id) then
      return;
    end if;
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

revoke all on function public.revoke_citizen_role (uuid)
from
  public;

grant
execute on function public.revoke_citizen_role (uuid) to authenticated;
