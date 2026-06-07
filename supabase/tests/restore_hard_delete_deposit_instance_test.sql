-- pgTAP tests for public.restore_deposit_instance and
-- public.hard_delete_deposit_instance RPCs.
-- Run with: npx supabase test db
begin;

select
  plan (18);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all ae-prefixed, unique to this file):
--   ae1xxxxx = users          ae2xxxxx = worlds
--   ae3xxxxx = nations        ae4xxxxx = settlements
--   ae5xxxxx = deposit_types  ae6xxxxx = resources
--   ae7xxxxx = citizens       ae8xxxxx = job_definitions
--   ae9xxxxx = deposit_instances
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
    'ae100000-0000-0000-0000-000000000001',
    'rhdi-owner@example.com',
    'x',
    now(),
    '{"username":"rhdi_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'ae100000-0000-0000-0000-000000000002',
    'rhdi-manager@example.com',
    'x',
    now(),
    '{"username":"rhdi_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'ae200000-0000-0000-0000-000000000001',
    'RHDI World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ae200000-0000-0000-0000-000000000001',
    'ae100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ae300000-0000-0000-0000-000000000001',
    'ae200000-0000-0000-0000-000000000001',
    'RHDI Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ae400000-0000-0000-0000-000000000001',
    'ae300000-0000-0000-0000-000000000001',
    'RHDI Settlement'
  );

-- Citizens:
--   ae7...0001 = settlement manager player character (unauthorized caller)
--   ae7...0002 = NPC worker assigned to ae9...0004 for hard-delete cascade test
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
    'ae700000-0000-0000-0000-000000000001',
    'ae200000-0000-0000-0000-000000000001',
    'player_character',
    'RHDI Manager PC',
    'alive',
    'ae100000-0000-0000-0000-000000000002',
    'settlement_manager',
    'ae400000-0000-0000-0000-000000000001',
    null
  ),
  (
    'ae700000-0000-0000-0000-000000000002',
    'ae200000-0000-0000-0000-000000000001',
    'npc',
    'RHDI Worker NPC',
    'alive',
    null,
    'none',
    null,
    null
  );

-- Job definition needed for deposit type FK
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'ae800000-0000-0000-0000-000000000001',
    'ae200000-0000-0000-0000-000000000001',
    'RHDI Mining',
    'rhdi-mining',
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
    'ae500000-0000-0000-0000-000000000001',
    'ae200000-0000-0000-0000-000000000001',
    'RHDI Iron Seam',
    'rhdi-iron-seam',
    'ae800000-0000-0000-0000-000000000001',
    10
  );

-- Resource needed for deposit_instance_resources FK
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'ae600000-0000-0000-0000-000000000001',
    'ae200000-0000-0000-0000-000000000001',
    'RHDI Iron Ore',
    'rhdi-iron-ore'
  );

-- Deposit instances:
--   ae9...0001 – active (for "not removed" precondition tests)
--   ae9...0002 – removed, has resource with remaining_quantity > 0 (restores to 'active')
--   ae9...0003 – removed, has resource with remaining_quantity = 0 (restores to 'depleted')
--   ae9...0004 – removed, no resources (for hard_delete tests)
insert into
  public.deposit_instances (id, settlement_id, deposit_type_id, name, status)
values
  (
    'ae900000-0000-0000-0000-000000000001',
    'ae400000-0000-0000-0000-000000000001',
    'ae500000-0000-0000-0000-000000000001',
    'RHDI Iron Alpha',
    'active'
  ),
  (
    'ae900000-0000-0000-0000-000000000002',
    'ae400000-0000-0000-0000-000000000001',
    'ae500000-0000-0000-0000-000000000001',
    'RHDI Iron Beta',
    'removed'
  ),
  (
    'ae900000-0000-0000-0000-000000000003',
    'ae400000-0000-0000-0000-000000000001',
    'ae500000-0000-0000-0000-000000000001',
    'RHDI Iron Gamma',
    'removed'
  ),
  (
    'ae900000-0000-0000-0000-000000000004',
    'ae400000-0000-0000-0000-000000000001',
    'ae500000-0000-0000-0000-000000000001',
    'RHDI Iron Delta',
    'removed'
  );

-- Resources for ae9...0002: remaining_quantity = 50 (should restore to 'active')
insert into
  public.deposit_instance_resources (
    deposit_instance_id,
    resource_id,
    initial_quantity,
    remaining_quantity
  )
values
  (
    'ae900000-0000-0000-0000-000000000002',
    'ae600000-0000-0000-0000-000000000001',
    100,
    50
  );

-- Resources for ae9...0003: remaining_quantity = 0 (should restore to 'depleted')
insert into
  public.deposit_instance_resources (
    deposit_instance_id,
    resource_id,
    initial_quantity,
    remaining_quantity
  )
values
  (
    'ae900000-0000-0000-0000-000000000003',
    'ae600000-0000-0000-0000-000000000001',
    100,
    0
  );

-- Active assignment referencing ae9...0004. hard_delete_deposit_instance should
-- delete this row via FK cascade when the removed deposit instance is deleted.
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    deposit_instance_id,
    assigned_on_turn_number
  )
