-- pgTAP tests for public.set_citizen_culture_religion RPC.
-- Run with: npx supabase test db
begin;

select
  plan (5);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all sccr-prefixed, unique to this file):
--   dd1xxxxx = users   dd2xxxxx = worlds    dd3xxxxx = nations
--   dd4xxxxx = settlements  dd5xxxxx = cultures  dd6xxxxx = religions
--   dd7xxxxx = citizens
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
    'dd100000-0000-0000-0000-000000000001',
    'sccr-admin@example.com',
    'x',
    now(),
    '{"username":"sccr_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'dd100000-0000-0000-0000-000000000002',
    'sccr-outsider@example.com',
    'x',
    now(),
    '{"username":"sccr_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status)
values
  (
    'dd200000-0000-0000-0000-000000000001',
    'SCCR World',
    'active'
  ),
  (
    'dd200000-0000-0000-0000-000000000002',
    'SCCR Other World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'dd200000-0000-0000-0000-000000000001',
    'dd100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'dd300000-0000-0000-0000-000000000001',
    'dd200000-0000-0000-0000-000000000001',
    'SCCR Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'dd400000-0000-0000-0000-000000000001',
    'dd300000-0000-0000-0000-000000000001',
    'SCCR Settlement'
  );

insert into
  public.cultures (id, world_id, name, color)
values
  (
    'dd500000-0000-0000-0000-000000000001',
    'dd200000-0000-0000-0000-000000000001',
    'SCCR Culture',
    '#336699'
  ),
  (
    'dd500000-0000-0000-0000-000000000099',
    'dd200000-0000-0000-0000-000000000002',
    'SCCR Wrong World Culture',
    '#336699'
  );

insert into
  public.religions (id, world_id, name, color)
values
  (
    'dd600000-0000-0000-0000-000000000001',
    'dd200000-0000-0000-0000-000000000001',
    'SCCR Religion',
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
    status
  )
values
  (
    'dd700000-0000-0000-0000-000000000001',
    'dd200000-0000-0000-0000-000000000001',
    'dd400000-0000-0000-0000-000000000001',
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
  local "request.jwt.claims" = '{"sub":"dd100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_citizen_culture_religion(
      'dd700000-0000-0000-0000-000000000001',
      'dd500000-0000-0000-0000-000000000001',
      'dd600000-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'outsider is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- REJECTION: culture from a different world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dd100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_citizen_culture_religion(
      'dd700000-0000-0000-0000-000000000001',
      'dd500000-0000-0000-0000-000000000099',
      null
    )
    $test$,
    'P0001',
    null,
    'culture from a different world is rejected with P0001'
  );

-- ===========================================================================
-- ADMIN: sets both fields on the target citizen only
-- ===========================================================================
select
  is (
    (
      select
        culture_id::text
      from
        public.set_citizen_culture_religion (
          'dd700000-0000-0000-0000-000000000001',
          'dd500000-0000-0000-0000-000000000001',
          'dd600000-0000-0000-0000-000000000001'
        )
    ),
    'dd500000-0000-0000-0000-000000000001',
    'world admin sets the culture'
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
        id = 'dd700000-0000-0000-0000-000000000001'
    ),
    'dd600000-0000-0000-0000-000000000001',
    'world admin sets the religion'
  );

-- ===========================================================================
-- ADMIN: null clears both fields (single-edit semantics differ from bulk RPC)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dd100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        culture_id
      from
        public.set_citizen_culture_religion (
          'dd700000-0000-0000-0000-000000000001',
          null,
          null
        )
    ),
    null,
    'null args clear both fields'
  );

reset role;

select
  *
from
  finish ();

rollback;
