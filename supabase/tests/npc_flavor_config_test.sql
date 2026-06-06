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
--   • pool at max size (100) is accepted
--   • pool exceeding max size (101) is rejected
--   • entry at max length (200) is accepted
--   • entry exceeding max length (201) is rejected
--   • empty string entry is rejected
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
    '80000000-0000-0000-0000-000000000001',
    'npc-flavor-owner@example.com',
    'x',
    now(),
    '{"username":"npc_flavor_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    '81000000-0000-0000-0000-000000000001',
    'NPC Flavor Test World',
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
  public.worlds (id, name, visibility, status)
values
  (
    '81000000-0000-0000-0000-000000000002',
    'Auto Default Flavor World',
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

-- ===========================================================================
-- Pool at max size (100 entries) is accepted
-- ===========================================================================
select
  lives_ok (
    $test$
    update public.worlds
    set npc_flavor_config_json = jsonb_build_object(
      'traits',         (select jsonb_agg(to_jsonb('entry'::text)) from generate_series(1, 100)),
      'contradictions', '[]'::jsonb,
      'goals',          '[]'::jsonb,
      'flaws',          '[]'::jsonb
    )
    where id = '81000000-0000-0000-0000-000000000001'
  $test$,
    'pool at exactly 100 entries is accepted'
  );

-- ===========================================================================
-- Pool exceeding max size (101 entries) is rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set npc_flavor_config_json = jsonb_build_object(
      'traits',         (select jsonb_agg(to_jsonb('entry'::text)) from generate_series(1, 101)),
      'contradictions', '[]'::jsonb,
      'goals',          '[]'::jsonb,
      'flaws',          '[]'::jsonb
    )
    where id = '81000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects a pool with 101 entries'
  );

-- ===========================================================================
-- Entry at max length (200 chars) is accepted
-- ===========================================================================
select
  lives_ok (
    $test$
    update public.worlds
    set npc_flavor_config_json = jsonb_build_object(
      'traits',         jsonb_build_array(repeat('x', 200)),
      'contradictions', '[]'::jsonb,
      'goals',          '[]'::jsonb,
      'flaws',          '[]'::jsonb
    )
    where id = '81000000-0000-0000-0000-000000000001'
  $test$,
    'entry at exactly 200 chars is accepted'
  );

-- ===========================================================================
-- Entry exceeding max length (201 chars) is rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set npc_flavor_config_json = jsonb_build_object(
      'traits',         jsonb_build_array(repeat('x', 201)),
      'contradictions', '[]'::jsonb,
      'goals',          '[]'::jsonb,
      'flaws',          '[]'::jsonb
    )
    where id = '81000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects an entry longer than 200 chars'
  );

-- ===========================================================================
-- Empty string entry is rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set npc_flavor_config_json = '{
      "traits": [""],
      "contradictions": [],
      "goals": [],
      "flaws": []
    }'::jsonb
    where id = '81000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects an empty string entry'
  );

select
  *
from
  finish ();

rollback;
