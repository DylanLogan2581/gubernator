-- pgTAP tests for public.bulk_set_citizen_education RPC.
-- Run with: npx supabase test db
begin;

select
  plan (11);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all bce-prefixed, unique to this file):
--   ff1xxxxx = users     ff2xxxxx = worlds      ff3xxxxx = nations
--   ff4xxxxx = settlements ff5xxxxx = education_levels
--   ff7xxxxx = citizens
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
    'ff100000-0000-0000-0000-000000000001',
    'bce-superadmin@example.com',
    'x',
    now(),
    '{"username":"bce_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'ff100000-0000-0000-0000-000000000002',
    'bce-admin@example.com',
    'x',
    now(),
    '{"username":"bce_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'ff100000-0000-0000-0000-000000000003',
    'bce-outsider@example.com',
    'x',
    now(),
    '{"username":"bce_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'ff100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, status, archived_at)
values
  (
    'ff200000-0000-0000-0000-000000000001',
    'BCE World',
    'active',
    null
  ),
  (
    'ff200000-0000-0000-0000-000000000002',
    'BCE Archived World',
    'archived',
    now()
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ff200000-0000-0000-0000-000000000001',
    'ff100000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ff300000-0000-0000-0000-000000000001',
    'ff200000-0000-0000-0000-000000000001',
    'BCE Nation'
  ),
  (
    'ff300000-0000-0000-0000-000000000002',
    'ff200000-0000-0000-0000-000000000002',
    'BCE Archived Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ff400000-0000-0000-0000-000000000001',
    'ff300000-0000-0000-0000-000000000001',
    'BCE Settlement'
  ),
  (
    'ff400000-0000-0000-0000-000000000002',
    'ff300000-0000-0000-0000-000000000001',
    'BCE Other Settlement'
  ),
  (
    'ff400000-0000-0000-0000-000000000003',
    'ff300000-0000-0000-0000-000000000002',
    'BCE Archived Settlement'
  );

insert into
  public.education_levels (id, world_id, name, rank)
values
  (
    'ff500000-0000-0000-0000-000000000001',
    'ff200000-0000-0000-0000-000000000001',
    'BCE Level 1',
    1
  ),
  (
    'ff500000-0000-0000-0000-000000000099',
    'ff200000-0000-0000-0000-000000000002',
    'BCE Wrong World Level',
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
    status,
    death_cause_category
  )
values
  (
    'ff700000-0000-0000-0000-000000000001',
    'ff200000-0000-0000-0000-000000000001',
    'ff400000-0000-0000-0000-000000000001',
    'npc',
    'Alive One',
    'male',
    'alive',
    null
  ),
  (
    'ff700000-0000-0000-0000-000000000002',
    'ff200000-0000-0000-0000-000000000001',
    'ff400000-0000-0000-0000-000000000001',
    'npc',
    'Alive Two',
    'female',
    'alive',
    null
  ),
  (
    'ff700000-0000-0000-0000-000000000003',
    'ff200000-0000-0000-0000-000000000001',
    'ff400000-0000-0000-0000-000000000001',
    'npc',
    'Dead One',
    'male',
    'dead',
    'unknown'
  ),
  (
    'ff700000-0000-0000-0000-000000000004',
    'ff200000-0000-0000-0000-000000000001',
    'ff400000-0000-0000-0000-000000000002',
    'npc',
    'Other Settlement One',
    'male',
    'alive',
    null
  );

-- ===========================================================================
-- REJECTION: anonymous caller has no EXECUTE grant on the function.
-- ===========================================================================
set
  local role anon;

select
  throws_ok (
    $test$
    select public.bulk_set_citizen_education(
      'ff400000-0000-0000-0000-000000000001',
      'ff500000-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- REJECTION: authenticated outsider (not a world admin)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ff100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.bulk_set_citizen_education(
      'ff400000-0000-0000-0000-000000000001',
      'ff500000-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'outsider is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- REJECTION: unknown settlement id
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ff100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.bulk_set_citizen_education(
      '00000000-0000-0000-0000-000000000000',
      'ff500000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0002',
    null,
    'unknown settlement is rejected with P0002'
  );

-- ===========================================================================
-- REJECTION: education level from a different world
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.bulk_set_citizen_education(
      'ff400000-0000-0000-0000-000000000001',
      'ff500000-0000-0000-0000-000000000099'
    )
    $test$,
    'P0001',
    null,
    'education level from a different world is rejected with P0001'
  );

-- ===========================================================================
-- ADMIN: sets education level on all alive citizens in the settlement
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.bulk_set_citizen_education (
          'ff400000-0000-0000-0000-000000000001',
          'ff500000-0000-0000-0000-000000000001'
        )
    ),
    2,
    'world admin bulk-set affects exactly the 2 alive citizens in the settlement'
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
        id = 'ff700000-0000-0000-0000-000000000001'
    ),
    'ff500000-0000-0000-0000-000000000001',
    'alive citizen 1 got the education level'
  );

select
  is (
    (
      select
        education_level_id
      from
        public.citizens
      where
        id = 'ff700000-0000-0000-0000-000000000003'
    ),
    null,
    'dead citizen in the settlement is left untouched'
  );

select
  is (
    (
      select
        education_level_id
      from
        public.citizens
      where
        id = 'ff700000-0000-0000-0000-000000000004'
    ),
    null,
    'alive citizen in a different settlement is left untouched'
  );

-- ===========================================================================
-- ADMIN: null resets the settlement back to uneducated
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ff100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        education_level_id
      from
        public.bulk_set_citizen_education ('ff400000-0000-0000-0000-000000000001', null)
      where
        id = 'ff700000-0000-0000-0000-000000000001'
    ),
    null,
    'null arg resets citizens back to uneducated'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: also permitted (not just world admins)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ff100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.bulk_set_citizen_education(
      'ff400000-0000-0000-0000-000000000001',
      'ff500000-0000-0000-0000-000000000001'
    )
    $test$,
    'super admin is permitted to call the RPC'
  );

reset role;

-- ===========================================================================
-- REJECTION: archived world is read-only
-- ===========================================================================
insert into
  public.world_admins (world_id, user_id)
values
  (
    'ff200000-0000-0000-0000-000000000002',
    'ff100000-0000-0000-0000-000000000002'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ff100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.bulk_set_citizen_education(
      'ff400000-0000-0000-0000-000000000003',
      null
    )
    $test$,
    '22023',
    null,
    'archived world is rejected with 22023'
  );

reset role;

select
  *
from
  finish ();

rollback;
