-- pgTAP tests for the world-images storage bucket RLS policies (#1008).
-- Run with: npx supabase test db
--
-- Covers the read-side authorization split (world admin / member vs
-- non-member vs anon) and the write-side admin-only enforcement, proving the
-- policies gate storage.objects directly rather than relying on the client
-- to behave.
begin;

select
  plan (8);

-- storage.objects has a blanket "no direct SQL delete" trigger guarding
-- against accidental data loss (storage.protect_delete); the Storage API
-- backend lifts it per-request via this GUC before applying RLS. Set it once
-- so the delete assertions below actually exercise the admin-only delete
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
    'world-images-admin@example.com',
    'x',
    now(),
    '{"username":"world_images_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'world-images-outsider@example.com',
    'x',
    now(),
    '{"username":"world_images_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status, current_turn_number)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'World Images World',
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

-- Seeded directly as the table owner (bypasses RLS), mirroring how the
-- upload mutation would leave a row behind after a successful upload.
insert into
  storage.objects (bucket_id, name, owner, metadata)
values
  (
    'world-images',
    'f2000000-0000-0000-0000-000000000001/thumbnail.webp',
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
        bucket_id = 'world-images'
    ),
    0,
    'anon cannot read any world-images object'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: authenticated, but neither a member nor an admin of the world
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
        bucket_id = 'world-images'
        and name = 'f2000000-0000-0000-0000-000000000001/thumbnail.webp'
    ),
    0,
    'a non-member cannot read another world''s thumbnail'
  );

select
  throws_ok (
    $test$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'world-images',
      'f2000000-0000-0000-0000-000000000001/hero.webp',
      'f1000000-0000-0000-0000-000000000002'
    )
    $test$,
    null,
    null,
    'a non-admin cannot upload into another world''s image path'
  );

-- RLS denies a delete by simply matching zero rows, not by raising, so run
-- it, then check survival as postgres (below) rather than expecting an error
-- or re-reading as the outsider (who can't see the row either way — see the
-- read assertion above).
delete from storage.objects
where
  bucket_id = 'world-images'
  and name = 'f2000000-0000-0000-0000-000000000001/thumbnail.webp';

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        storage.objects
      where
        bucket_id = 'world-images'
        and name = 'f2000000-0000-0000-0000-000000000001/thumbnail.webp'
    ),
    1,
    'a non-admin''s delete of another world''s thumbnail matches no rows'
  );

-- ===========================================================================
-- WORLD ADMIN: full read, and admin-gated write, on their own world's images
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
        bucket_id = 'world-images'
        and name = 'f2000000-0000-0000-0000-000000000001/thumbnail.webp'
    ),
    1,
    'the world admin can read their world''s thumbnail'
  );

select
  throws_ok (
    $test$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'world-images',
      'f2000000-0000-0000-0000-000000000001/not-a-valid-name.webp',
      'f1000000-0000-0000-0000-000000000001'
    )
    $test$,
    null,
    null,
    'the world admin cannot upload a file outside the thumbnail/hero path convention'
  );

select
  lives_ok (
    $test$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'world-images',
      'f2000000-0000-0000-0000-000000000001/hero.webp',
      'f1000000-0000-0000-0000-000000000001'
    )
    $test$,
    'the world admin can upload their world''s hero image'
  );

delete from storage.objects
where
  bucket_id = 'world-images'
  and name = 'f2000000-0000-0000-0000-000000000001/thumbnail.webp';

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        storage.objects
      where
        bucket_id = 'world-images'
        and name = 'f2000000-0000-0000-0000-000000000001/thumbnail.webp'
    ),
    0,
    'the world admin''s delete of their world''s thumbnail actually removes it'
  );

select
  *
from
  finish ();

rollback;
