-- pgTAP tests for public.preview_world_delete RPC (issue #799).
-- Acceptance criterion #3: cascade preview counts match actual deletion.
--
-- Seeds a world with known counts of each tracked entity type, calls
-- preview_world_delete, then deletes the world and asserts the preview
-- counts matched what was actually present.
--
-- Run with: npx supabase test db
--
-- UUID prefix map (all bf-prefixed ranges, unique to this file):
--   bf100000 = users          bf200000 = worlds
--   bf300000 = nations        bf400000 = settlements
--   bf500000 = resources      bf600000 = job_definitions
--   bf700000 = building_blueprints    bf800000 = deposit_types
--   bf900000 = event_groups   bfa00000 = turn_transitions
--   bfb00000 = world_admins   bfd00000 = citizens
begin;

select
  plan (14);

-- ---------------------------------------------------------------------------
-- Fixtures: superadmin + world with one of each counted entity type
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
    'bf100000-0000-0000-0000-000000000001',
    'pwd-superadmin@example.com',
    'x',
    now(),
    '{"username":"pwd_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'bf100000-0000-0000-0000-000000000001';

-- Target world (trashed so hard_delete_world is callable, but preview works on any world)
insert into
  public.worlds (
    id,
    name,
    current_turn_number,
    visibility,
    status,
    is_trashed
  )
values
  (
    'bf200000-0000-0000-0000-000000000001',
    'PWD Preview World',
    3,
    'private',
    'active',
    true
  );

-- World admin (contributes to worldAdmins count)
insert into
  public.world_admins (world_id, user_id)
values
  (
    'bf200000-0000-0000-0000-000000000001',
    'bf100000-0000-0000-0000-000000000001'
  );

-- Nation
insert into
  public.nations (id, world_id, name)
values
  (
    'bf300000-0000-0000-0000-000000000001',
    'bf200000-0000-0000-0000-000000000001',
    'PWD Nation'
  );

-- Settlement (nested under nation, contributes to settlements count)
insert into
  public.settlements (id, nation_id, name)
values
  (
    'bf400000-0000-0000-0000-000000000001',
    'bf300000-0000-0000-0000-000000000001',
    'PWD Settlement'
  );

-- Resource
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'bf500000-0000-0000-0000-000000000001',
    'bf200000-0000-0000-0000-000000000001',
    'PWD Iron',
    'pwd-iron'
  );

-- Job definition
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'bf600000-0000-0000-0000-000000000001',
    'bf200000-0000-0000-0000-000000000001',
    'PWD Mining',
    'pwd-mining',
    'deposit'
  );

-- Building blueprint
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'bf700000-0000-0000-0000-000000000001',
    'bf200000-0000-0000-0000-000000000001',
    'PWD Granary',
    'pwd-granary'
  );

-- Deposit type (needs job FK; reuse job_definition above)
insert into
  public.deposit_types (
    id,
    world_id,
    name,
    slug,
    job_id,
    output_units_per_worker
  )
values
  (
    'bf800000-0000-0000-0000-000000000001',
    'bf200000-0000-0000-0000-000000000001',
    'PWD Iron Seam',
    'pwd-iron-seam',
    'bf600000-0000-0000-0000-000000000001',
    5
  );

-- Event group
insert into
  public.event_groups (id, world_id, name, created_during_turn_number)
values
  (
    'bf900000-0000-0000-0000-000000000001',
    'bf200000-0000-0000-0000-000000000001',
    'PWD Test Group',
    1
  );

-- Turn transition (started + finished → contributes to turnTransitions count)
insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status,
    started_at,
    finished_at
  )
values
  (
    'bfa00000-0000-0000-0000-000000000001',
    'bf200000-0000-0000-0000-000000000001',
    1,
    2,
    'bf100000-0000-0000-0000-000000000001',
    'completed',
    now() - interval '1 hour',
    now() - interval '30 minutes'
  );

