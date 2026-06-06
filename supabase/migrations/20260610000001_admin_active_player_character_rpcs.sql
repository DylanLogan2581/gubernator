-- Migration: admin_active_player_character_rpcs
-- Adds SECURITY DEFINER RPCs for super admins to set or clear any user's active
-- player character per world. These are recovery-only functions: the normal
-- user-facing write path is the user's own authenticated upsert/delete; super
-- admins use these RPCs when a user is stuck (orphaned row, unlinked PC, etc.)
-- and cannot self-recover via the app.
--
-- The RPCs bypass the user_active_player_characters RLS INSERT/UPDATE/DELETE
-- policies (which restrict writes to the row owner). The existing BEFORE trigger
-- (user_active_player_characters_validate) still fires on upsert; the RPC's own
-- pre-validation ensures the trigger never raises an error in normal usage.
--
-- Error contract:
--   P0002 (no_data_found)          – citizen not found
--   P0001 (raise_exception)        – citizen exists but is not a living
--                                    player_character linked to the supplied
--                                    user and world (mirrors trigger checks)
--   42501 (insufficient_privilege) – caller is not a super admin
-- ---------------------------------------------------------------------------
-- admin_set_user_active_player_character
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_active_player_character (
  p_user_id uuid,
  p_world_id uuid,
  p_citizen_id uuid
) returns setof public.user_active_player_characters language plpgsql security definer
set
  search_path = '' as $$
declare
  v_citizen public.citizens%rowtype;
begin
  if not public.is_super_admin () then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  select * into v_citizen
  from public.citizens
  where id = p_citizen_id;

  if not found then
    raise exception 'citizen % not found', p_citizen_id
      using errcode = 'P0002';
  end if;

  if v_citizen.citizen_type <> 'player_character' then
    raise exception 'citizen % is not a player character', p_citizen_id
      using errcode = 'P0001';
  end if;

  if v_citizen.user_id is null or v_citizen.user_id <> p_user_id then
    raise exception 'citizen % is not linked to user %', p_citizen_id, p_user_id
      using errcode = 'P0001';
  end if;

  if v_citizen.world_id <> p_world_id then
    raise exception 'citizen % does not belong to world %', p_citizen_id, p_world_id
      using errcode = 'P0001';
  end if;

  if v_citizen.status <> 'alive' then
    raise exception 'citizen % is not alive', p_citizen_id
      using errcode = 'P0001';
  end if;

  insert into
    public.user_active_player_characters (user_id, world_id, citizen_id)
  values (p_user_id, p_world_id, p_citizen_id)
  on conflict (user_id, world_id)
  do update set citizen_id = excluded.citizen_id;

  return query
    select *
    from public.user_active_player_characters
    where user_id = p_user_id
      and world_id = p_world_id;
end;
$$;

revoke all on function public.admin_set_user_active_player_character (uuid, uuid, uuid)
from
  public;

grant
execute on function public.admin_set_user_active_player_character (uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_clear_user_active_player_character
-- ---------------------------------------------------------------------------
create or replace function public.admin_clear_user_active_player_character (p_user_id uuid, p_world_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
begin
  if not public.is_super_admin () then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  delete from public.user_active_player_characters
  where user_id = p_user_id
    and world_id = p_world_id;
end;
$$;

revoke all on function public.admin_clear_user_active_player_character (uuid, uuid)
from
  public;

grant
execute on function public.admin_clear_user_active_player_character (uuid, uuid) to authenticated;
