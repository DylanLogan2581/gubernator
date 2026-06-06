-- pgTAP tests for public.settlement_alive_citizen_count helper function.
-- Run with: npx supabase test db
begin;

select
  plan (5);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all fc-prefixed, unique to this file):
--   fc1xxxxx = users          fc2xxxxx = worlds
--   fc3xxxxx = nations        fc4xxxxx = settlements
--   fc5xxxxx = citizens
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
    'fc100000-0000-0000-0000-000000000001',
    'sacc-owner@example.com',
    'x',
    now(),
    '{"username":"sacc_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'fc200000-0000-0000-0000-000000000001',
    'SACC World',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'fc300000-0000-0000-0000-000000000001',
    'fc200000-0000-0000-0000-000000000001',
    'SACC Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'fc400000-0000-0000-0000-000000000001',
    'fc300000-0000-0000-0000-000000000001',
    'SACC Settlement A'
  ),
  (
    'fc400000-0000-0000-0000-000000000002',
    'fc300000-0000-0000-0000-000000000001',
    'SACC Settlement B'
  );

-- ===========================================================================
-- TEST 1: empty settlement — returns 0
-- Each SELECT is wrapped in its own set/reset block so that the INSERTs
-- between tests continue to run as the postgres superuser and bypass RLS.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fc100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    public.settlement_alive_citizen_count ('fc400000-0000-0000-0000-000000000001'),
    0,
    'settlement_alive_citizen_count returns 0 for a settlement with no citizens'
  );

reset role;

-- ===========================================================================
-- TEST 2: alive-only citizens — returns exact count
-- ===========================================================================
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
    'fc500000-0000-0000-0000-000000000001',
    'fc200000-0000-0000-0000-000000000001',
    'fc400000-0000-0000-0000-000000000001',
    'npc',
    'SACC Alive 1',
    'alive'
  ),
  (
    'fc500000-0000-0000-0000-000000000002',
    'fc200000-0000-0000-0000-000000000001',
    'fc400000-0000-0000-0000-000000000001',
    'npc',
    'SACC Alive 2',
    'alive'
  ),
  (
    'fc500000-0000-0000-0000-000000000003',
    'fc200000-0000-0000-0000-000000000001',
    'fc400000-0000-0000-0000-000000000001',
    'npc',
    'SACC Alive 3',
    'alive'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fc100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    public.settlement_alive_citizen_count ('fc400000-0000-0000-0000-000000000001'),
    3,
    'settlement_alive_citizen_count returns 3 when all citizens are alive'
  );

reset role;

-- ===========================================================================
-- TEST 3: mixed alive/dead — only alive counted
-- ===========================================================================
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    death_cause,
    death_cause_category
  )
values
  (
    'fc500000-0000-0000-0000-000000000004',
    'fc200000-0000-0000-0000-000000000001',
    'fc400000-0000-0000-0000-000000000001',
    'npc',
    'SACC Dead 1',
    'dead',
    'starvation',
    'starvation'
  ),
  (
    'fc500000-0000-0000-0000-000000000005',
    'fc200000-0000-0000-0000-000000000001',
    'fc400000-0000-0000-0000-000000000001',
    'npc',
    'SACC Dead 2',
    'dead',
    'starvation',
    'starvation'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fc100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    public.settlement_alive_citizen_count ('fc400000-0000-0000-0000-000000000001'),
    3,
    'settlement_alive_citizen_count excludes dead citizens (3 alive, 2 dead → 3)'
  );

-- ===========================================================================
-- TEST 4: no settlement match — returns 0
-- ===========================================================================
select
  is (
    public.settlement_alive_citizen_count ('fc400000-0000-0000-0000-000000000002'),
    0,
    'settlement_alive_citizen_count returns 0 when no citizens belong to the given settlement'
  );

reset role;

-- ===========================================================================
-- TEST 5: function is SECURITY DEFINER (catalog query, no auth needed)
-- ===========================================================================
select
  is (
    (
      select
        prosecdef
      from
        pg_proc
      where
        proname = 'settlement_alive_citizen_count'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'settlement_alive_citizen_count is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
