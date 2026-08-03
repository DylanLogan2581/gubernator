-- pgTAP tests for 20261029000000_grant_world_image_path_update migration.
-- Run with: npx supabase test db
--
-- Before this migration, hero_path/thumbnail_path only had column-level
-- SELECT/REFERENCES grants, so any UPDATE targeting them raised
-- "permission denied for table worlds" before RLS was even evaluated --
-- regardless of role. Covers:
--   • Super admin (no world_admins row) can update hero_path/thumbnail_path
--   • World admin can update hero_path/thumbnail_path (regression)
--   • Authenticated stranger (no admin role) cannot update the world
begin;

select
  plan (3);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into
  auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  )
values
  (
    'c1000000-0000-0000-0000-000000000001',
    'wip-super@example.com',
    'x',
    now(),
    '{"username":"wip_super"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'wip-admin@example.com',
    'x',
    now(),
    '{"username":"wip_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'wip-stranger@example.com',
    'x',
    now(),
    '{"username":"wip_stranger"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'c1000000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, status)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'World Image Perms World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000002'
  );

-- ===========================================================================
-- Super admin (no world_admins row for this world): can update image paths
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    update public.worlds
    set
      hero_path = 'c2000000-0000-0000-0000-000000000001/hero.webp',
      thumbnail_path = 'c2000000-0000-0000-0000-000000000001/thumbnail.webp'
    where id = 'c2000000-0000-0000-0000-000000000001'
  $test$,
    'super admin without a world_admins row can update hero_path/thumbnail_path'
  );

reset role;

-- ===========================================================================
-- World admin: can update image paths (regression)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    update public.worlds
    set thumbnail_path = 'c2000000-0000-0000-0000-000000000001/thumbnail.webp'
    where id = 'c2000000-0000-0000-0000-000000000001'
  $test$,
    'world admin can update thumbnail_path'
  );

reset role;

-- ===========================================================================
-- Stranger (no admin role): cannot update the world (RLS blocks the row).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

update public.worlds
set
  hero_path = 'c2000000-0000-0000-0000-000000000001/hero.webp'
where
  id = 'c2000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        hero_path
      from
        public.worlds
      where
        id = 'c2000000-0000-0000-0000-000000000001'
    ),
    'c2000000-0000-0000-0000-000000000001/hero.webp'::text,
    'authenticated stranger with no admin role cannot update the world (value unchanged)'
  );

select
  *
from
  finish ();

rollback;
