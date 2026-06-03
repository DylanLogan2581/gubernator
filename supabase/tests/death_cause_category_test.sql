-- pgTAP tests for the death_cause_category enum, the citizens pair CHECK
-- constraint, and the mark_citizen_dead RPC.
-- Run with: npx supabase test db
begin;

select
  plan (14);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all dd-prefixed, unique to this file):
--   dd1xxxxx = users          dd2xxxxx = worlds
--   dd3xxxxx = nations        dd4xxxxx = settlements
--   dd5xxxxx = citizens
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
    'dcc-owner@example.com',
    'x',
    now(),
    '{"username":"dcc_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'dd100000-0000-0000-0000-000000000002',
    'dcc-admin@example.com',
    'x',
    now(),
    '{"username":"dcc_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'dd100000-0000-0000-0000-000000000003',
    'dcc-other@example.com',
    'x',
    now(),
    '{"username":"dcc_other"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'dd200000-0000-0000-0000-000000000001',
    'DCC World',
    'dd100000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

-- dd100000-…-002 is a world admin (not super admin) — exercises is_world_admin path.
insert into
  public.world_admins (world_id, user_id)
values
  (
    'dd200000-0000-0000-0000-000000000001',
    'dd100000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'dd300000-0000-0000-0000-000000000001',
    'dd200000-0000-0000-0000-000000000001',
    'DCC Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'dd400000-0000-0000-0000-000000000001',
    'dd300000-0000-0000-0000-000000000001',
    'DCC Settlement'
  );

-- Seed citizens (direct postgres inserts bypass column-level grants):
--   dd5...001 alive → world admin kills in tests 6-9
--   dd5...002 pre-dead → idempotent no-op test 10
--   dd5...003 alive → non-admin attempt (test 11) then null-reason kill (tests 13)
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status,
    death_cause_category
  )
values
  (
    'dd500000-0000-0000-0000-000000000001',
    'dd200000-0000-0000-0000-000000000001',
    'dd400000-0000-0000-0000-000000000001',
    'npc',
    'DCC Alive NPC',
    'alive',
    null
  ),
  (
    'dd500000-0000-0000-0000-000000000002',
    'dd200000-0000-0000-0000-000000000001',
    'dd400000-0000-0000-0000-000000000001',
    'npc',
    'DCC Pre-dead NPC',
    'dead',
    'unknown'
  ),
  (
    'dd500000-0000-0000-0000-000000000003',
    'dd200000-0000-0000-0000-000000000001',
    'dd400000-0000-0000-0000-000000000001',
    'npc',
    'DCC To-be-killed NPC',
    'alive',
    null
  );

-- ===========================================================================
-- TEST 1: alive citizen has null death_cause_category
-- ===========================================================================
select
  ok (
    (
      select
        death_cause_category is null
      from
        public.citizens
      where
        id = 'dd500000-0000-0000-0000-000000000001'
    ),
    'alive citizen has null death_cause_category'
  );

-- ===========================================================================
-- TEST 2: dead citizen has non-null death_cause_category
-- ===========================================================================
select
  ok (
    (
      select
        death_cause_category is not null
      from
        public.citizens
      where
        id = 'dd500000-0000-0000-0000-000000000002'
    ),
    'dead citizen has non-null death_cause_category'
  );

-- ===========================================================================
-- TEST 3: INSERT dead without death_cause_category is rejected (pair check)
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into
      public.citizens (
        id,
        world_id,
        settlement_id,
        citizen_type,
        name,
        status
      )
    values
      (
        'dd500000-0000-0000-0000-000000000099',
        'dd200000-0000-0000-0000-000000000001',
        'dd400000-0000-0000-0000-000000000001',
        'npc',
        'Rejected Dead NPC',
        'dead'
      )
    $test$,
    '23514',
    null,
    'INSERT of dead citizen without death_cause_category is rejected'
  );

-- ===========================================================================
-- TEST 4: INSERT alive with death_cause_category set is rejected (pair check)
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into
      public.citizens (
        id,
        world_id,
        settlement_id,
        citizen_type,
        name,
        status,
        death_cause_category
      )
    values
      (
        'dd500000-0000-0000-0000-000000000098',
        'dd200000-0000-0000-0000-000000000001',
        'dd400000-0000-0000-0000-000000000001',
        'npc',
        'Alive With Category',
        'alive',
        'unknown'
      )
    $test$,
    '23514',
    null,
    'INSERT of alive citizen with death_cause_category set is rejected'
  );

