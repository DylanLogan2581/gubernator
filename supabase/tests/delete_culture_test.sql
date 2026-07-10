-- pgTAP tests for public.delete_culture RPC.
-- Run with: npx supabase test db
begin;

select
  plan (10);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all dc-prefixed, unique to this file):
--   dc1xxxxx = users   dc2xxxxx = worlds    dc3xxxxx = nations
--   dc4xxxxx = settlements  dc5xxxxx = cultures  dc7xxxxx = citizens
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
    'dc100000-0000-0000-0000-000000000001',
    'dc-superadmin@example.com',
    'x',
    now(),
    '{"username":"dc_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'dc100000-0000-0000-0000-000000000002',
    'dc-admin@example.com',
    'x',
    now(),
    '{"username":"dc_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'dc100000-0000-0000-0000-000000000003',
    'dc-outsider@example.com',
    'x',
    now(),
    '{"username":"dc_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'dc100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'dc200000-0000-0000-0000-000000000001',
    'DC World',
    'private',
    'active'
  ),
  (
    'dc200000-0000-0000-0000-000000000002',
    'DC Other World',
    'private',
    'active'
  ),
  (
    'dc200000-0000-0000-0000-000000000003',
    'DC Archived World',
    'private',
    'active'
  );

update public.worlds
set
  status = 'archived',
  archived_at = now()
where
  id = 'dc200000-0000-0000-0000-000000000003';

insert into
  public.world_admins (world_id, user_id)
values
  (
    'dc200000-0000-0000-0000-000000000001',
    'dc100000-0000-0000-0000-000000000002'
  );

insert into
  public.cultures (id, world_id, name, color)
values
  (
    'dc500000-0000-0000-0000-000000000001',
    'dc200000-0000-0000-0000-000000000001',
    'DC Alpha',
    '#336699'
  ),
  (
    'dc500000-0000-0000-0000-000000000002',
    'dc200000-0000-0000-0000-000000000001',
    'DC Beta',
    '#336699'
  ),
  (
    'dc500000-0000-0000-0000-000000000099',
    'dc200000-0000-0000-0000-000000000002',
    'DC Wrong World Culture',
    '#336699'
  ),
  (
    'dc500000-0000-0000-0000-000000000003',
    'dc200000-0000-0000-0000-000000000003',
    'DC Archived Culture',
    '#336699'
  );

insert into
  public.nations (id, world_id, name, primary_culture_id)
values
  (
    'dc300000-0000-0000-0000-000000000001',
    'dc200000-0000-0000-0000-000000000001',
    'DC Nation',
    'dc500000-0000-0000-0000-000000000001'
  ),
  (
    'dc300000-0000-0000-0000-000000000003',
    'dc200000-0000-0000-0000-000000000003',
    'DC Archived Nation',
    'dc500000-0000-0000-0000-000000000003'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'dc400000-0000-0000-0000-000000000001',
    'dc300000-0000-0000-0000-000000000001',
    'DC Settlement'
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
    culture_id
  )
values
  (
    'dc700000-0000-0000-0000-000000000001',
    'dc200000-0000-0000-0000-000000000001',
    'dc400000-0000-0000-0000-000000000001',
    'npc',
    'Target Citizen',
    'male',
    'alive',
    'dc500000-0000-0000-0000-000000000001'
  );

-- ===========================================================================
-- REJECTION: outsider (not a world admin)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dc100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.delete_culture('dc500000-0000-0000-0000-000000000001', null)
    $test$,
    '42501',
    null,
    'outsider is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- REJECTION: reassignment target from a different world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dc100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.delete_culture(
      'dc500000-0000-0000-0000-000000000001',
      'dc500000-0000-0000-0000-000000000099'
    )
    $test$,
    'P0001',
    null,
    'reassignment target from a different world is rejected with P0001'
  );

-- ===========================================================================
-- REJECTION: reassignment target is the culture being deleted
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.delete_culture(
      'dc500000-0000-0000-0000-000000000001',
      'dc500000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'self-reassignment is rejected with P0001'
  );

-- ===========================================================================
-- REJECTION: culture does not exist
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.delete_culture('dc500000-0000-0000-0000-000000000098', null)
    $test$,
    'P0002',
    null,
    'missing culture is rejected with P0002'
  );

reset role;

-- ===========================================================================
-- REJECTION: archived world is read-only (super admin still blocked)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dc100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.delete_culture('dc500000-0000-0000-0000-000000000003', null)
    $test$,
    '22023',
    null,
    'archived worlds are read-only'
  );

reset role;

-- ===========================================================================
-- ADMIN: deletes with reassignment -- citizens and nations follow
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dc100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        id::text
      from
        public.delete_culture (
          'dc500000-0000-0000-0000-000000000001',
          'dc500000-0000-0000-0000-000000000002'
        )
    ),
    'dc500000-0000-0000-0000-000000000001',
    'admin deletes the culture and gets back its id'
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
        id = 'dc700000-0000-0000-0000-000000000001'
    ),
    'dc500000-0000-0000-0000-000000000002',
    'citizen is reassigned to the target culture'
  );

select
  is (
    (
      select
        primary_culture_id::text
      from
        public.nations
      where
        id = 'dc300000-0000-0000-0000-000000000001'
    ),
    'dc500000-0000-0000-0000-000000000002',
    'nation is reassigned to the target culture'
  );

-- ===========================================================================
-- ADMIN: null reassignment target clears references (existing behavior)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dc100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.delete_culture('dc500000-0000-0000-0000-000000000002', null)
    $test$,
    'admin deletes with a null reassignment target'
  );

reset role;

select
  is (
    (
      select
        culture_id
      from
        public.citizens
      where
        id = 'dc700000-0000-0000-0000-000000000001'
    ),
    null,
    'citizen reference is cleared'
  );

select
  *
from
  finish ();

rollback;
