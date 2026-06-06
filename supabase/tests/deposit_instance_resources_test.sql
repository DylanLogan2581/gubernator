-- pgTAP tests for public.deposit_instance_resources: RLS, same-world trigger,
-- not-trashed trigger, check constraints, and cascade delete.
-- Run with: npx supabase test db
begin;

select
  plan (12);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all numeric, unique to this file):
--   44xxxxxx = users          45xxxxxx = worlds
--   46xxxxxx = nations        47xxxxxx = settlements
--   48xxxxxx = job_definitions 49xxxxxx = deposit_types
--   4axxxxxx = deposit_instances 4bxxxxxx = resources
--   4cxxxxxx = deposit_instance_resources
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
    '44000000-0000-0000-0000-000000000001',
    'dir-owner@example.com',
    'x',
    now(),
    '{"username":"dir_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '44000000-0000-0000-0000-000000000002',
    'dir-admin@example.com',
    'x',
    now(),
    '{"username":"dir_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '44000000-0000-0000-0000-000000000003',
    'dir-outsider@example.com',
    'x',
    now(),
    '{"username":"dir_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '44000000-0000-0000-0000-000000000004',
    'dir-super@example.com',
    'x',
    now(),
    '{"username":"dir_super"}'::jsonb,
    now(),
    now()
  ),
  (
    '44000000-0000-0000-0000-000000000005',
    'dir-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"dir_nation_mgr"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = '44000000-0000-0000-0000-000000000004';

-- World insert triggers seed Food and Fresh Water resources automatically for
-- each world. Additional explicit resources are inserted below for trigger tests.
insert into
  public.worlds (id, name, visibility, status)
values
  (
    '45000000-0000-0000-0000-000000000001',
    'DIR Main World',
    'private',
    'active'
  ),
  (
    '45000000-0000-0000-0000-000000000002',
    'DIR Other World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '45000000-0000-0000-0000-000000000001',
    '44000000-0000-0000-0000-000000000002'
  );

-- Deposit job and deposit type for the main world.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    '48000000-0000-0000-0000-000000000001',
    '45000000-0000-0000-0000-000000000001',
    'DIR Mining',
    'dir-mining',
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
    '49000000-0000-0000-0000-000000000001',
    '45000000-0000-0000-0000-000000000001',
    'DIR Iron Deposit',
    'dir-iron-deposit',
    '48000000-0000-0000-0000-000000000001',
    5
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '46000000-0000-0000-0000-000000000001',
    '45000000-0000-0000-0000-000000000001',
    'DIR Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '47000000-0000-0000-0000-000000000001',
    '46000000-0000-0000-0000-000000000001',
    'DIR Settlement'
  );

-- Nation manager citizen for write-denied test.
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_nation_id,
    role_settlement_id
  )
values
  (
    '44000000-0000-0000-0000-000000000011',
    '45000000-0000-0000-0000-000000000001',
    'player_character',
    'DIR Nation Manager PC',
    'alive',
    '44000000-0000-0000-0000-000000000005',
    'nation_manager',
    '46000000-0000-0000-0000-000000000001',
    null
  );

-- Two deposit instances: one primary, one for cascade-delete test.
insert into
  public.deposit_instances (id, settlement_id, deposit_type_id, name, status)
values
  (
    '4a000000-0000-0000-0000-000000000001',
    '47000000-0000-0000-0000-000000000001',
    '49000000-0000-0000-0000-000000000001',
    'DIR Iron Mine',
    'active'
  ),
  (
    '4a000000-0000-0000-0000-000000000002',
    '47000000-0000-0000-0000-000000000001',
    '49000000-0000-0000-0000-000000000001',
    'DIR Cascade Mine',
    'active'
  );

-- Explicit resources with known IDs for trigger tests.
-- h8...01 = main world resource (valid for insert)
-- h8...02 = other world resource (cross-world trigger test)
-- h8...03 = main world trashable resource (not-trashed trigger test)
insert into
  public.resources (id, world_id, name, slug)
values
  (
    '4b000000-0000-0000-0000-000000000001',
    '45000000-0000-0000-0000-000000000001',
    'DIR Iron Ore',
    'dir-iron-ore'
  ),
  (
    '4b000000-0000-0000-0000-000000000002',
    '45000000-0000-0000-0000-000000000002',
    'DIR Copper Other World',
    'dir-copper-other'
  ),
  (
    '4b000000-0000-0000-0000-000000000003',
    '45000000-0000-0000-0000-000000000001',
    'DIR Trashable Coal',
    'dir-trashable-coal'
  );

-- Seed one row for read tests.
insert into
  public.deposit_instance_resources (
    id,
    deposit_instance_id,
    resource_id,
    initial_quantity,
    remaining_quantity
  )
values
  (
    '4c000000-0000-0000-0000-000000000001',
    '4a000000-0000-0000-0000-000000000001',
    '4b000000-0000-0000-0000-000000000001',
    1000,
    750
  );

