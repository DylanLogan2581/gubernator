-- Migration: restrict_user_self_updates
-- Limits browser-authenticated updates on public.users to explicit
-- self-service profile fields. System-owned account state remains writable only
-- through privileged database paths, including Auth sync triggers.
-- ---------------------------------------------------------------------------
-- 1. Tighten self-update policy
-- ---------------------------------------------------------------------------
drop policy if exists "users_update_own" on public.users;

-- Active users may update only their own profile row. Suspended or deleted
-- users are intentionally excluded so they cannot reactivate themselves.
create policy "users_update_own" on public.users
for update
  to authenticated using (
    id = auth.uid ()
    and status = 'active'
  )
with
  check (
    id = auth.uid ()
    and status = 'active'
  );

-- ---------------------------------------------------------------------------
-- 2. Guard system-owned columns from authenticated API callers
-- ---------------------------------------------------------------------------
-- The trigger name sorts after users_prevent_super_admin_self_elevation and
-- before users_set_updated_at, preserving the existing super-admin error while
-- still rejecting caller-written updated_at values before the timestamp helper
-- overwrites updated_at for legitimate profile updates.
create or replace function public.restrict_user_self_service_update () returns trigger language plpgsql
set
  search_path = '' as $$
begin
  if
    current_role = 'authenticated'
    and (
      old.id is distinct from new.id
      or old.email is distinct from new.email
      or old.status is distinct from new.status
      or old.is_super_admin is distinct from new.is_super_admin
      or old.created_at is distinct from new.created_at
      or old.updated_at is distinct from new.updated_at
    )
  then
    raise exception 'forbidden: authenticated users may update only self-service profile fields'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger users_restrict_self_service_update before
update on public.users for each row
execute function public.restrict_user_self_service_update ();
