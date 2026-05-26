-- pgTAP tests for add_world_npc_flavor_config migration.
-- Run with: npx supabase test db
--
-- Covers:
--   • default_npc_flavor_config() returns a valid config
--   • all existing worlds have valid npc_flavor_config
--   • world insert without explicit config gets valid default
--   • RLS: world admin can update npc_flavor_config_json
--   • invalid config (not an object) is rejected by CHECK constraint
--   • invalid config (pool entry not string) is rejected
begin;

select
  plan (9);

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
    '80000000-0000-0000-0000-000000000001',
    'npc-flavor-owner@example.com',
    'x',
    now(),
    '{"username":"npc_flavor_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    '81000000-0000-0000-0000-000000000001',
    'NPC Flavor Test World',
    '80000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

-- ===========================================================================
-- default_npc_flavor_config() is valid
-- ===========================================================================
select
  ok (
    public.is_valid_npc_flavor_config (public.default_npc_flavor_config ()),
    'default_npc_flavor_config() passes is_valid_npc_flavor_config'
  );

-- ===========================================================================
-- All existing worlds have valid npc_flavor_config
-- ===========================================================================
select
  is (
    (
      select
        count(*)
      from
        public.worlds
      where
        not public.is_valid_npc_flavor_config (npc_flavor_config_json)
    ),
    0::bigint,
    'all existing worlds have valid npc_flavor_config_json'
  );

-- ===========================================================================
-- World insert without explicit config gets valid default
-- ===========================================================================
insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    '81000000-0000-0000-0000-000000000002',
    'Auto Default Flavor World',
    '80000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

select
  ok (
    public.is_valid_npc_flavor_config (
      (
        select
          npc_flavor_config_json
        from
          public.worlds
        where
          id = '81000000-0000-0000-0000-000000000002'
      )
    ),
    'world inserted without explicit config gets a valid default'
  );

-- ===========================================================================
-- RLS: world admin can update npc_flavor_config_json
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    update public.worlds
    set npc_flavor_config_json = public.default_npc_flavor_config()
    where id = '81000000-0000-0000-0000-000000000001'
  $test$,
    'world admin can update npc_flavor_config_json'
  );

reset role;

-- ===========================================================================
-- Invalid config (not an object) is rejected by CHECK constraint
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set npc_flavor_config_json = '"not an object"'::jsonb
    where id = '81000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects a non-object npc_flavor_config_json'
  );

-- ===========================================================================
-- Invalid config (missing required key) is rejected by CHECK constraint
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set npc_flavor_config_json = '{"traits": [], "contradictions": [], "goals": []}'::jsonb
    where id = '81000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects config missing required keys'
  );

-- ===========================================================================
-- Invalid config (pool entry not string) is rejected by CHECK constraint
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set npc_flavor_config_json = '{
      "traits": [42],
      "contradictions": [],
      "goals": [],
      "flaws": []
    }'::jsonb
    where id = '81000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects config with non-string pool entry'
  );

-- ===========================================================================
-- Invalid config (pool is not an array) is rejected by CHECK constraint
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set npc_flavor_config_json = '{
      "traits": "not an array",
      "contradictions": [],
      "goals": [],
      "flaws": []
    }'::jsonb
    where id = '81000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects config with non-array pool'
  );

-- ===========================================================================
-- Valid config update succeeds
-- ===========================================================================
select
  lives_ok (
    $test$
    update public.worlds
    set npc_flavor_config_json = '{
      "traits": ["brave", "clever"],
      "contradictions": ["fears the dark"],
      "goals": ["freedom"],
      "flaws": ["pride"]
    }'::jsonb
    where id = '81000000-0000-0000-0000-000000000001'
  $test$,
    'valid npc_flavor_config_json update succeeds'
  );

select
  *
from
  finish ();

rollback;
