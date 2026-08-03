-- pgTAP tests for the reject_dead_player_character_manager_role migration.
-- Run with: npx supabase test db
--
-- Covers:
--   • assign_citizen_role rejects a dead player_character (P0001), closing
--     the gap where the alive-guard only checked citizen_type = 'npc'.
begin;

select
  plan (1);

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
    'c0000000-0000-0000-0000-000000000001',
    'dead-pc-role-admin@example.com',
    'x',
    now(),
    '{"username":"dead_pc_role_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'dead-pc-role-owner@example.com',
    'x',
    now(),
    '{"username":"dead_pc_role_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status)
values
  (
    'c1000000-0000-0000-0000-000000000001',
    'Dead PC Role World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c1000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'Dead PC Role Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'c3000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Dead PC Role Settlement'
  );

-- Dead player_character, used to verify assign_citizen_role rejects it.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id,
    death_cause_category
  )
values
  (
    'c4000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'c3000000-0000-0000-0000-000000000001',
    'player_character',
    'Dead Role PC',
    'dead',
    'c0000000-0000-0000-0000-000000000002',
    'unknown'
  );

-- ===========================================================================
-- World admin: assign_citizen_role rejects a dead player_character.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.assign_citizen_role (
      'c4000000-0000-0000-0000-000000000001',
      'settlement_manager',
      null,
      'c3000000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'assign_citizen_role raises P0001 for a dead player_character'
  );

reset role;

select
  *
from
  finish ();

rollback;
