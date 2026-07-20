-- pgTAP tests for public.settlement_alive_citizen_counts_batch.
-- Verifies the batched RPC returns the same counts as
-- settlement_alive_citizen_count for every settlement in one round-trip,
-- and enforces the same world-access guard.
-- Run with: npx supabase test db
begin;

select
  plan (7);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all ba-prefixed, unique to this file):
--   ba100000 = users          ba200000 = worlds
--   ba300000 = nations        ba400000 = settlements
--   ba500000 = citizens
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
    'ba100000-0000-0000-0000-000000000001',
    'sacb-owner@example.com',
    'x',
    now(),
    '{"username":"sacb_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'ba100000-0000-0000-0000-000000000002',
    'sacb-outsider@example.com',
    'x',
    now(),
    '{"username":"sacb_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status)
values
  (
    'ba200000-0000-0000-0000-000000000001',
    'SACB World',
    'active'
  ),
  (
    'ba200000-0000-0000-0000-000000000002',
    'SACB Foreign World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ba200000-0000-0000-0000-000000000001',
    'ba100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ba300000-0000-0000-0000-000000000001',
    'ba200000-0000-0000-0000-000000000001',
    'SACB Nation'
  ),
  (
    'ba300000-0000-0000-0000-000000000002',
    'ba200000-0000-0000-0000-000000000002',
    'SACB Foreign Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ba400000-0000-0000-0000-000000000001',
    'ba300000-0000-0000-0000-000000000001',
    'SACB Settlement A'
  ),
  (
    'ba400000-0000-0000-0000-000000000002',
    'ba300000-0000-0000-0000-000000000001',
    'SACB Settlement B'
  ),
  (
    'ba400000-0000-0000-0000-000000000003',
    'ba300000-0000-0000-0000-000000000002',
    'SACB Foreign Settlement'
  );

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
    'ba500000-0000-0000-0000-000000000001',
    'ba200000-0000-0000-0000-000000000001',
    'ba400000-0000-0000-0000-000000000001',
    'npc',
    'SACB Alive 1',
    'alive'
  ),
  (
    'ba500000-0000-0000-0000-000000000002',
    'ba200000-0000-0000-0000-000000000001',
    'ba400000-0000-0000-0000-000000000001',
    'npc',
    'SACB Alive 2',
    'alive'
  );

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
    'ba500000-0000-0000-0000-000000000003',
    'ba200000-0000-0000-0000-000000000001',
    'ba400000-0000-0000-0000-000000000001',
    'npc',
    'SACB Dead 1',
    'dead',
    'starvation',
    'starvation'
  ),
  (
    'ba500000-0000-0000-0000-000000000004',
    'ba200000-0000-0000-0000-000000000001',
    'ba400000-0000-0000-0000-000000000002',
    'npc',
    'SACB Dead 2',
    'dead',
    'starvation',
    'starvation'
  );

-- ===========================================================================
-- TEST 1: batched call returns correct counts for all requested settlements
-- in one round-trip (A: 2 alive, 1 dead → 2; B: 1 dead → 0)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ba100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  set_eq (
    $test$
    select settlement_id, alive_citizen_count
    from public.settlement_alive_citizen_counts_batch (
      array[
        'ba400000-0000-0000-0000-000000000001'::uuid,
        'ba400000-0000-0000-0000-000000000002'::uuid
      ]
    )
    $test$,
    $test$
    values
      ('ba400000-0000-0000-0000-000000000001'::uuid, 2),
      ('ba400000-0000-0000-0000-000000000002'::uuid, 0)
    $test$,
    'batched call returns the correct alive count per settlement'
  );

-- ===========================================================================
-- TEST 2: settlement with zero citizens still appears in the result (0)
-- ===========================================================================
select
  is (
    (
      select
        alive_citizen_count
      from
        public.settlement_alive_citizen_counts_batch (
          array['ba400000-0000-0000-0000-000000000002'::uuid]
        )
      where
        settlement_id = 'ba400000-0000-0000-0000-000000000002'::uuid
    ),
    0,
    'settlement with no alive citizens returns 0'
  );

-- ===========================================================================
-- TEST 3: empty array input returns an empty set, no error
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_alive_citizen_counts_batch (array[]::uuid[])
    ),
    0,
    'empty settlement id array returns an empty result set'
  );

reset role;

-- ===========================================================================
-- TEST 4: ANONYMOUS — denied (no EXECUTE grant on the function)
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
    select * from public.settlement_alive_citizen_counts_batch (
      array['ba400000-0000-0000-0000-000000000001'::uuid]
    )
    $test$,
    '42501',
    null,
    'anon caller is denied (no execute grant)'
  );

reset role;

-- ===========================================================================
-- TEST 5: OUTSIDER — authenticated but no role in the target world is denied
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ba100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select * from public.settlement_alive_citizen_counts_batch (
      array['ba400000-0000-0000-0000-000000000001'::uuid]
    )
    $test$,
    '42501',
    null,
    'authenticated user with no access to the settlement world is denied (42501)'
  );

reset role;

-- ===========================================================================
-- TEST 6: mixing an in-world and a foreign-world settlement id is denied
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ba100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select * from public.settlement_alive_citizen_counts_batch (
      array[
        'ba400000-0000-0000-0000-000000000001'::uuid,
        'ba400000-0000-0000-0000-000000000003'::uuid
      ]
    )
    $test$,
    '42501',
    null,
    'a batch spanning a world the caller cannot access is denied entirely (42501)'
  );

reset role;

-- ===========================================================================
-- TEST 7: function is SECURITY DEFINER (catalog query, no auth needed)
-- ===========================================================================
select
  is (
    (
      select
        prosecdef
      from
        pg_proc
      where
        proname = 'settlement_alive_citizen_counts_batch'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'settlement_alive_citizen_counts_batch is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