values
  (
    'ae700000-0000-0000-0000-000000000002',
    'deposit',
    'ae900000-0000-0000-0000-000000000004',
    1
  );

-- ===========================================================================
-- restore_deposit_instance tests
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- SETTLEMENT MANAGER: rejected (42501)
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ae100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.restore_deposit_instance('ae900000-0000-0000-0000-000000000002')
    $test$,
    '42501',
    null,
    'restore: settlement manager is rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- ANONYMOUS: rejected (42501)
-- ---------------------------------------------------------------------------
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
    select public.restore_deposit_instance('ae900000-0000-0000-0000-000000000002')
    $test$,
    '42501',
    null,
    'restore: anonymous caller is rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- NULL ID: rejected (P0002)
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ae100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.restore_deposit_instance(null)
    $test$,
    'P0002',
    null,
    'restore: null id is rejected with P0002'
  );

-- ---------------------------------------------------------------------------
-- NOT REMOVED: rejected (P0001) — ae9...0001 is 'active'
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $test$
    select public.restore_deposit_instance('ae900000-0000-0000-0000-000000000001')
    $test$,
    'P0001',
    null,
    'restore: active deposit is rejected with P0001'
  );

-- ---------------------------------------------------------------------------
-- SUCCESS (resources remaining): restores ae9...0002 to 'active'
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    select public.restore_deposit_instance('ae900000-0000-0000-0000-000000000002')
    $test$,
    'restore: admin can restore removed deposit with remaining resources'
  );

select
  is (
    (
      select
        di.status
      from
        public.deposit_instances di
      where
        di.id = 'ae900000-0000-0000-0000-000000000002'
    ),
    'active',
    'restore: status is active when resources have remaining_quantity > 0'
  );

-- ---------------------------------------------------------------------------
-- SUCCESS (all resources exhausted): restores ae9...0003 to 'depleted'
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    select public.restore_deposit_instance('ae900000-0000-0000-0000-000000000003')
    $test$,
    'restore: admin can restore removed deposit with exhausted resources'
  );

select
  is (
    (
      select
        di.status
      from
        public.deposit_instances di
      where
        di.id = 'ae900000-0000-0000-0000-000000000003'
    ),
    'depleted',
    'restore: status is depleted when all resources are exhausted'
  );

-- ---------------------------------------------------------------------------
-- IDEMPOTENCY: ae9...0002 is now 'active' — re-calling restore fails (P0001)
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $test$
    select public.restore_deposit_instance('ae900000-0000-0000-0000-000000000002')
    $test$,
    'P0001',
    null,
    'restore: re-calling on already-active deposit is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- hard_delete_deposit_instance tests
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- SETTLEMENT MANAGER: rejected (42501)
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ae100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.hard_delete_deposit_instance('ae900000-0000-0000-0000-000000000004')
    $test$,
    '42501',
    null,
    'hard_delete: settlement manager is rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- NULL ID: rejected (P0002)
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ae100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.hard_delete_deposit_instance(null)
    $test$,
    'P0002',
    null,
    'hard_delete: null id is rejected with P0002'
  );

-- ---------------------------------------------------------------------------
-- NOT REMOVED: rejected (P0001) — ae9...0001 is 'active'
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $test$
    select public.hard_delete_deposit_instance('ae900000-0000-0000-0000-000000000001')
    $test$,
    'P0001',
    null,
    'hard_delete: active deposit is rejected with P0001'
  );

-- ---------------------------------------------------------------------------
-- SUCCESS: hard-deletes ae9...0004 (removed, no resources)
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    select public.hard_delete_deposit_instance('ae900000-0000-0000-0000-000000000004')
    $test$,
    'hard_delete: admin can permanently delete a removed deposit instance'
  );

select
  is (
    (
      select
        count(*)
      from
        public.deposit_instances di
      where
        di.id = 'ae900000-0000-0000-0000-000000000004'
    ),
    0::bigint,
    'hard_delete: deposit instance row no longer exists after deletion'
  );

select
  is (
    (
      select
        count(*)
      from
        public.citizen_assignments ca
      where
        ca.deposit_instance_id = 'ae900000-0000-0000-0000-000000000004'
    ),
    0::bigint,
    'hard_delete: related citizen assignments are deleted by FK cascade'
  );

select
  throws_ok (
    $test$
    select public.hard_delete_deposit_instance('ae900000-0000-0000-0000-000000000004')
    $test$,
    'P0002',
    null,
    'hard_delete: re-calling after deletion is rejected with P0002'
  );

reset role;

-- ===========================================================================
-- SECURITY DEFINER checks
-- ===========================================================================
select
  is (
    (
      select
        prosecdef
      from
        pg_proc
      where
        proname = 'restore_deposit_instance'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'restore_deposit_instance is SECURITY DEFINER'
  );

select
  is (
    (
      select
        prosecdef
      from
        pg_proc
      where
        proname = 'hard_delete_deposit_instance'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'hard_delete_deposit_instance is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