-- Seed a row on the cascade-delete instance so the cascade test can verify removal.
insert into
  public.deposit_instance_resources (
    deposit_instance_id,
    resource_id,
    initial_quantity,
    remaining_quantity
  )
values
  (
    '4a000000-0000-0000-0000-000000000002',
    '4b000000-0000-0000-0000-000000000001',
    500,
    500
  );

-- ===========================================================================
-- ANONYMOUS: cannot read deposit_instance_resources
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.deposit_instance_resources
    ),
    0,
    'anon cannot read deposit_instance_resources'
  );

reset role;

-- ===========================================================================
-- WORLD OWNER: can read deposit_instance_resources in their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"44000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.deposit_instance_resources
      where
        id = '4c000000-0000-0000-0000-000000000001'
    ),
    'world owner can read deposit_instance_resources in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: can insert, update, and delete
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"44000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.deposit_instance_resources (id, deposit_instance_id, resource_id, initial_quantity, remaining_quantity)
    values (
      '4c000000-0000-0000-0000-000000000010',
      '4a000000-0000-0000-0000-000000000001',
      '4b000000-0000-0000-0000-000000000003',
      200,
      150
    )
  $test$,
    'world admin can insert a deposit_instance_resources row'
  );

select
  lives_ok (
    $test$
    update public.deposit_instance_resources
    set remaining_quantity = 100
    where id = '4c000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can update a deposit_instance_resources row'
  );

select
  lives_ok (
    $test$
    delete from public.deposit_instance_resources
    where id = '4c000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can delete a deposit_instance_resources row'
  );

reset role;

-- ===========================================================================
-- NATION MANAGER: direct write denied
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"44000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.deposit_instance_resources (deposit_instance_id, resource_id, initial_quantity, remaining_quantity)
    values (
      '4a000000-0000-0000-0000-000000000001',
      '4b000000-0000-0000-0000-000000000003',
      100,
      100
    )
  $test$,
    '42501',
    null,
    'nation manager cannot directly insert deposit_instance_resources rows'
  );

reset role;

-- ===========================================================================
-- CROSS-WORLD RESOURCE: resource from a different world is rejected by the
-- same-world trigger. 4b...02 belongs to world 45...02; the instance belongs
-- to world 45...01.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.deposit_instance_resources (deposit_instance_id, resource_id, initial_quantity, remaining_quantity)
    values (
      '4a000000-0000-0000-0000-000000000001',
      '4b000000-0000-0000-0000-000000000002',
      300,
      300
    )
  $test$,
    '23503',
    null,
    'resource from a different world is rejected by the same-world trigger'
  );

-- ===========================================================================
-- CONSTRAINT: initial_quantity = 0 is rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.deposit_instance_resources (deposit_instance_id, resource_id, initial_quantity, remaining_quantity)
    values (
      '4a000000-0000-0000-0000-000000000001',
      '4b000000-0000-0000-0000-000000000003',
      0,
      0
    )
  $test$,
    '23514',
    null,
    'initial_quantity = 0 is rejected by the check constraint'
  );

-- ===========================================================================
-- CONSTRAINT: remaining_quantity > initial_quantity is rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.deposit_instance_resources (deposit_instance_id, resource_id, initial_quantity, remaining_quantity)
    values (
      '4a000000-0000-0000-0000-000000000001',
      '4b000000-0000-0000-0000-000000000003',
      100,
      101
    )
  $test$,
    '23514',
    null,
    'remaining_quantity > initial_quantity is rejected by the check constraint'
  );

-- ===========================================================================
-- TRIGGER: soft-deleted resource is rejected on INSERT.
-- Trash dir-trashable-coal then attempt to insert a new row referencing it.
-- Existing rows referencing it survive (grandfathered).
-- ===========================================================================
update public.resources
set
  is_trashed = true
where
  id = '4b000000-0000-0000-0000-000000000003';

select
  throws_ok (
    $test$
    insert into public.deposit_instance_resources (deposit_instance_id, resource_id, initial_quantity, remaining_quantity)
    values (
      '4a000000-0000-0000-0000-000000000001',
      '4b000000-0000-0000-0000-000000000003',
      100,
      100
    )
  $test$,
    '23001',
    null,
    'soft-deleted resource is rejected on insert by the not-trashed trigger'
  );

-- ===========================================================================
-- CASCADE: deleting a deposit_instance removes its deposit_instance_resources.
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.deposit_instance_resources
      where
        deposit_instance_id = '4a000000-0000-0000-0000-000000000002'
    ),
    1,
    'deposit_instance_resources row exists before cascade'
  );

delete from public.deposit_instances
where
  id = '4a000000-0000-0000-0000-000000000002';

select
  is (
    (
      select
        count(*)::integer
      from
        public.deposit_instance_resources
      where
        deposit_instance_id = '4a000000-0000-0000-0000-000000000002'
    ),
    0,
    'cascade delete from deposit_instance removes its deposit_instance_resources rows'
  );

select
  *
from
  finish ();

rollback;
