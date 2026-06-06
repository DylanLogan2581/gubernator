-- pgTAP tests for add_worlds_update_world_admin migration.
-- Run with: npx supabase test db
--
-- Covers:
--   • Non-creator world admin can update population-rule scalars
--   • Non-creator world admin can update naming_config_json
--   • Random authenticated user (no admin role) cannot update the world
--   • Non-creator world admin cannot update an archived world
--   • Creator world admin can still update via worlds_update_world_admin (regression)
begin;

select
  plan (5);

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
    'a0000000-0000-0000-0000-000000000001',
    'wuwa-owner@example.com',
    'x',
    now(),
    '{"username":"wuwa_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'wuwa-admin@example.com',
    'x',
    now(),
    '{"username":"wuwa_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'wuwa-stranger@example.com',
    'x',
    now(),
    '{"username":"wuwa_stranger"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'a1000000-0000-0000-0000-000000000001',
    'WUWA Active World',
    'private',
    'active'
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'WUWA Archived World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  -- Creator (user 001) gets an explicit world_admins row, mirroring the trigger.
  (
    'a1000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001'
  ),
  -- Delegated world admin (user 002).
  (
    'a1000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002'
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002'
  );

-- Archive the second world via direct system-role update so the
-- column-grant restriction does not block setup.
update public.worlds
set
  status = 'archived',
  archived_at = now()
where
  id = 'a1000000-0000-0000-0000-000000000002';

-- ===========================================================================
-- Non-creator world admin: can update population-rule scalar
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    update public.worlds
    set partnership_seek_chance = 0.42
    where id = 'a1000000-0000-0000-0000-000000000001'
  $test$,
    'non-creator world admin can update partnership_seek_chance'
  );

-- ===========================================================================
-- Non-creator world admin: can update naming_config_json
-- ===========================================================================
select
  lives_ok (
    $test$
    update public.worlds
    set naming_config_json = '{
      "male_given_names": ["Aldric"],
      "female_given_names": ["Mira"],
      "surnames": ["Ashvale"],
      "convention": "random"
    }'::jsonb
    where id = 'a1000000-0000-0000-0000-000000000001'
  $test$,
    'non-creator world admin can update naming_config_json'
  );

-- ===========================================================================
-- Non-creator world admin: cannot update archived world (RLS blocks the row,
-- update silently affects 0 rows; read-back confirms unchanged value).
-- ===========================================================================
update public.worlds
set
  partnership_seek_chance = 0.55
where
  id = 'a1000000-0000-0000-0000-000000000002';

select
  is (
    (
      select
        partnership_seek_chance
      from
        public.worlds
      where
        id = 'a1000000-0000-0000-0000-000000000002'
    ),
    0.3::numeric,
    'non-creator world admin cannot update an archived world (value unchanged)'
  );

reset role;

-- ===========================================================================
-- Stranger (no admin role): cannot update the world (RLS blocks the row).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

update public.worlds
set
  partnership_seek_chance = 0.99
where
  id = 'a1000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        partnership_seek_chance
      from
        public.worlds
      where
        id = 'a1000000-0000-0000-0000-000000000001'
    ),
    0.42::numeric,
    'authenticated stranger with no admin role cannot update the world (value unchanged)'
  );

-- ===========================================================================
-- Creator world admin: can update via worlds_update_world_admin (regression)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    update public.worlds
    set partnership_seek_chance = 0.25
    where id = 'a1000000-0000-0000-0000-000000000001'
  $test$,
    'creator world admin can still update via worlds_update_world_admin'
  );

reset role;

select
  *
from
  finish ();

rollback;
