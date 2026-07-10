-- pgTAP tests for public.delete_religion RPC.
-- Run with: npx supabase test db
begin;

select
  plan (10);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all dr-prefixed, unique to this file):
--   de1xxxxx = users   de2xxxxx = worlds    de3xxxxx = nations
--   de4xxxxx = settlements  de6xxxxx = religions  de7xxxxx = citizens
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
    'de100000-0000-0000-0000-000000000001',
    'dr-superadmin@example.com',
    'x',
    now(),
    '{"username":"dr_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'de100000-0000-0000-0000-000000000002',
    'dr-admin@example.com',
    'x',
    now(),
    '{"username":"dr_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'de100000-0000-0000-0000-000000000003',
    'dr-outsider@example.com',
    'x',
    now(),
    '{"username":"dr_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'de100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'de200000-0000-0000-0000-000000000001',
    'DR World',
    'private',
    'active'
  ),
  (
    'de200000-0000-0000-0000-000000000002',
    'DR Other World',
    'private',
    'active'
  ),
  (
    'de200000-0000-0000-0000-000000000003',
    'DR Archived World',
    'private',
    'active'
  );

update public.worlds
set
  status = 'archived',
  archived_at = now()
where
  id = 'de200000-0000-0000-0000-000000000003';

insert into
  public.world_admins (world_id, user_id)
values
  (
    'de200000-0000-0000-0000-000000000001',
    'de100000-0000-0000-0000-000000000002'
  );

insert into
  public.religions (id, world_id, name, color)
values
  (
    'de600000-0000-0000-0000-000000000001',
    'de200000-0000-0000-0000-000000000001',
    'DR Alpha',
    '#336699'
  ),
  (
    'de600000-0000-0000-0000-000000000002',
    'de200000-0000-0000-0000-000000000001',
    'DR Beta',
    '#336699'
  ),
  (
    'de600000-0000-0000-0000-000000000099',
    'de200000-0000-0000-0000-000000000002',
    'DR Wrong World Religion',
    '#336699'
  ),
  (
    'de600000-0000-0000-0000-000000000003',
    'de200000-0000-0000-0000-000000000003',
    'DR Archived Religion',
    '#336699'
  );

insert into
  public.nations (id, world_id, name, state_religion_id)
values
  (
    'de300000-0000-0000-0000-000000000001',
    'de200000-0000-0000-0000-000000000001',
    'DR Nation',
    'de600000-0000-0000-0000-000000000001'
  ),
  (
    'de300000-0000-0000-0000-000000000003',
    'de200000-0000-0000-0000-000000000003',
    'DR Archived Nation',
    'de600000-0000-0000-0000-000000000003'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'de400000-0000-0000-0000-000000000001',
    'de300000-0000-0000-0000-000000000001',
    'DR Settlement'
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
    religion_id
  )
values
  (
    'de700000-0000-0000-0000-000000000001',
    'de200000-0000-0000-0000-000000000001',
    'de400000-0000-0000-0000-000000000001',
    'npc',
    'Target Citizen',
    'male',
    'alive',
    'de600000-0000-0000-0000-000000000001'
  );

-- ===========================================================================
-- REJECTION: outsider (not a world admin)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"de100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.delete_religion('de600000-0000-0000-0000-000000000001', null)
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
  local "request.jwt.claims" = '{"sub":"de100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.delete_religion(
      'de600000-0000-0000-0000-000000000001',
      'de600000-0000-0000-0000-000000000099'
    )
    $test$,
    'P0001',
    null,
    'reassignment target from a different world is rejected with P0001'
  );

-- ===========================================================================
-- REJECTION: reassignment target is the religion being deleted
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.delete_religion(
      'de600000-0000-0000-0000-000000000001',
      'de600000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'self-reassignment is rejected with P0001'
  );

-- ===========================================================================
-- REJECTION: religion does not exist
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.delete_religion('de600000-0000-0000-0000-000000000098', null)
    $test$,
    'P0002',
    null,
    'missing religion is rejected with P0002'
  );

reset role;

-- ===========================================================================
-- REJECTION: archived world is read-only (super admin still blocked)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"de100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.delete_religion('de600000-0000-0000-0000-000000000003', null)
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
  local "request.jwt.claims" = '{"sub":"de100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        id::text
      from
        public.delete_religion (
          'de600000-0000-0000-0000-000000000001',
          'de600000-0000-0000-0000-000000000002'
        )
    ),
    'de600000-0000-0000-0000-000000000001',
    'admin deletes the religion and gets back its id'
  );

reset role;

select
  is (
    (
      select
        religion_id::text
      from
        public.citizens
      where
        id = 'de700000-0000-0000-0000-000000000001'
    ),
    'de600000-0000-0000-0000-000000000002',
    'citizen is reassigned to the target religion'
  );

select
  is (
    (
      select
        state_religion_id::text
      from
        public.nations
      where
        id = 'de300000-0000-0000-0000-000000000001'
    ),
    'de600000-0000-0000-0000-000000000002',
    'nation is reassigned to the target religion'
  );

-- ===========================================================================
-- ADMIN: null reassignment target clears references (existing behavior)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"de100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.delete_religion('de600000-0000-0000-0000-000000000002', null)
    $test$,
    'admin deletes with a null reassignment target'
  );

reset role;

select
  is (
    (
      select
        religion_id
      from
        public.citizens
      where
        id = 'de700000-0000-0000-0000-000000000001'
    ),
    null,
    'citizen reference is cleared'
  );

select
  *
from
  finish ();

rollback;
