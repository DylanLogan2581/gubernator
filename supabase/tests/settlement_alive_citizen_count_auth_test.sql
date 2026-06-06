-- pgTAP auth tests for public.settlement_alive_citizen_count.
-- Verifies that unauthenticated and foreign-world callers are rejected, while
-- in-world users and world admins are admitted.
-- Run with: npx supabase test db
begin;

select
  plan (5);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all 3a-prefixed, unique to this file):
--   3a100000 = users          3a200000 = worlds
--   3a300000 = nations        3a400000 = settlements
--   3a500000 = citizens
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
    '3a100000-0000-0000-0000-000000000001',
    'sacc-auth-owner@example.com',
    'x',
    now(),
    '{"username":"sacc_auth_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '3a100000-0000-0000-0000-000000000002',
    'sacc-auth-admin@example.com',
    'x',
    now(),
    '{"username":"sacc_auth_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '3a100000-0000-0000-0000-000000000003',
    'sacc-auth-outsider@example.com',
    'x',
    now(),
    '{"username":"sacc_auth_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '3a100000-0000-0000-0000-000000000004',
    'sacc-auth-pcuser@example.com',
    'x',
    now(),
    '{"username":"sacc_auth_pcuser"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    '3a200000-0000-0000-0000-000000000001',
    'SACC Auth World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '3a200000-0000-0000-0000-000000000001',
    '3a100000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '3a300000-0000-0000-0000-000000000001',
    '3a200000-0000-0000-0000-000000000001',
    'SACC Auth Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '3a400000-0000-0000-0000-000000000001',
    '3a300000-0000-0000-0000-000000000001',
    'SACC Auth Settlement'
  );

-- Two alive NPCs so the count is 2 (distinguishable from 0 and from a stub
-- return value).
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status
  )
values
  (
    '3a500000-0000-0000-0000-000000000001',
    '3a200000-0000-0000-0000-000000000001',
    '3a400000-0000-0000-0000-000000000001',
    'npc',
    'SACC Auth NPC 1',
    'alive'
  ),
  (
    '3a500000-0000-0000-0000-000000000002',
    '3a200000-0000-0000-0000-000000000001',
    '3a400000-0000-0000-0000-000000000001',
    'npc',
    'SACC Auth NPC 2',
    'alive'
  );

-- Player-character citizen for the in-world user (user ...04).
insert into
  public.citizens (id, world_id, citizen_type, name, status, user_id)
values
  (
    '3a500000-0000-0000-0000-000000000003',
    '3a200000-0000-0000-0000-000000000001',
    'player_character',
    'SACC Auth PC',
    'alive',
    '3a100000-0000-0000-0000-000000000004'
  );

-- ===========================================================================
-- TEST 1: ANONYMOUS — denied (no EXECUTE grant on the function)
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
    select public.settlement_alive_citizen_count (
      '3a400000-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'anon caller is denied (no execute grant)'
  );

reset role;

-- ===========================================================================
-- TEST 2: OUTSIDER — authenticated but no role in the target world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"3a100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.settlement_alive_citizen_count (
      '3a400000-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'foreign-world authenticated user is denied (42501)'
  );

reset role;

-- ===========================================================================
-- TEST 3: WORLD OWNER — allowed, returns correct count
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"3a100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    public.settlement_alive_citizen_count ('3a400000-0000-0000-0000-000000000001'),
    2,
    'world owner is allowed and receives the correct alive-citizen count'
  );

reset role;

-- ===========================================================================
-- TEST 4: WORLD ADMIN — allowed, returns correct count
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"3a100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    public.settlement_alive_citizen_count ('3a400000-0000-0000-0000-000000000001'),
    2,
    'explicit world admin is allowed and receives the correct alive-citizen count'
  );

reset role;

-- ===========================================================================
-- TEST 5: IN-WORLD USER (player-character path) — allowed
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"3a100000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    public.settlement_alive_citizen_count ('3a400000-0000-0000-0000-000000000001'),
    2,
    'in-world user (player-character path) is allowed and receives the correct count'
  );

reset role;

select
  *
from
  finish ();

rollback;
