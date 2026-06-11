-- Migration: fix_is_world_admin_super_admin
-- After 20260611000001 removed owner_id, is_world_admin only checked the
-- world_admins table and no longer short-circuited for super admins.
-- This caused super admins without an explicit world_admins row to be denied
-- when any SQL helper (current_user_manages_nation, RLS policies, etc.) called
-- is_world_admin directly. Fix: add is_super_admin() to the predicate so that
-- any active super admin returns true regardless of world_admins membership.
create or replace function public.is_world_admin (p_world_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    public.is_active_app_user ()
    and (
      public.is_super_admin ()
      or exists (
        select 1
        from public.world_admins
        where world_id = p_world_id
          and user_id = auth.uid ()
      )
    )
$$;
