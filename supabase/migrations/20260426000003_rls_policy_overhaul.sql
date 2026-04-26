-- Migration: rls_policy_overhaul
-- Tightens and completes RLS policies for users, worlds, and world_admins.
--
-- Changes from the initial migration:
--
--   users
--     BEFORE: any authenticated user can read all user rows.
--     AFTER:  a user can read only their own row, or all rows if super admin.
--
--   worlds
--     REPLACED: worlds_select_admin now uses is_world_admin() (SECURITY
--               DEFINER) instead of a direct world_admins subquery, breaking
--               the cross-table RLS recursion chain.
--     ADDED:    super admin can read, update, and delete any world.
--
--   world_admins
--     BEFORE: select restricted to own rows + world owner rows.
--     AFTER:  select also granted to super admin; owner check uses helper.
--     ADDED:  super admin can insert/delete world_admins rows.
--
-- All new policies use the stable SECURITY DEFINER helpers from migration
-- 20260426000002 to avoid recursive RLS evaluation.
-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
drop policy "users_select_authenticated" on public.users;

-- A user may always read their own profile row.
create policy "users_select_self" on public.users for
select
  to authenticated using (id = auth.uid ());

-- Super admins may read all user profiles.
create policy "users_select_super_admin" on public.users for
select
  to authenticated using (public.is_super_admin ());

-- ---------------------------------------------------------------------------
-- worlds
-- ---------------------------------------------------------------------------
-- Replace worlds_select_admin (from migration 0) with a SECURITY DEFINER
-- helper call to avoid cross-table RLS recursion between worlds and
-- world_admins.
drop policy "worlds_select_admin" on public.worlds;

create policy "worlds_select_admin" on public.worlds for
select
  to authenticated using (public.is_world_admin (id));

-- Super admins may read any world regardless of visibility or ownership.
create policy "worlds_select_super_admin" on public.worlds for
select
  to authenticated using (public.is_super_admin ());

-- Super admins may update any world.
create policy "worlds_update_super_admin" on public.worlds
for update
  to authenticated using (public.is_super_admin ())
with
  check (public.is_super_admin ());

-- Super admins may delete any world.
create policy "worlds_delete_super_admin" on public.worlds for delete to authenticated using (public.is_super_admin ());

-- ---------------------------------------------------------------------------
-- world_admins
-- ---------------------------------------------------------------------------
drop policy "world_admins_select" on public.world_admins;

-- A user may see world_admins rows where they are the listed admin,
-- or where they own the associated world, or when they are a super admin.
create policy "world_admins_select" on public.world_admins for
select
  to authenticated using (
    user_id = auth.uid ()
    or public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

drop policy "world_admins_insert_owner" on public.world_admins;

-- The world owner or a super admin may grant admin access.
create policy "world_admins_insert" on public.world_admins for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

drop policy "world_admins_delete_owner" on public.world_admins;

-- The world owner or a super admin may revoke admin access.
create policy "world_admins_delete" on public.world_admins for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);
