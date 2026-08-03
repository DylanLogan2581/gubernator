-- pgTAP tests for public.set_citizen_education RPC.
-- Run with: npx supabase test db
begin;

select
  plan (5);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all sce-prefixed, unique to this file):
--   ee1xxxxx = users   ee2xxxxx = worlds    ee3xxxxx = nations
--   ee4xxxxx = settlements  ee5xxxxx = education_levels  ee7xxxxx = citizens
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
    'ee100000-0000-0000-0000-000000000001',
    'sce-admin@example.com',
    'x',
    now(),
    '{"username":"sce_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'ee100000-0000-0000-0000-000000000002',
    'sce-outsider@example.com',
    'x',
    now(),
    '{"username":"sce_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status)
values
  (
    'ee200000-0000-0000-0000-000000000001',
    'SCE World',
    'active'
  ),
  (
    'ee200000-0000-0000-0000-000000000002',
    'SCE Other World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ee200000-0000-0000-0000-000000000001',
    'ee100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ee300000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'SCE Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ee400000-0000-0000-0000-000000000001',
    'ee300000-0000-0000-0000-000000000001',
    'SCE Settlement'
  );

insert into
  public.education_levels (id, world_id, name, rank)
values
  (
    'ee500000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'SCE Level',
    1
  ),
  (
    'ee500000-0000-0000-0000-000000000099',
    'ee200000-0000-0000-0000-000000000002',
    'SCE Wrong World Level',
    1
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    sex,
    status
  )
values
  (
    'ee700000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'ee400000-0000-0000-0000-000000000001',
    'npc',
    'Target Citizen',
    'male',
    'alive'
  );

-- ===========================================================================
-- REJECTION: outsider (not a world admin)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ee100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_citizen_education(
      'ee700000-0000-0000-0000-000000000001',
      'ee500000-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'outsider is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- REJECTION: education level from a different world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ee100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_citizen_education(
      'ee700000-0000-0000-0000-000000000001',
      'ee500000-0000-0000-0000-000000000099'
    )
    $test$,
    'P0001',
    null,
    'education level from a different world is rejected with P0001'
  );

-- ===========================================================================
-- ADMIN: sets the education level on the target citizen
-- ===========================================================================
select
  is (
    (
      select
        education_level_id::text
      from
        public.set_citizen_education (
          'ee700000-0000-0000-0000-000000000001',
          'ee500000-0000-0000-0000-000000000001'
        )
    ),
    'ee500000-0000-0000-0000-000000000001',
    'world admin sets the education level'
  );

reset role;

select
  is (
    (
      select
        education_level_id::text
      from
        public.citizens
      where
        id = 'ee700000-0000-0000-0000-000000000001'
    ),
    'ee500000-0000-0000-0000-000000000001',
    'education level persisted on the citizen'
  );

-- ===========================================================================
-- ADMIN: null clears the field back to uneducated
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ee100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        education_level_id
      from
        public.set_citizen_education ('ee700000-0000-0000-0000-000000000001', null)
    ),
    null,
    'null arg clears the field'
  );

reset role;

select
  *
from
  finish ();

rollback;
