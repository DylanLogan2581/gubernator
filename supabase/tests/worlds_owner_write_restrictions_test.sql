-- pgTAP tests for restrict_world_owner_writes migration.
-- Run with: npx supabase test db
--
-- Covers:
--   • World admin cannot mutate state-machine columns (current_turn_number,
--     status, archived_at, created_at) through direct table updates.
--   • World admin can still mutate allowed metadata columns (name, visibility,
--     calendar_config_json).
--   • World admin cannot insert worlds (INSERT requires super-admin).
--   • World admin cannot insert worlds with state-machine columns pre-set.
--   • Plain authenticated user (no world_admins row, not super-admin) is denied
--     direct INSERT on public.worlds with 42501 (permission denied).
begin;

select
  plan (14);

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
    '70000000-0000-0000-0000-000000000001',
    'world-owner@example.com',
    'x',
    now(),
    '{"username":"world_owner_restricted"}'::jsonb,
    now(),
    now()
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    'world-other@example.com',
    'x',
    now(),
    '{"username":"world_other_restricted"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    '71000000-0000-0000-0000-000000000001',
    'Restricted World',
    'private',
    'active'
  );

-- Give the test user explicit world admin access (mirrors what the trigger does
-- for authenticated inserts; the fixture runs as postgres so auth.uid() is null).
insert into
  public.world_admins (world_id, user_id)
values
  (
    '71000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001'
  );

-- ===========================================================================
-- WORLD ADMIN: state-machine columns are rejected by column-level privileges
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"70000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    current_user::text,
    'authenticated',
    'session role is authenticated'
  );

select
  throws_ok (
    $test$
    update public.worlds
    set current_turn_number = 99
    where id = '71000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'world admin cannot update current_turn_number directly'
  );

select
  throws_ok (
    $test$
    update public.worlds
    set status = 'archived', archived_at = now()
    where id = '71000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'world admin cannot archive a world directly'
  );

select
  throws_ok (
    $test$
    update public.worlds
    set archived_at = now()
    where id = '71000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'world admin cannot set archived_at directly'
  );

select
  throws_ok (
    $test$
    update public.worlds
    set created_at = now() - interval '1 day'
    where id = '71000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'world admin cannot rewrite created_at'
  );

select
  throws_ok (
    $test$
    update public.worlds
    set updated_at = now() - interval '1 day'
    where id = '71000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'world admin cannot rewrite updated_at directly'
  );

-- ===========================================================================
-- WORLD ADMIN: allowed metadata columns still work
-- ===========================================================================
select
  lives_ok (
    $test$
    update public.worlds
    set name = 'Renamed Restricted World'
    where id = '71000000-0000-0000-0000-000000000001'
  $test$,
    'world admin can rename the world'
  );

select
  lives_ok (
    $test$
    update public.worlds
    set visibility = 'public'
    where id = '71000000-0000-0000-0000-000000000001'
  $test$,
    'world admin can change world visibility'
  );

select
  lives_ok (
    $test$
    update public.worlds
    set calendar_config_json = public.default_calendar_config()
    where id = '71000000-0000-0000-0000-000000000001'
  $test$,
    'world admin can save calendar_config_json'
  );

-- ===========================================================================
-- WORLD ADMIN: INSERT is restricted to metadata columns
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.worlds (id, name, visibility, current_turn_number)
    values (
      '71000000-0000-0000-0000-000000000002',
      'Pre-Advanced World',
      'private',
      5
    )
  $test$,
    '42501',
    null,
    'world admin cannot seed current_turn_number on insert'
  );

select
  throws_ok (
    $test$
    insert into public.worlds (id, name, visibility, status, archived_at)
    values (
      '71000000-0000-0000-0000-000000000003',
      'Pre-Archived World',
      'private',
      'archived',
      now()
    )
  $test$,
    '42501',
    null,
    'world admin cannot create a pre-archived world'
  );

select
  throws_ok (
    $test$
    insert into public.worlds (id, name, visibility)
    values (
      '71000000-0000-0000-0000-000000000004',
      'Fresh World',
      'private'
    )
  $test$,
    '42501',
    null,
    'world admin cannot insert: INSERT requires super-admin'
  );

reset role;

-- ===========================================================================
-- PLAIN USER: unauthenticated user is denied direct INSERT on public.worlds
-- ===========================================================================
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
    '70000000-0000-0000-0000-000000000003',
    'plain-user@example.com',
    'x',
    now(),
    '{"username":"plain_user"}'::jsonb,
    now(),
    now()
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"70000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    current_user::text,
    'authenticated',
    'session role is authenticated for plain user'
  );

select
  throws_ok (
    $test$
    insert into public.worlds (id, name, visibility)
    values (
      '71000000-0000-0000-0000-000000000005',
      'Plain User World',
      'private'
    )
  $test$,
    '42501',
    null,
    'plain user cannot insert: INSERT requires super-admin'
  );

reset role;

select
  *
from
  finish ();

rollback;
