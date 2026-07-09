-- pgTAP tests for public.nation_offices, public.appoint_nation_office and
-- public.dismiss_nation_office: authority guards, government-type
-- validation, alive/foreign-citizen rejection, uniqueness, auto-prune on
-- death/leaving the nation, and RLS.
-- Run with: npx supabase test db
begin;

select
  plan (12);

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
    '96000000-0000-0000-0000-000000000001',
    'offices-admin@example.com',
    'x',
    now(),
    '{"username":"offices_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '96000000-0000-0000-0000-000000000002',
    'offices-manager@example.com',
    'x',
    now(),
    '{"username":"offices_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    '96000000-0000-0000-0000-000000000003',
    'offices-outsider@example.com',
    'x',
    now(),
    '{"username":"offices_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, current_turn_number)
values
  (
    '97000000-0000-0000-0000-000000000001',
    'Offices World',
    'private',
    'active',
    3
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '97000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name, government_type)
values
  (
    '98000000-0000-0000-0000-000000000001',
    '97000000-0000-0000-0000-000000000001',
    'Republic Nation',
    'republic'
  ),
  (
    '98000000-0000-0000-0000-000000000002',
    '97000000-0000-0000-0000-000000000001',
    'Other Nation',
    'monarchy'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '99000000-0000-0000-0000-000000000001',
    '98000000-0000-0000-0000-000000000001',
    'Republic Settlement'
  ),
  (
    '99000000-0000-0000-0000-000000000002',
    '98000000-0000-0000-0000-000000000002',
    'Other Settlement'
  );

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
    death_cause_category
  )
values
  (
    '9a000000-0000-0000-0000-000000000001',
    '97000000-0000-0000-0000-000000000001',
    null,
    'player_character',
    'Manager',
    'alive',
    '96000000-0000-0000-0000-000000000002',
    'nation_manager',
    '98000000-0000-0000-0000-000000000001',
    null
  ),
  (
    '9a000000-0000-0000-0000-000000000002',
    '97000000-0000-0000-0000-000000000001',
    '99000000-0000-0000-0000-000000000001',
    'npc',
    'Senator Candidate',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    '9a000000-0000-0000-0000-000000000003',
    '97000000-0000-0000-0000-000000000001',
    '99000000-0000-0000-0000-000000000002',
    'npc',
    'Foreign Citizen',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    '9a000000-0000-0000-0000-000000000004',
    '97000000-0000-0000-0000-000000000001',
    '99000000-0000-0000-0000-000000000001',
    'npc',
    'Dead Citizen',
    'dead',
    null,
    'none',
    null,
    'unknown'
  ),
  (
    '9a000000-0000-0000-0000-000000000005',
    '97000000-0000-0000-0000-000000000001',
    '99000000-0000-0000-0000-000000000001',
    'npc',
    'Treasurer Candidate',
    'alive',
    null,
    'none',
    null,
    null
  );

-- ===========================================================================
-- Authority: a non-manager, non-admin user cannot appoint.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"96000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.appoint_nation_office(
      '98000000-0000-0000-0000-000000000001'::uuid,
      'senator',
      '9a000000-0000-0000-0000-000000000002'::uuid
    )
  $test$,
    '42501',
    null,
    'a user with no authority over the nation cannot appoint an office'
  );

reset role;

-- ===========================================================================
-- Government-type validation: senator is not allowed for monarchy.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"96000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.appoint_nation_office(
      '98000000-0000-0000-0000-000000000002'::uuid,
      'senator',
      '9a000000-0000-0000-0000-000000000003'::uuid
    )
  $test$,
    '22023',
    null,
    'appointing an office type not allowed for the nation government fails'
  );

reset role;

-- ===========================================================================
-- Dead / foreign citizen rejection (nation manager caller).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"96000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.appoint_nation_office(
      '98000000-0000-0000-0000-000000000001'::uuid,
      'senator',
      '9a000000-0000-0000-0000-000000000004'::uuid
    )
  $test$,
    '22023',
    null,
    'a dead citizen is rejected'
  );

select
  throws_ok (
    $test$
    select public.appoint_nation_office(
      '98000000-0000-0000-0000-000000000001'::uuid,
      'senator',
      '9a000000-0000-0000-0000-000000000003'::uuid
    )
  $test$,
    '22023',
    null,
    'a citizen of a different nation is rejected'
  );

