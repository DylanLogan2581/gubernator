-- pgTAP tests for the nation seal added in 20261210000000_add_nation_seal_image.sql
-- (#1373). The seal reuses the nation-images bucket and the manager-scoped
-- write authority already proven by nation_images_storage_rls_test.sql, so
-- this file focuses on what the seal migration adds: the widened insert
-- filename regex admits "seal.<ext>", and set_nation_seal_path enforces the
-- same manager-only / own-prefix guards as set_nation_flag_path. Run with:
-- npx supabase test db
begin;

select
  plan (4);

-- ---------------------------------------------------------------------------
-- Fixtures: a world admin, an outsider, and the nation's own manager.
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
    'e1000000-0000-0000-0000-000000000002',
    'nation-seal-outsider@example.com',
    'x',
    now(),
    '{"username":"nation_seal_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'nation-seal-manager@example.com',
    'x',
    now(),
    '{"username":"nation_seal_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status, current_turn_number)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Nation Seal World',
    'active',
    5
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Nation Seal Nation'
  );

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
    'e4000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'player_character',
    'Nation Seal Manager',
    'alive',
    'e1000000-0000-0000-0000-000000000003',
    'nation_manager',
    'e3000000-0000-0000-0000-000000000001'
  );

-- ===========================================================================
-- SEAL UPLOAD: the widened insert regex admits a "seal.<ext>" filename.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'nation-images',
      'e3000000-0000-0000-0000-000000000001/seal.webp',
      'e1000000-0000-0000-0000-000000000003'
    )
    $test$,
    'the nation manager can upload a seal into their nation''s prefix'
  );

reset role;

-- ===========================================================================
-- set_nation_seal_path RPC: outsider denied, cross-prefix denied, manager writes.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_nation_seal_path(
      'e3000000-0000-0000-0000-000000000001'::uuid,
      'e3000000-0000-0000-0000-000000000001/seal.webp'
    )
    $test$,
    '42501',
    null,
    'an outsider cannot set the nation''s seal_path'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_nation_seal_path(
      'e3000000-0000-0000-0000-000000000001'::uuid,
      'e9000000-0000-0000-0000-000000000099/seal.webp'
    )
    $test$,
    '22023',
    null,
    'the nation manager cannot point seal_path at another nation''s prefix'
  );

select
  public.set_nation_seal_path (
    'e3000000-0000-0000-0000-000000000001'::uuid,
    'e3000000-0000-0000-0000-000000000001/seal.webp'
  );

reset role;

select
  is (
    (
      select
        seal_path
      from
        public.nations
      where
        id = 'e3000000-0000-0000-0000-000000000001'
    ),
    'e3000000-0000-0000-0000-000000000001/seal.webp',
    'the nation manager can set seal_path via the RPC'
  );

select
  *
from
  finish ();

rollback;
