-- pgTAP tests for public.remove_deposit_instance RPC.
-- Run with: npx supabase test db
begin;

select
  plan (9);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all ab-prefixed, unique to this file):
--   ab1xxxxx = users          ab2xxxxx = worlds
--   ab3xxxxx = nations        ab4xxxxx = settlements
--   ab5xxxxx = deposit_types  ab7xxxxx = citizens
--   ab8xxxxx = job_definitions ab9xxxxx = deposit_instances
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
    'ab100000-0000-0000-0000-000000000001',
    'rdi-owner@example.com',
    'x',
    now(),
    '{"username":"rdi_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'ab100000-0000-0000-0000-000000000002',
    'rdi-manager@example.com',
    'x',
    now(),
    '{"username":"rdi_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'ab200000-0000-0000-0000-000000000001',
    'RDI World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ab200000-0000-0000-0000-000000000001',
    'ab100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ab300000-0000-0000-0000-000000000001',
    'ab200000-0000-0000-0000-000000000001',
    'RDI Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ab400000-0000-0000-0000-000000000001',
    'ab300000-0000-0000-0000-000000000001',
    'RDI Settlement'
  );

-- Settlement manager player character
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_settlement_id,
    role_nation_id
  )
values
  (
    'ab700000-0000-0000-0000-000000000001',
    'ab200000-0000-0000-0000-000000000001',
    'player_character',
    'RDI Manager PC',
    'alive',
    'ab100000-0000-0000-0000-000000000002',
    'settlement_manager',
    'ab400000-0000-0000-0000-000000000001',
    null
  );

-- NPC worker for assignment tests
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    role_type
  )
values
  (
    'ab700000-0000-0000-0000-000000000002',
    'ab200000-0000-0000-0000-000000000001',
    'npc',
    'RDI Worker NPC',
    'alive',
    'none'
  );

-- Job definition needed for deposit type FK
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'ab800000-0000-0000-0000-000000000001',
    'ab200000-0000-0000-0000-000000000001',
    'RDI Mining',
    'rdi-mining',
    'deposit'
  );

insert into
  public.deposit_types (
    id,
    world_id,
    name,
    slug,
    job_id,
    output_units_per_worker
  )
values
  (
    'ab500000-0000-0000-0000-000000000001',
    'ab200000-0000-0000-0000-000000000001',
    'RDI Iron Seam',
    'rdi-iron-seam',
    'ab800000-0000-0000-0000-000000000001',
    10
  );

-- Deposit instances:
--   ab9...0001 – used for manager rejected, anon rejected, admin success, idempotent tests
--   ab9...0002 – has an active assignment; used for blocked and success-after-unassign tests
insert into
  public.deposit_instances (id, settlement_id, deposit_type_id, name, status)
values
  (
    'ab900000-0000-0000-0000-000000000001',
    'ab400000-0000-0000-0000-000000000001',
    'ab500000-0000-0000-0000-000000000001',
    'RDI Iron Alpha',
    'active'
  ),
  (
    'ab900000-0000-0000-0000-000000000002',
    'ab400000-0000-0000-0000-000000000001',
    'ab500000-0000-0000-0000-000000000001',
    'RDI Iron Beta',
    'active'
  );

-- Assign the NPC worker to ab9...0002
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    deposit_instance_id,
    assigned_on_turn_number
  )
values
  (
    'ab700000-0000-0000-0000-000000000002',
    'deposit',
    'ab900000-0000-0000-0000-000000000002',
    1
  );

-- ===========================================================================
-- SETTLEMENT MANAGER: rejected (42501)
-- Settlement managers are not world admins and cannot retire a deposit.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.remove_deposit_instance('ab900000-0000-0000-0000-000000000001')
    $test$,
    '42501',
    null,
    'settlement manager is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- ANONYMOUS: rejected (42501)
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
    select public.remove_deposit_instance('ab900000-0000-0000-0000-000000000001')
    $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- AUTO-UNASSIGN WITH ACTIVE ASSIGNMENTS: admin can remove deposit with
-- active assignments; all citizens are auto-unassigned.
-- ab9...0002 has one NPC worker assigned.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.remove_deposit_instance('ab900000-0000-0000-0000-000000000002')
    $test$,
    'admin can remove deposit even with active assignments (auto-unassigns)'
  );

-- Verify assignment was deleted
select
  is (
    (
      select
        count(*)::int
      from
        public.citizen_assignments ca
      where
        ca.deposit_instance_id = 'ab900000-0000-0000-0000-000000000002'
        and ca.assignment_type = 'deposit'
    ),
    0,
    'all deposit assignments were auto-deleted on exhaust'
  );

-- Verify deposit status changed to removed
select
  is (
    (
      select
        di.status
      from
        public.deposit_instances di
      where
        di.id = 'ab900000-0000-0000-0000-000000000002'
    ),
    'removed',
    'deposit instance status is removed after removal with active assignments'
  );

-- ===========================================================================
-- ADMIN SUCCESS: world owner can remove an active deposit
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.remove_deposit_instance('ab900000-0000-0000-0000-000000000001')
    $test$,
    'world owner can remove an active deposit instance'
  );

select
  is (
    (
      select
        di.status
      from
        public.deposit_instances di
      where
        di.id = 'ab900000-0000-0000-0000-000000000001'
    ),
    'removed',
    'deposit instance status is removed after admin success'
  );

reset role;

-- ===========================================================================
-- IDEMPOTENT RE-CALL: rejected when deposit is already removed (P0001)
-- ab9...0001 is now 'removed' from the test above.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.remove_deposit_instance('ab900000-0000-0000-0000-000000000001')
    $test$,
    'P0001',
    null,
    'idempotent re-call on already-removed deposit is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- SECURITY DEFINER: function must be SECURITY DEFINER
-- ===========================================================================
select
  is (
    (
      select
        prosecdef
      from
        pg_proc
      where
        proname = 'remove_deposit_instance'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'remove_deposit_instance is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
