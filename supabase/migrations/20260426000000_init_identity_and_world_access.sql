-- Migration: init_identity_and_world_access
-- Creates the foundational tables for user identity and world access control.
-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at () returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
-- Mirrors auth.users with application-level profile data.
-- id is intentionally the same UUID as auth.users.id.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_username_key unique (username),
  constraint users_status_check check (status in ('active', 'suspended', 'deleted'))
);

create trigger users_set_updated_at before
update on public.users for each row
execute function public.set_updated_at ();

alter table public.users enable row level security;

-- Any authenticated user can read profiles (needed for world membership lookups).
create policy "users_select_authenticated" on public.users for
select
  to authenticated using (true);

-- Users may only update their own profile.
create policy "users_update_own" on public.users
for update
  to authenticated using (id = auth.uid ())
with
  check (id = auth.uid ());

-- ---------------------------------------------------------------------------
-- worlds
-- ---------------------------------------------------------------------------
create table public.worlds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.users (id) on delete restrict,
  current_turn_number integer not null default 0,
  visibility text not null default 'private',
  status text not null default 'active',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worlds_name_length_check check (char_length(name) >= 1),
  constraint worlds_turn_number_check check (current_turn_number >= 0),
  constraint worlds_visibility_check check (visibility in ('public', 'private')),
  constraint worlds_status_check check (status in ('active', 'archived')),
  constraint worlds_archived_at_consistency check (
    (
      status = 'archived'
      and archived_at is not null
    )
    or (
      status != 'archived'
      and archived_at is null
    )
  )
);

create index worlds_owner_id_idx on public.worlds (owner_id);

create trigger worlds_set_updated_at before
update on public.worlds for each row
execute function public.set_updated_at ();

alter table public.worlds enable row level security;

-- Owners always see their own worlds.
create policy "worlds_select_owner" on public.worlds for
select
  to authenticated using (owner_id = auth.uid ());

-- Public worlds are readable by any authenticated user.
create policy "worlds_select_public" on public.worlds for
select
  to authenticated using (visibility = 'public');

-- World admins can see the worlds they administer.
create policy "worlds_select_admin" on public.worlds for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.world_admins wa
      where
        wa.world_id = id
        and wa.user_id = auth.uid ()
    )
  );

-- Any authenticated user may create a world (they become the owner).
create policy "worlds_insert_authenticated" on public.worlds for insert to authenticated
with
  check (owner_id = auth.uid ());

-- Only the owner may update their world.
create policy "worlds_update_owner" on public.worlds
for update
  to authenticated using (owner_id = auth.uid ())
with
  check (owner_id = auth.uid ());

-- Only the owner may delete their world.
create policy "worlds_delete_owner" on public.worlds for delete to authenticated using (owner_id = auth.uid ());

-- ---------------------------------------------------------------------------
-- world_admins
-- ---------------------------------------------------------------------------
create table public.world_admins (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint world_admins_world_user_key unique (world_id, user_id)
);

create index world_admins_world_id_idx on public.world_admins (world_id);

create index world_admins_user_id_idx on public.world_admins (user_id);

alter table public.world_admins enable row level security;

-- World owners and the admin themselves can read world_admins rows.
create policy "world_admins_select" on public.world_admins for
select
  to authenticated using (
    user_id = auth.uid ()
    or exists (
      select
        1
      from
        public.worlds w
      where
        w.id = world_id
        and w.owner_id = auth.uid ()
    )
  );

-- Only the world owner may grant admin access.
create policy "world_admins_insert_owner" on public.world_admins for insert to authenticated
with
  check (
    exists (
      select
        1
      from
        public.worlds w
      where
        w.id = world_id
        and w.owner_id = auth.uid ()
    )
  );

-- Only the world owner may revoke admin access.
create policy "world_admins_delete_owner" on public.world_admins for delete to authenticated using (
  exists (
    select
      1
    from
      public.worlds w
    where
      w.id = world_id
      and w.owner_id = auth.uid ()
  )
);