-- ===========================================================================
-- TEST 5: INSERT alive with death_cause text only is rejected (pair check)
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into
      public.citizens (
        id,
        world_id,
        settlement_id,
        citizen_type,
        name,
        status,
        death_cause
      )
    values
      (
        'dd500000-0000-0000-0000-000000000097',
        'dd200000-0000-0000-0000-000000000001',
        'dd400000-0000-0000-0000-000000000001',
        'npc',
        'Alive With Death Cause',
        'alive',
        'some cause'
      )
    $test$,
    '23514',
    null,
    'INSERT of alive citizen with death_cause text only is rejected'
  );

-- ===========================================================================
-- Tests 6-10: mark_citizen_dead RPC — run as world admin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dd100000-0000-0000-0000-000000000002","role":"authenticated"}';

-- TEST 6: world admin kill succeeds
select
  isnt_empty (
    $test$
    select * from public.mark_citizen_dead (
      'dd500000-0000-0000-0000-000000000001',
      'admin culled'
    )
    $test$,
    'mark_citizen_dead returns a row when world admin kills an alive citizen'
  );

-- TEST 7: status updated
select
  is (
    (
      select
        status
      from
        public.citizens
      where
        id = 'dd500000-0000-0000-0000-000000000001'
    ),
    'dead',
    'mark_citizen_dead sets status to dead'
  );

-- TEST 8: category set to manual_admin
select
  is (
    (
      select
        death_cause_category::text
      from
        public.citizens
      where
        id = 'dd500000-0000-0000-0000-000000000001'
    ),
    'manual_admin',
    'mark_citizen_dead sets death_cause_category to manual_admin'
  );

-- TEST 9: reason stored in death_cause
select
  is (
    (
      select
        death_cause
      from
        public.citizens
      where
        id = 'dd500000-0000-0000-0000-000000000001'
    ),
    'admin culled',
    'mark_citizen_dead sets death_cause to the supplied reason'
  );

-- TEST 10: already-dead citizen is a no-op (idempotent)
select
  is_empty (
    $test$
    select * from public.mark_citizen_dead (
      'dd500000-0000-0000-0000-000000000002',
      'try again'
    )
    $test$,
    'mark_citizen_dead returns empty set when citizen is already dead'
  );

-- ===========================================================================
-- Tests 11-12: non-admin cannot kill a citizen
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"dd100000-0000-0000-0000-000000000003","role":"authenticated"}';

-- TEST 11: non-admin call returns empty
select
  is_empty (
    $test$
    select * from public.mark_citizen_dead (
      'dd500000-0000-0000-0000-000000000003',
      'unauthorized'
    )
    $test$,
    'mark_citizen_dead returns empty set for non-admin caller'
  );

-- Switch to world admin to verify citizen is unaffected.
set
  local "request.jwt.claims" = '{"sub":"dd100000-0000-0000-0000-000000000002","role":"authenticated"}';

-- TEST 12: citizen is still alive after non-admin attempt
select
  is (
    (
      select
        status
      from
        public.citizens
      where
        id = 'dd500000-0000-0000-0000-000000000003'
    ),
    'alive',
    'citizen remains alive after rejected non-admin mark_citizen_dead call'
  );

-- ===========================================================================
-- Tests 13-14: null reason and direct-update block — still world admin
-- ===========================================================================
-- Kill dd5...003 with null reason to verify death_cause stored as null.
select
  *
from
  public.mark_citizen_dead ('dd500000-0000-0000-0000-000000000003', null);

-- TEST 13: null reason → death_cause is null
select
  is (
    (
      select
        death_cause
      from
        public.citizens
      where
        id = 'dd500000-0000-0000-0000-000000000003'
    ),
    null,
    'mark_citizen_dead stores null when reason is null'
  );

-- TEST 14: death_cause_category is not directly updatable by authenticated
select
  throws_ok (
    $test$
    update public.citizens
       set death_cause_category = 'starvation'
     where id = 'dd500000-0000-0000-0000-000000000002'
    $test$,
    '42501',
    null,
    'authenticated role cannot directly update death_cause_category'
  );

reset role;

select
  *
from
  finish ();

rollback;
