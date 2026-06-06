-- Migration: add_search_users_for_admin_picker_rpc
-- Replaces the broad users_select_world_admin policy (which let every world
-- admin read all columns of every user row, including email) with a narrow
-- SECURITY DEFINER RPC that exposes only id and username. World admins and
-- super admins may call the RPC to populate user pickers; all other callers
-- receive 42501. Regular users continue to see only their own row via
-- users_select_self.
--
-- Addresses Finding B / Q3, Q4 from the permissions review.
-- is_any_world_admin() is kept: the new RPC still references it.
-- ---------------------------------------------------------------------------
-- 1. Drop the wide select policy added in 20260528000000
-- ---------------------------------------------------------------------------
drop policy if exists "users_select_world_admin" on public.users;

-- ---------------------------------------------------------------------------
-- 2. search_users_for_admin_picker
-- ---------------------------------------------------------------------------
-- Returns (id, username) rows for admin user pickers (CitizenLinkedUserControl,
-- Create player character dialog). Searches both username and email columns
-- case-insensitively but never includes email in the result. p_limit is
-- clamped to [1, 50].
create or replace function public.search_users_for_admin_picker (
  p_query text default null,
  p_limit integer default 20
) returns table (id uuid, username text) language plpgsql stable security definer
set
  search_path = '' as $$
begin
  if not (public.is_super_admin () or public.is_any_world_admin ()) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.username
  from
    public.users u
  where (
    p_query is null
    or u.username ilike '%' || p_query || '%'
    or u.email ilike '%' || p_query || '%'
  )
  order by
    u.username
  limit
    least (greatest (coalesce (p_limit, 20), 1), 50);
end;
$$;

revoke all on function public.search_users_for_admin_picker (text, integer)
from
  public;

grant
execute on function public.search_users_for_admin_picker (text, integer) to authenticated;
