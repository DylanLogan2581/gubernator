-- Migration: add_users_select_world_admin
-- Adds a new RLS policy on public.users so that world owners and explicit
-- world admins can read all user rows. This unblocks the "Link user" picker
-- in CitizenLinkedUserControl and the "Create player character" dialog for
-- the world-admin role tier, which previously saw only their own row because
-- the only select policies were users_select_self and users_select_super_admin.
--
-- Adds the is_any_world_admin() helper (SECURITY DEFINER, STABLE) following
-- the convention established in 20260426000002_permission_helpers.sql and
-- extended in 20260427000001_require_active_world_access.sql. The helper
-- wraps is_active_app_user() so suspended/deleted users are denied even when
-- they still own a world or hold a world_admins row.
-- ---------------------------------------------------------------------------
-- 1. is_any_world_admin()
-- ---------------------------------------------------------------------------
-- Returns TRUE when the current user is an active app user who owns at least
-- one world or holds an explicit world_admins row for any world.
create or replace function public.is_any_world_admin () returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    public.is_active_app_user ()
    and (
      exists (
        select 1
        from public.worlds
        where owner_id = auth.uid ()
      )
      or exists (
        select 1
        from public.world_admins
        where user_id = auth.uid ()
      )
    )
$$;

revoke all on function public.is_any_world_admin ()
from
  public;

grant
execute on function public.is_any_world_admin () to authenticated;

-- ---------------------------------------------------------------------------
-- 2. users_select_world_admin policy
-- ---------------------------------------------------------------------------
-- World owners and explicit world admins may read all user profiles so that
-- user pickers (Link user, Create player character) are fully populated.
create policy "users_select_world_admin" on public.users for
select
  to authenticated using (public.is_any_world_admin ());
