-- pgTAP tests for admin_set_user_active_player_character and
-- admin_clear_user_active_player_character RPCs.
-- Run with: npx supabase test db
begin;

select
  plan (11);

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
    'cc000000-0000-0000-0000-000000000001',
    'apc-admin-superadmin@example.com',
    'x',
    now(),
    '{"username":"apc_admin_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'cc000000-0000-0000-0000-000000000002',
    'apc-admin-target@example.com',
    'x',
    now(),
    '{"username":"apc_admin_target"}'::jsonb,
    now(),
    now()
  ),
  (
    'cc000000-0000-0000-0000-000000000003',
    'apc-admin-regular@example.com',
    'x',
    now(),
    '{"username":"apc_admin_regular"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'cc000000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'cc100000-0000-0000-0000-000000000001',
    'APC Admin World',
    'private',
    'active'
  );

-- Target user's living PC in the test world.
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    user_id,
    death_cause_category
  )
values
  (
    'cc500000-0000-0000-0000-000000000001',
    'cc100000-0000-0000-0000-000000000001',
    'player_character',
    'Target PC Alpha',
    'alive',
    'cc000000-0000-0000-0000-000000000002',
    null
  ),
  (
    'cc500000-0000-0000-0000-000000000002',
    'cc100000-0000-0000-0000-000000000001',
    'player_character',
    'Target PC Beta',
    'alive',
    'cc000000-0000-0000-0000-000000000002',
    null
  ),
  (
    'cc500000-0000-0000-0000-000000000003',
    'cc100000-0000-0000-0000-000000000001',
    'player_character',
    'Target PC Dead',
    'dead',
    'cc000000-0000-0000-0000-000000000002',
    'unknown'
  );

insert into
  public.citizens (id, world_id, citizen_type, given_name, status)
values
  (
    'cc500000-0000-0000-0000-000000000004',
    'cc100000-0000-0000-0000-000000000001',
    'npc',
    'World NPC',
    'alive'
  );

-- ===========================================================================
-- admin_set_user_active_player_character — super admin happy path
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.admin_set_user_active_player_character(
      'cc000000-0000-0000-0000-000000000002'::uuid,
      'cc100000-0000-0000-0000-000000000001'::uuid,
      'cc500000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    'super admin can set another user''s active PC'
  );

reset role;

select
  is (
    (
      select
        citizen_id
      from
        public.user_active_player_characters
      where
        user_id = 'cc000000-0000-0000-0000-000000000002'
        and world_id = 'cc100000-0000-0000-0000-000000000001'
    ),
    'cc500000-0000-0000-0000-000000000001'::uuid,
    'admin_set upserted the correct citizen_id'
  );

-- Change to a different PC (update path).
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.admin_set_user_active_player_character(
      'cc000000-0000-0000-0000-000000000002'::uuid,
      'cc100000-0000-0000-0000-000000000001'::uuid,
      'cc500000-0000-0000-0000-000000000002'::uuid
    )
  $test$,
    'super admin can change another user''s active PC to a different citizen'
  );

reset role;

select
  is (
    (
      select
        citizen_id
      from
        public.user_active_player_characters
      where
        user_id = 'cc000000-0000-0000-0000-000000000002'
        and world_id = 'cc100000-0000-0000-0000-000000000001'
    ),
    'cc500000-0000-0000-0000-000000000002'::uuid,
    'admin_set updated citizen_id to the new value'
  );

-- ===========================================================================
-- admin_clear_user_active_player_character — super admin happy path
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.admin_clear_user_active_player_character(
      'cc000000-0000-0000-0000-000000000002'::uuid,
      'cc100000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    'super admin can clear another user''s active PC'
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.user_active_player_characters
      where
        user_id = 'cc000000-0000-0000-0000-000000000002'
        and world_id = 'cc100000-0000-0000-0000-000000000001'
    ),
    0,
    'admin_clear deleted the active-PC row'
  );

-- Calling clear again when no row exists is a no-op (idempotent).
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.admin_clear_user_active_player_character(
      'cc000000-0000-0000-0000-000000000002'::uuid,
      'cc100000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    'admin_clear is idempotent when no row exists'
  );

reset role;

-- ===========================================================================
-- admin_set validation — citizen not matching user/world or not alive
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.admin_set_user_active_player_character(
      'cc000000-0000-0000-0000-000000000002'::uuid,
      'cc100000-0000-0000-0000-000000000001'::uuid,
      'cc500000-0000-0000-0000-000000000003'::uuid
    )
  $test$,
    'P0001',
    null,
    'admin_set rejects a dead PC with P0001'
  );

select
  throws_ok (
    $test$
    select public.admin_set_user_active_player_character(
      'cc000000-0000-0000-0000-000000000002'::uuid,
      'cc100000-0000-0000-0000-000000000001'::uuid,
      'cc500000-0000-0000-0000-000000000004'::uuid
    )
  $test$,
    'P0001',
    null,
    'admin_set rejects an NPC (not a player_character) with P0001'
  );

reset role;

-- ===========================================================================
-- Non-super-admin — 42501 for both RPCs
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.admin_set_user_active_player_character(
      'cc000000-0000-0000-0000-000000000002'::uuid,
      'cc100000-0000-0000-0000-000000000001'::uuid,
      'cc500000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    '42501',
    null,
    'non-super-admin cannot call admin_set_user_active_player_character'
  );

select
  throws_ok (
    $test$
    select public.admin_clear_user_active_player_character(
      'cc000000-0000-0000-0000-000000000002'::uuid,
      'cc100000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    '42501',
    null,
    'non-super-admin cannot call admin_clear_user_active_player_character'
  );

reset role;

select
  *
from
  finish ();

rollback;
