-- Migration: auth_user_sync
-- Keeps public.users in sync with auth.users via database triggers.
--
-- After this migration:
--   - Every new auth.users INSERT creates a matching public.users row.
--   - Email changes in auth.users propagate to public.users.
--   - Any auth.users rows that already exist without a profile row are backfilled.
-- ---------------------------------------------------------------------------
-- 1. Add email column to public.users
-- ---------------------------------------------------------------------------
-- Added as nullable so any pre-existing rows survive without a default value.
-- The backfill step below sets email for all existing rows before the NOT NULL
-- constraint and unique index are applied.
alter table public.users
add column email text;

-- Backfill existing users from auth.users before tightening the column.
update public.users u
set
  email = au.email
from
  auth.users au
where
  u.id = au.id
  and u.email is null;

alter table public.users
alter column email
set not null,
add constraint users_email_key unique (email);

-- ---------------------------------------------------------------------------
-- 2. Trigger: new auth user → insert public.users row
-- ---------------------------------------------------------------------------
-- security definer: runs as the function owner so it can write public.users
--   from within the auth schema trigger context.
-- set search_path = '': guards against search_path injection.
create or replace function public.handle_new_auth_user () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  insert into
    public.users (id, email, username, status)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'username'), ''),
      'user_' || substring(new.id::text, 1, 8)
    ),
    'active'
  ) on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row
execute function public.handle_new_auth_user ();

-- ---------------------------------------------------------------------------
-- 3. Trigger: auth email change → update public.users email
-- ---------------------------------------------------------------------------
create or replace function public.handle_auth_user_email_update () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  update public.users
  set
    email = new.email
  where
    id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_email_updated
after
update of email on auth.users for each row when (old.email is distinct from new.email)
execute function public.handle_auth_user_email_update ();

-- ---------------------------------------------------------------------------
-- 4. Backfill: create public.users rows for existing auth.users without one
-- ---------------------------------------------------------------------------
-- Runs after the trigger is in place. Uses ON CONFLICT to be idempotent.
insert into
  public.users (id, email, username, status)
select
  id,
  email,
  'user_' || substring(id::text, 1, 8),
  'active'
from
  auth.users
on conflict (id) do nothing;
