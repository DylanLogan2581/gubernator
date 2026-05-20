-- pgTAP tests for restrict_world_owner_writes migration.
-- Run with: npx supabase test db
--
-- Covers:
--   • Owner cannot mutate state-machine columns (current_turn_number, status,
--     archived_at, created_at, owner_id) through direct table updates.
--   • Owner can still mutate allowed metadata columns (name, visibility,
--     calendar_config_json).
--   • Owner cannot insert worlds with state-machine columns pre-set.
--   • Owner can insert a world specifying only allowed metadata columns.
--   • advance_world_turn_if_current still advances the turn for the owner
--     (regression check: SECURITY DEFINER path bypasses column grants).
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
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    '71000000-0000-0000-0000-000000000001',
    'Restricted World',
    '70000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

-- ===========================================================================
-- OWNER: state-machine columns are rejected by column-level privileges
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
    'owner cannot update current_turn_number directly'
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
    'owner cannot archive a world directly'
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
    'owner cannot set archived_at directly'
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
    'owner cannot rewrite created_at'
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
    'owner cannot rewrite updated_at directly'
  );

select
  throws_ok (
    $test$
    update public.worlds
    set owner_id = '70000000-0000-0000-0000-000000000002'
    where id = '71000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'owner cannot transfer ownership directly'
  );

-- ===========================================================================
-- OWNER: allowed metadata columns still work
-- ===========================================================================
select
  lives_ok (
    $test$
    update public.worlds
    set name = 'Renamed Restricted World'
    where id = '71000000-0000-0000-0000-000000000001'
  $test$,
    'owner can rename their world'
  );

select
  lives_ok (
    $test$
    update public.worlds
    set visibility = 'public'
    where id = '71000000-0000-0000-0000-000000000001'
  $test$,
    'owner can change world visibility'
  );

select
  lives_ok (
    $test$
    update public.worlds
    set calendar_config_json = public.default_calendar_config()
    where id = '71000000-0000-0000-0000-000000000001'
  $test$,
    'owner can save calendar_config_json'
  );

-- ===========================================================================
-- OWNER: INSERT is restricted to metadata columns
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.worlds (id, name, owner_id, visibility, current_turn_number)
    values (
      '71000000-0000-0000-0000-000000000002',
      'Pre-Advanced World',
      '70000000-0000-0000-0000-000000000001',
      'private',
      5
    )
  $test$,
    '42501',
    null,
    'owner cannot seed current_turn_number on insert'
  );

select
  throws_ok (
    $test$
    insert into public.worlds (id, name, owner_id, visibility, status, archived_at)
    values (
      '71000000-0000-0000-0000-000000000003',
      'Pre-Archived World',
      '70000000-0000-0000-0000-000000000001',
      'private',
      'archived',
      now()
    )
  $test$,
    '42501',
    null,
    'owner cannot create a pre-archived world'
  );

select
  lives_ok (
    $test$
    insert into public.worlds (id, name, owner_id, visibility)
    values (
      '71000000-0000-0000-0000-000000000004',
      'Fresh World',
      '70000000-0000-0000-0000-000000000001',
      'private'
    )
  $test$,
    'owner can create a world with allowed metadata only'
  );

reset role;

-- ===========================================================================
-- Regression: advance_world_turn_if_current still works for the owner
-- (SECURITY DEFINER path bypasses column grants).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"70000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  public.advance_world_turn_if_current ('71000000-0000-0000-0000-000000000001', 0);

reset role;

select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = '71000000-0000-0000-0000-000000000001'
    ),
    1,
    'advance_world_turn_if_current advances the owner''s world despite column restrictions'
  );

select
  *
from
  finish ();

rollback;
