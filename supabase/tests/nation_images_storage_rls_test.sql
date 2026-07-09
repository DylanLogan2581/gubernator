-- pgTAP tests for the nation-images storage bucket RLS policies and the
-- set_nation_flag_path RPC (#1072, #1148). Run with: npx supabase test db
--
-- Covers the read-side authorization split (member vs non-member vs anon)
-- and the write-side manager-or-admin enforcement (world admin AND the
-- nation's own nation_manager citizen can write; a bystander cannot), proving
-- the policies gate storage.objects directly rather than relying on the
-- client to behave. Also covers set_nation_flag_path, the SECURITY DEFINER
-- RPC nations.flag_path is written through (nations_update_world_admin does
-- not grant nation managers direct UPDATE — see
-- nation_capital_and_founded_turn_test.sql for the same pattern on
-- capital_settlement_id/founded_turn_number).
--
-- #1148 additionally covers: the insert/update policies reject a
-- well-formed filename nested under extra path segments (own-nation write,
-- but unbounded object litter), and set_nation_flag_path rejects a flag_path
-- pointing at another nation's prefix (in-world display spoofing).
begin;

select
  plan (14);

-- storage.objects has a blanket "no direct SQL delete" trigger guarding
-- against accidental data loss (storage.protect_delete); the Storage API
-- backend lifts it per-request via this GUC before applying RLS. Set it once
-- so the delete assertions below actually exercise the manager-only delete
-- policy instead of only re-proving the blanket guard.
set
  local "storage.allow_delete_query" = 'true';

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
    'f1000000-0000-0000-0000-000000000001',
    'nation-images-admin@example.com',
    'x',
    now(),
    '{"username":"nation_images_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'nation-images-outsider@example.com',
    'x',
    now(),
    '{"username":"nation_images_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000003',
    'nation-images-manager@example.com',
    'x',
    now(),
    '{"username":"nation_images_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, current_turn_number)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'Nation Images World',
    'private',
    'active',
    5
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Nation Images Nation'
  );

-- The manager's alive player_character holds the nation_manager role on the
-- subject nation, without being a world admin.
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_nation_id
  )
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'player_character',
    'Nation Images Manager',
    'alive',
    'f1000000-0000-0000-0000-000000000003',
    'nation_manager',
    'f3000000-0000-0000-0000-000000000001'
  );

-- Seeded directly as the table owner (bypasses RLS), mirroring how the
-- upload mutation would leave a row behind after a successful upload.
insert into
  storage.objects (bucket_id, name, owner, metadata)
values
  (
    'nation-images',
    'f3000000-0000-0000-0000-000000000001/flag.webp',
    'f1000000-0000-0000-0000-000000000001',
    '{"mimetype":"image/webp"}'::jsonb
  );

-- ===========================================================================
-- ANON: no access to any object in the bucket
-- ===========================================================================
set
  local role anon;

select
  is (
    (
      select
        count(*)::integer
      from
        storage.objects
      where
        bucket_id = 'nation-images'
    ),
    0,
    'anon cannot read any nation-images object'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: authenticated, but neither a member, manager, nor admin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        storage.objects
      where
        bucket_id = 'nation-images'
        and name = 'f3000000-0000-0000-0000-000000000001/flag.webp'
    ),
    0,
    'a non-member cannot read another nation''s flag'
  );

select
  throws_ok (
    $test$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'nation-images',
      'f3000000-0000-0000-0000-000000000001/flag.webp',
      'f1000000-0000-0000-0000-000000000002'
    )
    $test$,
    null,
    null,
    'a non-manager cannot upload into another nation''s flag path'
  );

-- RLS denies a delete by simply matching zero rows, not by raising, so run
-- it, then check survival as postgres (below) rather than expecting an error
-- or re-reading as the outsider (who can't see the row either way — see the
-- read assertion above).
delete from storage.objects
where
  bucket_id = 'nation-images'
  and name = 'f3000000-0000-0000-0000-000000000001/flag.webp';

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        storage.objects
      where
        bucket_id = 'nation-images'
        and name = 'f3000000-0000-0000-0000-000000000001/flag.webp'
    ),
    1,
    'a non-manager''s delete of another nation''s flag matches no rows'
  );

-- ===========================================================================
-- WORLD ADMIN: full read, and manager-gated write, on the nation's flag
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        storage.objects
      where
        bucket_id = 'nation-images'
        and name = 'f3000000-0000-0000-0000-000000000001/flag.webp'
    ),
    1,
    'the world admin can read the nation''s flag'
  );

select
  throws_ok (
    $test$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'nation-images',
      'f3000000-0000-0000-0000-000000000001/not-a-valid-name.webp',
      'f1000000-0000-0000-0000-000000000001'
    )
    $test$,
    null,
    null,
    'the world admin cannot upload a file outside the flag path convention'
  );

select
  throws_ok (
    $test$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'nation-images',
      'f3000000-0000-0000-0000-000000000001/a/flag.webp',
      'f1000000-0000-0000-0000-000000000001'
    )
    $test$,
    null,
    null,
    'the world admin cannot upload a nested path even with a valid filename'
  );

reset role;

-- ===========================================================================
-- NATION MANAGER: not a world admin, but can write their own nation's flag
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        storage.objects
      where
        bucket_id = 'nation-images'
        and name = 'f3000000-0000-0000-0000-000000000001/flag.webp'
    ),
    1,
    'the nation manager can read their nation''s flag'
  );

select
  lives_ok (
    $test$
    update storage.objects
    set owner = 'f1000000-0000-0000-0000-000000000003'
    where bucket_id = 'nation-images'
      and name = 'f3000000-0000-0000-0000-000000000001/flag.webp'
    $test$,
    'the nation manager can replace their nation''s flag'
  );

select
  throws_ok (
    $test$
    update storage.objects
    set name = 'f3000000-0000-0000-0000-000000000001/a/flag.webp'
    where bucket_id = 'nation-images'
      and name = 'f3000000-0000-0000-0000-000000000001/flag.webp'
    $test$,
    null,
    null,
    'the nation manager cannot rename their flag into a nested path'
  );

delete from storage.objects
where
  bucket_id = 'nation-images'
  and name = 'f3000000-0000-0000-0000-000000000001/flag.webp';

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        storage.objects
      where
        bucket_id = 'nation-images'
        and name = 'f3000000-0000-0000-0000-000000000001/flag.webp'
    ),
    0,
    'the nation manager''s delete of their nation''s flag actually removes it'
  );

-- ===========================================================================
-- set_nation_flag_path RPC: outsider denied, nation manager can write.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_nation_flag_path(
      'f3000000-0000-0000-0000-000000000001'::uuid,
      'f3000000-0000-0000-0000-000000000001/flag.webp'
    )
    $test$,
    '42501',
    null,
    'an outsider cannot set the nation''s flag_path'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_nation_flag_path(
      'f3000000-0000-0000-0000-000000000001'::uuid,
      'f9000000-0000-0000-0000-000000000099/flag.webp'
    )
    $test$,
    '22023',
    null,
    'the nation manager cannot point flag_path at another nation''s prefix'
  );

select
  public.set_nation_flag_path (
    'f3000000-0000-0000-0000-000000000001'::uuid,
    'f3000000-0000-0000-0000-000000000001/flag.webp'
  );

reset role;

select
  is (
    (
      select
        flag_path
      from
        public.nations
      where
        id = 'f3000000-0000-0000-0000-000000000001'
    ),
    'f3000000-0000-0000-0000-000000000001/flag.webp',
    'the nation manager can set flag_path via the RPC'
  );

select
  *
from
  finish ();

rollback;
