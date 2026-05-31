-- pgTAP tests for add_world_population_rules migration.
-- Run with: npx supabase test db
--
-- Covers:
--   • default_naming_config() returns a valid config
--   • all existing worlds have valid naming_config_json
--   • world insert without explicit config gets valid defaults
--   • world owner can update population-rule scalars
--   • CHECK rejects probability outside [0, 1]; accepts boundaries 0 and 1
--   • CHECK rejects negative turn counters; accepts 0
--   • CHECK rejects negative multipliers
--   • maximum_fertility_age_turns accepts NULL; rejects negative integers
--   • CHECK rejects invalid naming_config_json (non-object, missing key)
--   • CHECK rejects unknown convention value
--   • valid naming_config_json update succeeds for each valid convention
begin;

select
  plan (20);

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
    '90000000-0000-0000-0000-000000000001',
    'pop-rules-owner@example.com',
    'x',
    now(),
    '{"username":"pop_rules_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    '91000000-0000-0000-0000-000000000001',
    'Population Rules Test World',
    '90000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

-- ===========================================================================
-- default_naming_config() is valid
-- ===========================================================================
select
  ok (
    public.is_valid_naming_config (public.default_naming_config ()),
    'default_naming_config() passes is_valid_naming_config'
  );

-- ===========================================================================
-- All existing worlds have valid naming_config_json
-- ===========================================================================
select
  is (
    (
      select
        count(*)
      from
        public.worlds
      where
        not public.is_valid_naming_config (naming_config_json)
    ),
    0::bigint,
    'all existing worlds have valid naming_config_json'
  );

-- ===========================================================================
-- World insert without explicit config gets valid defaults
-- ===========================================================================
insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    '91000000-0000-0000-0000-000000000002',
    'Auto Default Population World',
    '90000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

select
  ok (
    public.is_valid_naming_config (
      (
        select
          naming_config_json
        from
          public.worlds
        where
          id = '91000000-0000-0000-0000-000000000002'
      )
    ),
    'world inserted without explicit config gets a valid default naming_config_json'
  );

-- ===========================================================================
-- RLS: world owner can update population-rule scalars
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    update public.worlds
    set partnership_seek_chance = 0.5
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    'world owner can update partnership_seek_chance'
  );

reset role;

-- ===========================================================================
-- CHECK rejects probability below 0
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set partnership_seek_chance = -0.1
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects partnership_seek_chance below 0'
  );

-- ===========================================================================
-- CHECK rejects probability above 1
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set fertility_chance = 1.1
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects fertility_chance above 1'
  );

-- ===========================================================================
-- CHECK accepts probability boundary 0
-- ===========================================================================
select
  lives_ok (
    $test$
    update public.worlds
    set partnership_seek_chance = 0
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    'CHECK accepts partnership_seek_chance = 0 (lower boundary)'
  );

-- ===========================================================================
-- CHECK accepts probability boundary 1
-- ===========================================================================
select
  lives_ok (
    $test$
    update public.worlds
    set fertility_chance = 1
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    'CHECK accepts fertility_chance = 1 (upper boundary)'
  );

-- ===========================================================================
-- CHECK rejects negative turn counter
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set minimum_partnership_age_turns = -1
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects negative minimum_partnership_age_turns'
  );

-- ===========================================================================
-- CHECK accepts turn counter boundary 0
-- ===========================================================================
select
  lives_ok (
    $test$
    update public.worlds
    set mourning_period_turns = 0
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    'CHECK accepts mourning_period_turns = 0 (lower boundary)'
  );

-- ===========================================================================
-- CHECK rejects negative multiplier
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set starvation_severity_multiplier = -0.1
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects negative starvation_severity_multiplier'
  );

-- ===========================================================================
-- maximum_fertility_age_turns accepts NULL
-- ===========================================================================
select
  lives_ok (
    $test$
    update public.worlds
    set maximum_fertility_age_turns = null
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    'maximum_fertility_age_turns accepts NULL (no upper fertility limit)'
  );

-- ===========================================================================
-- maximum_fertility_age_turns rejects negative integer
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set maximum_fertility_age_turns = -1
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects negative maximum_fertility_age_turns'
  );

-- ===========================================================================
-- CHECK rejects non-object naming_config_json
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set naming_config_json = '"not an object"'::jsonb
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects non-object naming_config_json'
  );

-- ===========================================================================
-- CHECK rejects naming_config_json missing required key
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set naming_config_json = '{"male_names": [], "female_names": [], "convention": "random"}'::jsonb
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects naming_config_json missing manual_only key'
  );

-- ===========================================================================
-- CHECK rejects unknown convention value
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.worlds
    set naming_config_json = '{
      "male_names": [],
      "female_names": [],
      "convention": "unknown_convention",
      "manual_only": false
    }'::jsonb
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'CHECK constraint rejects unknown convention value'
  );

-- ===========================================================================
-- Valid naming_config_json update succeeds for each convention value
-- ===========================================================================
select
  lives_ok (
    $test$
    update public.worlds
    set naming_config_json = '{
      "male_names": ["Aldric", "Brennan"],
      "female_names": ["Elowen", "Mira"],
      "convention": "random",
      "manual_only": false
    }'::jsonb
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    'valid naming_config_json update succeeds with convention: random'
  );

select
  lives_ok (
    $test$
    update public.worlds
    set naming_config_json = '{"male_names":[],"female_names":[],"convention":"patronymic","manual_only":false}'::jsonb
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    'valid naming_config_json update succeeds with convention: patronymic'
  );

select
  lives_ok (
    $test$
    update public.worlds
    set naming_config_json = '{"male_names":[],"female_names":[],"convention":"matronymic","manual_only":false}'::jsonb
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    'valid naming_config_json update succeeds with convention: matronymic'
  );

select
  lives_ok (
    $test$
    update public.worlds
    set naming_config_json = '{"male_names":[],"female_names":[],"convention":"inherited family name","manual_only":false}'::jsonb
    where id = '91000000-0000-0000-0000-000000000001'
  $test$,
    'valid naming_config_json update succeeds with convention: inherited family name'
  );

select
  *
from
  finish ();

rollback;
