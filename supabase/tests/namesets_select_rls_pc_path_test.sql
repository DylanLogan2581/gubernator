-- pgTAP tests for the player-character SELECT path on namesets.
--
-- Covers the SELECT policy update to use current_user_has_world_access
-- instead of has_world_access, matching the pattern from catalog tables.
--
-- UUID prefix: e6 (unique to this file).
-- Run with: npx supabase test db
begin;

select
  plan (8);

-- ---------------------------------------------------------------------------
-- Fixtures (running as postgres / migration owner – bypasses RLS)
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
    'e6000000-0000-0000-0000-000000000001',
    'e6-owner@example.com',
    'x',
    now(),
    '{"username":"e6_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e6000000-0000-0000-0000-000000000002',
    'e6-outsider@example.com',
    'x',
    now(),
    '{"username":"e6_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'e6000000-0000-0000-0000-000000000003',
    'e6-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"e6_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'e6000000-0000-0000-0000-000000000004',
    'e6-settlement-mgr@example.com',
    'x',
    now(),
    '{"username":"e6_settlement_mgr"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'e6100000-0000-0000-0000-000000000001',
    'Namesets PC Test Private World',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e6200000-0000-0000-0000-000000000001',
    'e6100000-0000-0000-0000-000000000001',
    'Namesets PC Test Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e6300000-0000-0000-0000-000000000001',
    'e6200000-0000-0000-0000-000000000001',
    'Namesets PC Test Settlement'
  );

-- Player-character citizens for the two PC users.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_nation_id,
    role_settlement_id
  )
values
  (
    'e6400000-0000-0000-0000-000000000003',
    'e6100000-0000-0000-0000-000000000001',
    'e6300000-0000-0000-0000-000000000001',
    'player_character',
    'Nation Manager PC',
    'alive',
    'e6000000-0000-0000-0000-000000000003',
    'nation_manager',
    'e6200000-0000-0000-0000-000000000001',
    null
  ),
  (
    'e6400000-0000-0000-0000-000000000004',
    'e6100000-0000-0000-0000-000000000001',
    'e6300000-0000-0000-0000-000000000001',
    'player_character',
    'Settlement Manager PC',
    'alive',
    'e6000000-0000-0000-0000-000000000004',
    'settlement_manager',
    null,
    'e6300000-0000-0000-0000-000000000001'
  );

-- Namesets in the private world.
insert into
  public.namesets (id, world_id, name, config_json, is_default)
values
  (
    'e6500000-0000-0000-0000-000000000001',
    'e6100000-0000-0000-0000-000000000001',
    'Test Nameset 1',
    public.default_naming_config (),
    true
  ),
  (
    'e6500000-0000-0000-0000-000000000002',
    'e6100000-0000-0000-0000-000000000001',
    'Test Nameset 2',
    public.default_naming_config (),
    false
  );

-- ===========================================================================
-- OUTSIDER: user with no relationship to the world cannot read namesets
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e6000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.namesets
      where
        world_id = 'e6100000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read namesets in a private world'
  );

reset role;

-- ===========================================================================
-- NATION MANAGER: active PC with nation_manager role can read namesets
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e6000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.namesets
      where
        id = 'e6500000-0000-0000-0000-000000000001'
    ),
    'nation manager can read default nameset in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.namesets
      where
        id = 'e6500000-0000-0000-0000-000000000002'
    ),
    'nation manager can read non-default nameset in their private world'
  );

select
  is (
    count(*),
    2::bigint,
    'nation manager can read all namesets in their private world'
  )
from
  public.namesets
where
  world_id = 'e6100000-0000-0000-0000-000000000001';

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: active PC with settlement_manager role can read namesets
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e6000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.namesets
      where
        id = 'e6500000-0000-0000-0000-000000000001'
    ),
    'settlement manager can read default nameset in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.namesets
      where
        id = 'e6500000-0000-0000-0000-000000000002'
    ),
    'settlement manager can read non-default nameset in their private world'
  );

select
  is (
    count(*),
    2::bigint,
    'settlement manager can read all namesets in their private world'
  )
from
  public.namesets
where
  world_id = 'e6100000-0000-0000-0000-000000000001';

reset role;

-- ===========================================================================
-- WRITE RESTRICTIONS: PC holders cannot insert into namesets
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e6000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.namesets (world_id, name, config_json)
    values ('e6100000-0000-0000-0000-000000000001', 'PC Insert Nameset', public.default_naming_config ())
  $test$,
    '42501',
    null,
    'settlement manager (PC) cannot insert namesets'
  );

reset role;

select
  *
from
  finish ();

rollback;
