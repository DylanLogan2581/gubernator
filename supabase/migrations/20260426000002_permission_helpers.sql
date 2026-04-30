-- Migration: permission_helpers
-- Reusable SQL functions for application-level permission checks.
--
-- All helper functions are:
--   SECURITY DEFINER  – run as function owner, bypassing RLS to avoid
--                       recursive policy evaluation.
--   SET search_path = '' – prevents search_path injection attacks.
--   STABLE            – safe for inlining in RLS policies and query planning.
--
-- ---------------------------------------------------------------------------
-- 1. Super-admin flag on public.users
-- ---------------------------------------------------------------------------
-- is_super_admin is intentionally not settable by authenticated API callers.
-- A trigger below enforces this.  Only direct DB access or a service-role
-- Edge Function may grant super-admin status.
alter table public.users
add column is_super_admin boolean not null default false;

-- Guard: prevent authenticated (API-layer) callers from self-elevating.
-- SECURITY INVOKER (the default) is intentional: the trigger must run under
-- the calling role so that current_role reflects 'authenticated' vs 'postgres'.
create or replace function public.prevent_super_admin_self_elevation () returns trigger language plpgsql
set
  search_path = '' as $$
begin
  if
    current_role = 'authenticated'
    and old.is_super_admin is distinct from new.is_super_admin
  then
    raise exception 'forbidden: is_super_admin may only be changed by a privileged caller'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger users_prevent_super_admin_self_elevation before
update on public.users for each row
execute function public.prevent_super_admin_self_elevation ();

-- ---------------------------------------------------------------------------
-- 2. current_app_user_id()
-- ---------------------------------------------------------------------------
-- Returns the UUID of the currently authenticated application user, or NULL
-- when called outside an authenticated session.  Thin wrapper over auth.uid()
-- so that callers depend only on the public schema helper.
create or replace function public.current_app_user_id () returns uuid language sql stable security definer
set
  search_path = '' as $$
  select auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- 3. is_super_admin()
-- ---------------------------------------------------------------------------
-- Returns TRUE when the current authenticated user has super-admin status
-- and an active account.
create or replace function public.is_super_admin () returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and is_super_admin = true
      and status = 'active'
  )
$$;

-- ---------------------------------------------------------------------------
-- 4. is_world_admin(p_world_id)
-- ---------------------------------------------------------------------------
-- Returns TRUE when the current user is the world owner OR holds an explicit
-- row in world_admins for that world.
create or replace function public.is_world_admin (p_world_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    exists (
      select 1
      from public.worlds
      where id = p_world_id
        and owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.world_admins
      where world_id = p_world_id
        and user_id = auth.uid()
    )
$$;

-- ---------------------------------------------------------------------------
-- 5. has_world_access(p_world_id)
-- ---------------------------------------------------------------------------
-- Returns TRUE when the current user is permitted to read the world:
--   • world is public, OR
--   • current user is the world owner, OR
--   • current user holds an explicit world_admins row, OR
--   • current user is a super admin.
create or replace function public.has_world_access (p_world_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    exists (
      select 1
      from public.worlds
      where id = p_world_id
        and (
          visibility = 'public'
          or owner_id = auth.uid()
        )
    )
    or public.is_world_admin(p_world_id)
    or public.is_super_admin()
$$;
