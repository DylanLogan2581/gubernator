-- pgTAP tests for public.bulk_set_citizen_culture_religion RPC.
-- Run with: npx supabase test db
begin;

select
  plan (13);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all cc-prefixed, unique to this file):
--   cc1xxxxx = users     cc2xxxxx = worlds      cc3xxxxx = nations
--   cc4xxxxx = settlements cc5xxxxx = cultures   cc6xxxxx = religions
--   cc7xxxxx = citizens
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
    'cc100000-0000-0000-0000-000000000001',
    'bscr-superadmin@example.com',
    'x',
    now(),
    '{"username":"bscr_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'cc100000-0000-0000-0000-000000000002',
    'bscr-admin@example.com',
    'x',
    now(),
    '{"username":"bscr_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'cc100000-0000-0000-0000-000000000003',
    'bscr-outsider@example.com',
    'x',
    now(),
    '{"username":"bscr_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'cc100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, status, archived_at)
values
  (
    'cc200000-0000-0000-0000-000000000001',
    'BSCR World',
    'active',
    null
  ),
  (
    'cc200000-0000-0000-0000-000000000002',
    'BSCR Archived World',
    'archived',
    now()
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'cc200000-0000-0000-0000-000000000001',
    'cc100000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'cc300000-0000-0000-0000-000000000001',
    'cc200000-0000-0000-0000-000000000001',
    'BSCR Nation'
  ),
  (
    'cc300000-0000-0000-0000-000000000002',
    'cc200000-0000-0000-0000-000000000002',
    'BSCR Archived Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'cc400000-0000-0000-0000-000000000001',
    'cc300000-0000-0000-0000-000000000001',
    'BSCR Settlement'
  ),
  (
    'cc400000-0000-0000-0000-000000000002',
    'cc300000-0000-0000-0000-000000000001',
    'BSCR Other Settlement'
  ),
  (
    'cc400000-0000-0000-0000-000000000003',
    'cc300000-0000-0000-0000-000000000002',
    'BSCR Archived Settlement'
  );

insert into
  public.cultures (id, world_id, name, color)
values
  (
    'cc500000-0000-0000-0000-000000000001',
    'cc200000-0000-0000-0000-000000000001',
    'BSCR Culture 1',
    '#336699'
  ),
  (
    'cc500000-0000-0000-0000-000000000002',
    'cc200000-0000-0000-0000-000000000001',
    'BSCR Culture 2',
    '#336699'
  ),
  (
    'cc500000-0000-0000-0000-000000000099',
    'cc200000-0000-0000-0000-000000000002',
    'BSCR Wrong World Culture',
    '#336699'
  );

insert into
  public.religions (id, world_id, name, color)
values
  (
    'cc600000-0000-0000-0000-000000000001',
    'cc200000-0000-0000-0000-000000000001',
    'BSCR Religion 1',
    '#336699'
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
    'cc700000-0000-0000-0000-000000000001',
    'cc200000-0000-0000-0000-000000000001',
    'cc400000-0000-0000-0000-000000000001',
    'npc',
    'Alive One',
    'male',
    'alive',
    null
  ),
  (
    'cc700000-0000-0000-0000-000000000002',
    'cc200000-0000-0000-0000-000000000001',
    'cc400000-0000-0000-0000-000000000001',
    'npc',
    'Alive Two',
    'female',
    'alive',
    null
  ),
  (
    'cc700000-0000-0000-0000-000000000003',
    'cc200000-0000-0000-0000-000000000001',
    'cc400000-0000-0000-0000-000000000001',
    'npc',
    'Dead One',
    'male',
    'dead',
    'unknown'
  ),
  (
    'cc700000-0000-0000-0000-000000000004',
    'cc200000-0000-0000-0000-000000000001',
    'cc400000-0000-0000-0000-000000000002',
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
    select public.bulk_set_citizen_culture_religion(
      'cc400000-0000-0000-0000-000000000001',
      'cc500000-0000-0000-0000-000000000001',
      'cc600000-0000-0000-0000-000000000001'
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
  local "request.jwt.claims" = '{"sub":"cc100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.bulk_set_citizen_culture_religion(
      'cc400000-0000-0000-0000-000000000001',
      'cc500000-0000-0000-0000-000000000001',
      'cc600000-0000-0000-0000-000000000001'
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
  local "request.jwt.claims" = '{"sub":"cc100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.bulk_set_citizen_culture_religion(
      '00000000-0000-0000-0000-000000000000',
      'cc500000-0000-0000-0000-000000000001',
      'cc600000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0002',
    null,
    'unknown settlement is rejected with P0002'
  );

-- ===========================================================================
-- REJECTION: culture from a different world
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.bulk_set_citizen_culture_religion(
      'cc400000-0000-0000-0000-000000000001',
      'cc500000-0000-0000-0000-000000000099',
      null
    )
    $test$,
    'P0001',
    null,
    'culture from a different world is rejected with P0001'
  );

-- ===========================================================================
-- ADMIN: sets culture + religion on all alive citizens in the settlement
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.bulk_set_citizen_culture_religion (
          'cc400000-0000-0000-0000-000000000001',
          'cc500000-0000-0000-0000-000000000001',
          'cc600000-0000-0000-0000-000000000001'
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
        culture_id::text
      from
        public.citizens
      where
        id = 'cc700000-0000-0000-0000-000000000001'
    ),
    'cc500000-0000-0000-0000-000000000001',
    'alive citizen 1 got the culture'
  );

select
  is (
    (
      select
        religion_id::text
      from
        public.citizens
      where
        id = 'cc700000-0000-0000-0000-000000000002'
    ),
    'cc600000-0000-0000-0000-000000000001',
    'alive citizen 2 got the religion'
  );

select
  is (
    (
      select
        culture_id
      from
        public.citizens
      where
        id = 'cc700000-0000-0000-0000-000000000003'
    ),
    null,
    'dead citizen in the settlement is left untouched'
  );

select
  is (
    (
      select
        culture_id
      from
        public.citizens
      where
        id = 'cc700000-0000-0000-0000-000000000004'
    ),
    null,
    'alive citizen in a different settlement is left untouched'
  );

-- ===========================================================================
-- ADMIN: null culture leaves culture untouched, but sets religion
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        culture_id::text
      from
        public.bulk_set_citizen_culture_religion (
          'cc400000-0000-0000-0000-000000000001',
          null,
          null
        )
      where
        id = 'cc700000-0000-0000-0000-000000000001'
    ),
    'cc500000-0000-0000-0000-000000000001',
    'null culture/religion args leave existing values untouched'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: also permitted (not just world admins)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.bulk_set_citizen_culture_religion(
      'cc400000-0000-0000-0000-000000000001',
      'cc500000-0000-0000-0000-000000000002',
      null
    )
    $test$,
    'super admin is permitted to call the RPC'
  );

reset role;

select
  is (
    (
      select
        culture_id::text
      from
        public.citizens
      where
        id = 'cc700000-0000-0000-0000-000000000001'
    ),
    'cc500000-0000-0000-0000-000000000002',
    'super admin call updated the culture'
  );

-- ===========================================================================
-- REJECTION: archived world is read-only
-- ===========================================================================
insert into
  public.world_admins (world_id, user_id)
values
  (
    'cc200000-0000-0000-0000-000000000002',
    'cc100000-0000-0000-0000-000000000002'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.bulk_set_citizen_culture_religion(
      'cc400000-0000-0000-0000-000000000003',
      null,
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