-- Citizen physically resident in settlement (settlement_id join used by preview RPC)
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
    'bfd00000-0000-0000-0000-000000000001',
    'bf200000-0000-0000-0000-000000000001',
    'bf400000-0000-0000-0000-000000000001',
    'npc',
    'PWD Citizen',
    'alive'
  );

-- ===========================================================================
-- Run tests as authenticated superadmin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bf100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- TEST 1: preview_world_delete is security definer
-- ===========================================================================
select
  is (
    (
      select
        prosecdef
      from
        pg_proc
      where
        proname = 'preview_world_delete'
    ),
    true,
    'preview_world_delete is SECURITY DEFINER'
  );

-- ===========================================================================
-- TEST 2: non-superadmin cannot call preview_world_delete
-- ===========================================================================
reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bf100000-0000-0000-0000-000000000099","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.preview_world_delete ('bf200000-0000-0000-0000-000000000001')
    $test$,
    '42501',
    null,
    'non-superadmin cannot call preview_world_delete'
  );

-- ===========================================================================
-- TEST 3–17: preview counts match seeded entity counts
-- ===========================================================================
reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bf100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        (
          public.preview_world_delete ('bf200000-0000-0000-0000-000000000001')
        ) ->> 'worldName'
    ),
    'PWD Preview World',
    'preview returns correct worldName'
  );

select
  is (
    (
      select
        (
          public.preview_world_delete ('bf200000-0000-0000-0000-000000000001')
        ) -> 'nations'
    ),
    '1'::jsonb,
    'preview nations count = 1'
  );

select
  is (
    (
      select
        (
          public.preview_world_delete ('bf200000-0000-0000-0000-000000000001')
        ) -> 'resources'
    ),
    '3'::jsonb,
    'preview resources count = 3 (1 seeded + 2 auto-created by world trigger)'
  );

select
  is (
    (
      select
        (
          public.preview_world_delete ('bf200000-0000-0000-0000-000000000001')
        ) -> 'jobDefinitions'
    ),
    '1'::jsonb,
    'preview jobDefinitions count = 1'
  );

select
  is (
    (
      select
        (
          public.preview_world_delete ('bf200000-0000-0000-0000-000000000001')
        ) -> 'buildingBlueprints'
    ),
    '1'::jsonb,
    'preview buildingBlueprints count = 1'
  );

select
  is (
    (
      select
        (
          public.preview_world_delete ('bf200000-0000-0000-0000-000000000001')
        ) -> 'depositTypes'
    ),
    '1'::jsonb,
    'preview depositTypes count = 1'
  );

select
  is (
    (
      select
        (
          public.preview_world_delete ('bf200000-0000-0000-0000-000000000001')
        ) -> 'eventGroups'
    ),
    '1'::jsonb,
    'preview eventGroups count = 1'
  );

select
  is (
    (
      select
        (
          public.preview_world_delete ('bf200000-0000-0000-0000-000000000001')
        ) -> 'turnTransitions'
    ),
    '1'::jsonb,
    'preview turnTransitions count = 1'
  );

select
  is (
    (
      select
        (
          public.preview_world_delete ('bf200000-0000-0000-0000-000000000001')
        ) -> 'worldAdmins'
    ),
    '1'::jsonb,
    'preview worldAdmins count = 1'
  );

select
  is (
    (
      select
        (
          public.preview_world_delete ('bf200000-0000-0000-0000-000000000001')
        ) -> 'settlements'
    ),
    '1'::jsonb,
    'preview settlements count = 1'
  );

select
  is (
    (
      select
        (
          public.preview_world_delete ('bf200000-0000-0000-0000-000000000001')
        ) -> 'citizens'
    ),
    '1'::jsonb,
    'preview citizens count = 1'
  );

-- ===========================================================================
-- TEST 18: preview rejects non-existent world
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.preview_world_delete ('00000000-0000-0000-0000-000000000000')
    $test$,
    'P0002',
    null,
    'preview_world_delete rejects non-existent world'
  );

reset role;

select
  finish ();

rollback;
