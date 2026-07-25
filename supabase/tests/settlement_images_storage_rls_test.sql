-- pgTAP tests for the settlement-images storage bucket RLS policies and the
-- set_settlement_flag_path / set_settlement_seal_path RPCs (#1373). Run with:
-- npx supabase test db
--
-- Mirrors nation_images_storage_rls_test.sql: covers the read-side split
-- (member vs non-member vs anon) and the write-side manager-or-admin
-- enforcement (world admin AND the settlement's own settlement_manager citizen
-- can write; a bystander cannot), plus that the filename regex admits both
-- "flag.<ext>" and "seal.<ext>", proving the policies gate storage.objects
-- directly. Also covers the two set-path RPCs settlements.flag_path/seal_path
-- are written through (settlements_update_world_admin does not grant settlement
-- managers direct UPDATE).
begin;

select
  plan (15);

-- storage.objects has a blanket "no direct SQL delete" trigger
-- (storage.protect_delete); the Storage API backend lifts it per-request via
-- this GUC before applying RLS. Set it once so the delete assertions exercise
-- the manager-only delete policy rather than only re-proving the blanket guard.
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
    'd1000000-0000-0000-0000-000000000001',
    'settlement-images-admin@example.com',
    'x',
    now(),
    '{"username":"settlement_images_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'settlement-images-outsider@example.com',
    'x',
    now(),
    '{"username":"settlement_images_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'settlement-images-manager@example.com',
    'x',
    now(),
    '{"username":"settlement_images_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status, current_turn_number)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'Settlement Images World',
    'active',
    5
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'd3000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Settlement Images Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd5000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000001',
    'Settlement Images Town'
  );

-- The manager's alive player_character holds the settlement_manager role on
-- the subject settlement, without being a world admin.
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_settlement_id
  )
values
  (
    'd4000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'player_character',
    'Settlement Images Manager',
    'alive',
    'd1000000-0000-0000-0000-000000000003',
    'settlement_manager',
    'd5000000-0000-0000-0000-000000000001'
  );

-- Seeded directly as the table owner (bypasses RLS), mirroring how the upload
-- mutation would leave a row behind after a successful upload.
insert into
  storage.objects (bucket_id, name, owner, metadata)
values
  (
    'settlement-images',
    'd5000000-0000-0000-0000-000000000001/flag.webp',
    'd1000000-0000-0000-0000-000000000001',
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
        bucket_id = 'settlement-images'
    ),
    0,
    'anon cannot read any settlement-images object'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: authenticated, but neither a member, manager, nor admin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        storage.objects
      where
        bucket_id = 'settlement-images'
        and name = 'd5000000-0000-0000-0000-000000000001/flag.webp'
    ),
    0,
    'a non-member cannot read another settlement''s flag'
  );

select
  throws_ok (
    $test$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'settlement-images',
      'd5000000-0000-0000-0000-000000000001/flag.webp',
      'd1000000-0000-0000-0000-000000000002'
    )
    $test$,
    null,
    null,
    'a non-manager cannot upload into another settlement''s flag path'
  );

delete from storage.objects
where
  bucket_id = 'settlement-images'
  and name = 'd5000000-0000-0000-0000-000000000001/flag.webp';

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        storage.objects
      where
        bucket_id = 'settlement-images'
        and name = 'd5000000-0000-0000-0000-000000000001/flag.webp'
    ),
    1,
    'a non-manager''s delete of another settlement''s flag matches no rows'
  );

-- ===========================================================================
-- WORLD ADMIN: full read, and manager-gated write, on the settlement's flag
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        storage.objects
      where
        bucket_id = 'settlement-images'
        and name = 'd5000000-0000-0000-0000-000000000001/flag.webp'
    ),
    1,
    'the world admin can read the settlement''s flag'
  );

select
  throws_ok (
    $test$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'settlement-images',
      'd5000000-0000-0000-0000-000000000001/not-a-valid-name.webp',
      'd1000000-0000-0000-0000-000000000001'
    )
    $test$,
    null,
    null,
    'the world admin cannot upload a file outside the flag/seal path convention'
  );

select
  throws_ok (
    $test$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'settlement-images',
      'd5000000-0000-0000-0000-000000000001/a/flag.webp',
      'd1000000-0000-0000-0000-000000000001'
    )
    $test$,
    null,
    null,
    'the world admin cannot upload a nested path even with a valid filename'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: not a world admin, but can write their settlement's
-- flag and seal.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        storage.objects
      where
        bucket_id = 'settlement-images'
        and name = 'd5000000-0000-0000-0000-000000000001/flag.webp'
    ),
    1,
    'the settlement manager can read their settlement''s flag'
  );

select
  lives_ok (
    $test$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'settlement-images',
      'd5000000-0000-0000-0000-000000000001/seal.webp',
      'd1000000-0000-0000-0000-000000000003'
    )
    $test$,
    'the settlement manager can upload a seal alongside the flag'
  );

select
  lives_ok (
    $test$
    update storage.objects
    set owner = 'd1000000-0000-0000-0000-000000000003'
    where bucket_id = 'settlement-images'
      and name = 'd5000000-0000-0000-0000-000000000001/flag.webp'
    $test$,
    'the settlement manager can replace their settlement''s flag'
  );

delete from storage.objects
where
  bucket_id = 'settlement-images'
  and name = 'd5000000-0000-0000-0000-000000000001/flag.webp';

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        storage.objects
      where
        bucket_id = 'settlement-images'
        and name = 'd5000000-0000-0000-0000-000000000001/flag.webp'
    ),
    0,
    'the settlement manager''s delete of their settlement''s flag actually removes it'
  );

-- ===========================================================================
-- set_settlement_flag_path / set_settlement_seal_path RPCs.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_settlement_flag_path(
      'd5000000-0000-0000-0000-000000000001'::uuid,
      'd5000000-0000-0000-0000-000000000001/flag.webp'
    )
    $test$,
    '42501',
    null,
    'an outsider cannot set the settlement''s flag_path'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_settlement_flag_path(
      'd5000000-0000-0000-0000-000000000001'::uuid,
      'd9000000-0000-0000-0000-000000000099/flag.webp'
    )
    $test$,
    '22023',
    null,
    'the settlement manager cannot point flag_path at another settlement''s prefix'
  );

select
  public.set_settlement_flag_path (
    'd5000000-0000-0000-0000-000000000001'::uuid,
    'd5000000-0000-0000-0000-000000000001/flag.webp'
  );

select
  public.set_settlement_seal_path (
    'd5000000-0000-0000-0000-000000000001'::uuid,
    'd5000000-0000-0000-0000-000000000001/seal.webp'
  );

reset role;

select
  is (
    (
      select
        flag_path
      from
        public.settlements
      where
        id = 'd5000000-0000-0000-0000-000000000001'
    ),
    'd5000000-0000-0000-0000-000000000001/flag.webp',
    'the settlement manager can set flag_path via the RPC'
  );

select
  is (
    (
      select
        seal_path
      from
        public.settlements
      where
        id = 'd5000000-0000-0000-0000-000000000001'
    ),
    'd5000000-0000-0000-0000-000000000001/seal.webp',
    'the settlement manager can set seal_path via the RPC'
  );

select
  *
from
  finish ();

rollback;
