-- Migration: superadmin_privilege_rpcs
-- Adds server-side RPCs for superadmin privilege management.
--
-- All functions are SECURITY DEFINER (run as the postgres owner) so they can
-- bypass the prevent_super_admin_self_elevation trigger, which runs as
-- SECURITY INVOKER and only blocks the 'authenticated' role.  Each function
-- first verifies the caller holds an active super-admin account before
-- performing any privileged action.
--
-- grant_world_admin(p_user_id, p_world_id)  — upsert a world_admins row
-- revoke_world_admin(p_user_id, p_world_id) — delete the world_admins row
-- set_user_super_admin(p_user_id, p_value)   — flip is_super_admin; blocks
--                                              removing the last superadmin
-- ---------------------------------------------------------------------------
-- grant_world_admin
-- ---------------------------------------------------------------------------
create or replace function public.grant_world_admin (p_user_id uuid, p_world_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
begin
  if not public.is_super_admin () then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  insert into
    public.world_admins (world_id, user_id)
  values (p_world_id, p_user_id) on conflict (world_id, user_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- revoke_world_admin
-- ---------------------------------------------------------------------------
create or replace function public.revoke_world_admin (p_user_id uuid, p_world_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
begin
  if not public.is_super_admin () then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  delete from public.world_admins
  where
    world_id = p_world_id
    and user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_user_super_admin
-- ---------------------------------------------------------------------------
-- When p_value = false, rejects the call if the target user is the last
-- remaining active superadmin in the system.
create or replace function public.set_user_super_admin (p_user_id uuid, p_value boolean) returns void language plpgsql security definer
set
  search_path = '' as $$
begin
  if not public.is_super_admin () then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if not p_value then
    if (
      select
        count(*)
      from
        public.users
      where
        is_super_admin = true
        and status = 'active'
    ) <= 1 then
      raise exception 'cannot remove the last remaining superadmin'
        using errcode = 'P0001';
    end if;
  end if;

  update public.users
  set
    is_super_admin = p_value
  where
    id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execution grants: revoke from public, grant execute to authenticated, in
-- line with other privileged RPCs (e.g. rename_world, create_world).
-- ---------------------------------------------------------------------------
revoke all on function public.grant_world_admin (uuid, uuid)
from
  public;

grant
execute on function public.grant_world_admin (uuid, uuid) to authenticated;

revoke all on function public.revoke_world_admin (uuid, uuid)
from
  public;

grant
execute on function public.revoke_world_admin (uuid, uuid) to authenticated;

revoke all on function public.set_user_super_admin (uuid, boolean)
from
  public;

grant
execute on function public.set_user_super_admin (uuid, boolean) to authenticated;