-- ===========================================================================
-- Successful appointment records appointed_turn_number from the world's
-- current turn and is visible to world members.
-- ===========================================================================
select
  public.appoint_nation_office (
    '98000000-0000-0000-0000-000000000001'::uuid,
    'senator',
    '9a000000-0000-0000-0000-000000000002'::uuid
  );

reset role;

select
  is (
    (
      select
        appointed_turn_number
      from
        public.nation_offices
      where
        nation_id = '98000000-0000-0000-0000-000000000001'
        and citizen_id = '9a000000-0000-0000-0000-000000000002'
        and office_type_id = (
          select
            id
          from
            public.office_types
          where
            world_id = '97000000-0000-0000-0000-000000000001'
            and nation_id is null
            and name = 'senator'
        )
    ),
    3,
    'appointing an office records the world current turn number'
  );

-- treasurer is allowed for every government type, including republic.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"96000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.appoint_nation_office (
    '98000000-0000-0000-0000-000000000001'::uuid,
    'treasurer',
    '9a000000-0000-0000-0000-000000000005'::uuid
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_offices
      where
        nation_id = '98000000-0000-0000-0000-000000000001'
        and office_type_id = (
          select
            id
          from
            public.office_types
          where
            world_id = '97000000-0000-0000-0000-000000000001'
            and nation_id is null
            and name = 'treasurer'
        )
    ),
    1,
    'treasurer is allowed for every government type'
  );

-- ===========================================================================
-- RLS: SELECT is available to world members, denied to outsiders. Two
-- offices exist for the republic nation at this point (senator, treasurer).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"96000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_offices
      where
        nation_id = '98000000-0000-0000-0000-000000000001'
    ),
    2,
    'a world member can select nation_offices rows'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"96000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_offices
      where
        nation_id = '98000000-0000-0000-0000-000000000001'
    ),
    0,
    'an outsider with no world access cannot select nation_offices rows'
  );

reset role;

-- ===========================================================================
-- Uniqueness: the same citizen cannot hold the same office twice.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"96000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.appoint_nation_office(
      '98000000-0000-0000-0000-000000000001'::uuid,
      'senator',
      '9a000000-0000-0000-0000-000000000002'::uuid
    )
  $test$,
    '23505',
    null,
    'a citizen cannot hold the same office twice'
  );

reset role;

-- ===========================================================================
-- dismiss_nation_office: authority guard, then removes the row. The office
-- id is captured as the superuser session (bypassing RLS) into a GUC so the
-- outsider role in the next block can pass a real id to the authority check.
-- ===========================================================================
select
  set_config(
    'gubernator.test_senator_office_id',
    (
      select
        id::text
      from
        public.nation_offices
      where
        nation_id = '98000000-0000-0000-0000-000000000001'
        and citizen_id = '9a000000-0000-0000-0000-000000000002'
        and office_type_id = (
          select
            id
          from
            public.office_types
          where
            world_id = '97000000-0000-0000-0000-000000000001'
            and nation_id is null
            and name = 'senator'
        )
    ),
    false
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"96000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.dismiss_nation_office(
      current_setting('gubernator.test_senator_office_id')::uuid
    )
  $test$,
    '42501',
    null,
    'a user with no authority over the nation cannot dismiss an office'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"96000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.dismiss_nation_office (
    current_setting('gubernator.test_senator_office_id')::uuid
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_offices
      where
        nation_id = '98000000-0000-0000-0000-000000000001'
        and citizen_id = '9a000000-0000-0000-0000-000000000002'
        and office_type_id = (
          select
            id
          from
            public.office_types
          where
            world_id = '97000000-0000-0000-0000-000000000001'
            and nation_id is null
            and name = 'senator'
        )
    ),
    0,
    'dismiss_nation_office removes the office row'
  );

-- ===========================================================================
-- Auto-prune: office is removed when the citizen dies.
-- ===========================================================================
update public.citizens
set
  status = 'dead',
  death_cause_category = 'unknown'
where
  id = '9a000000-0000-0000-0000-000000000005';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_offices
      where
        citizen_id = '9a000000-0000-0000-0000-000000000005'
    ),
    0,
    'nation office is auto-removed when the citizen dies'
  );

select
  *
from
  finish ();

rollback;
