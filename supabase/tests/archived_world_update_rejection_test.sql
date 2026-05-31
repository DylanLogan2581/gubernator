-- pgTAP tests for reject_archived_world_updates migration.
-- Run with: npx supabase test db
--
-- Covers:
--   • Owner cannot update population-rule scalar columns on an archived world.
--   • Owner cannot update naming_config_json on an archived world.
--   • Owner cannot update allowed metadata (name) on an archived world.
--   • Owner can still update population-rule scalars on an active world
--     (regression check that the policy didn't over-restrict).
begin;

select
  plan (5);

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
    '92000000-0000-0000-0000-000000000001',
    'archived-owner@example.com',
    'x',
    now(),
    '{"username":"archived_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    '93000000-0000-0000-0000-000000000001',
    'Archived Test World',
    '92000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    'Active Test World',
    '92000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

-- Archive the first world via privileged path (column grants forbid direct
-- writes to status / archived_at from the authenticated role).
update public.worlds
set
  status = 'archived',
  archived_at = now()
where
  id = '93000000-0000-0000-0000-000000000001';

-- ===========================================================================
-- Owner cannot update population-rule scalars on an archived world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"92000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  results_eq (
    $test$
    with updated as (
      update public.worlds
      set partnership_seek_chance = 0.5
      where id = '93000000-0000-0000-0000-000000000001'
      returning id
    )
    select count(*)::int from updated
  $test$,
    $expected$values (0)$expected$,
    'owner cannot update partnership_seek_chance on archived world'
  );

-- ===========================================================================
-- Owner cannot update naming_config_json on an archived world
-- ===========================================================================
select
  results_eq (
    $test$
    with updated as (
      update public.worlds
      set naming_config_json = '{
        "male_names": ["A"],
        "female_names": ["B"],
        "convention": "random",
        "manual_only": false
      }'::jsonb
      where id = '93000000-0000-0000-0000-000000000001'
      returning id
    )
    select count(*)::int from updated
  $test$,
    $expected$values (0)$expected$,
    'owner cannot update naming_config_json on archived world'
  );

-- ===========================================================================
-- Owner cannot rename an archived world
-- ===========================================================================
select
  results_eq (
    $test$
    with updated as (
      update public.worlds
      set name = 'Renamed Archived World'
      where id = '93000000-0000-0000-0000-000000000001'
      returning id
    )
    select count(*)::int from updated
  $test$,
    $expected$values (0)$expected$,
    'owner cannot rename an archived world'
  );

-- ===========================================================================
-- Regression: owner can still update population-rule scalars on active world
-- ===========================================================================
select
  lives_ok (
    $test$
    update public.worlds
    set partnership_seek_chance = 0.5
    where id = '93000000-0000-0000-0000-000000000002'
  $test$,
    'owner can update partnership_seek_chance on active world'
  );

select
  lives_ok (
    $test$
    update public.worlds
    set naming_config_json = '{
      "male_names": ["A"],
      "female_names": ["B"],
      "convention": "random",
      "manual_only": false
    }'::jsonb
    where id = '93000000-0000-0000-0000-000000000002'
  $test$,
    'owner can update naming_config_json on active world'
  );

reset role;

select
  *
from
  finish ();

rollback;
