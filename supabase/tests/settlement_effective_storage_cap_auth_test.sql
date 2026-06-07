-- pgTAP auth tests for public.settlement_effective_storage_cap.
-- Verifies that unauthenticated and foreign-world callers are rejected, while
-- in-world users and world admins are admitted.
-- Run with: npx supabase test db
begin;

select
  plan (5);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all 3b-prefixed, unique to this file):
--   3b100000 = users          3b200000 = worlds
--   3b300000 = nations        3b400000 = settlements
--   3b500000 = resources      3b600000 = citizens
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
    '3b100000-0000-0000-0000-000000000001',
    'sesc-auth-owner@example.com',
    'x',
    now(),
    '{"username":"sesc_auth_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '3b100000-0000-0000-0000-000000000002',
    'sesc-auth-admin@example.com',
    'x',
    now(),
    '{"username":"sesc_auth_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '3b100000-0000-0000-0000-000000000003',
    'sesc-auth-outsider@example.com',
    'x',
    now(),
    '{"username":"sesc_auth_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '3b100000-0000-0000-0000-000000000004',
    'sesc-auth-pcuser@example.com',
    'x',
    now(),
    '{"username":"sesc_auth_pcuser"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    '3b200000-0000-0000-0000-000000000001',
    'SESC Auth World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '3b200000-0000-0000-0000-000000000001',
    '3b100000-0000-0000-0000-000000000001'
  ),
  (
    '3b200000-0000-0000-0000-000000000001',
    '3b100000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '3b300000-0000-0000-0000-000000000001',
    '3b200000-0000-0000-0000-000000000001',
    'SESC Auth Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '3b400000-0000-0000-0000-000000000001',
    '3b300000-0000-0000-0000-000000000001',
    'SESC Auth Settlement'
  );

-- Resource with a known base cap so authorized callers get a predictable result.
insert into
  public.resources (id, world_id, name, slug, base_stockpile_cap)
values
  (
    '3b500000-0000-0000-0000-000000000001',
    '3b200000-0000-0000-0000-000000000001',
    'SESC Auth Iron',
    'sesc-auth-iron',
    100
  );

-- Player-character citizen for the in-world user (user ...04).
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    user_id
  )
values
  (
    '3b600000-0000-0000-0000-000000000001',
    '3b200000-0000-0000-0000-000000000001',
    'player_character',
    'SESC Auth PC',
    'alive',
    '3b100000-0000-0000-0000-000000000004'
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
    select public.settlement_effective_storage_cap (
      '3b400000-0000-0000-0000-000000000001',
      '3b500000-0000-0000-0000-000000000001'
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
  local "request.jwt.claims" = '{"sub":"3b100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.settlement_effective_storage_cap (
      '3b400000-0000-0000-0000-000000000001',
      '3b500000-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'foreign-world authenticated user is denied (42501)'
  );

reset role;

-- ===========================================================================
-- TEST 3: WORLD ADMIN — allowed, returns correct cap
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"3b100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    public.settlement_effective_storage_cap (
      '3b400000-0000-0000-0000-000000000001',
      '3b500000-0000-0000-0000-000000000001'
    ),
    100::numeric,
    'world admin is allowed and receives the correct storage cap'
  );

reset role;

-- ===========================================================================
-- TEST 4: WORLD ADMIN — allowed, returns correct cap
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"3b100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    public.settlement_effective_storage_cap (
      '3b400000-0000-0000-0000-000000000001',
      '3b500000-0000-0000-0000-000000000001'
    ),
    100::numeric,
    'explicit world admin is allowed and receives the correct storage cap'
  );

reset role;

-- ===========================================================================
-- TEST 5: IN-WORLD USER (player-character path) — allowed
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"3b100000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    public.settlement_effective_storage_cap (
      '3b400000-0000-0000-0000-000000000001',
      '3b500000-0000-0000-0000-000000000001'
    ),
    100::numeric,
    'in-world user (player-character path) is allowed and receives the correct storage cap'
  );

reset role;

select
  *
from
  finish ();

rollback;
