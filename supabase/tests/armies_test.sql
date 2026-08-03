-- pgTAP tests for public.armies / army_groups / army_units RLS and RPCs
-- (#1108): tree CRUD, cycle/depth validation, deletion guards, and the
-- stationed-settlement-must-belong-to-the-nation invariant.
-- Run with: npx supabase test db
--
-- Generated ids are threaded between statements (including across role
-- switches) via session GUCs (set_config/current_setting), matching the
-- pattern in nation_offices_test.sql.
--
-- UUID ranges (all numeric/hex, unique to this file):
--   e1xxxxxx = users          e2xxxxxx = worlds
--   e3xxxxxx = nations        e4xxxxxx = settlements
--   e5xxxxxx = citizens       e6xxxxxx = unit_types
begin;

select
  plan (24);

-- ---------------------------------------------------------------------------
-- Fixtures
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
    'e1000000-0000-0000-0000-000000000001',
    'army-admin@example.com',
    'x',
    now(),
    '{"username":"army_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'army-manager@example.com',
    'x',
    now(),
    '{"username":"army_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'army-outsider@example.com',
    'x',
    now(),
    '{"username":"army_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status, current_turn_number)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Army World',
    'active',
    9
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Home Nation'
  ),
  (
    'e3000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'Other Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'Home Settlement'
  ),
  (
    'e4000000-0000-0000-0000-000000000002',
    'e3000000-0000-0000-0000-000000000002',
    'Other Settlement'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_nation_id
  )
values
  (
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'player_character',
    'Manager',
    'alive',
    'e1000000-0000-0000-0000-000000000002',
    'nation_manager',
    'e3000000-0000-0000-0000-000000000001'
  );

insert into
  public.unit_types (
    id,
    world_id,
    name,
    soldiers_per_unit,
    desertion_rate
  )
values
  (
    'e6000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Levy',
    10,
    0.05
  );

-- ===========================================================================
-- Authority: an outsider cannot create an army for a nation they don't manage.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_army(
      'e3000000-0000-0000-0000-000000000001'::uuid,
      'Outsider Army',
      'nation',
      'e4000000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    '42501',
    null,
    'outsider cannot create an army'
  );

reset role;

-- ===========================================================================
-- stationed settlement must belong to the nation.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_army(
      'e3000000-0000-0000-0000-000000000001'::uuid,
      'Wrong Settlement Army',
      'nation',
      'e4000000-0000-0000-0000-000000000002'::uuid
    )
  $test$,
    '22023',
    'stationed settlement must belong to the nation',
    'stationed settlement outside the nation is rejected'
  );

-- ===========================================================================
-- nation_manager can create an army for their own nation.
-- ===========================================================================
select
  results_eq (
    $test$
    select name, funding_source, created_turn_number
    from public.create_army(
      'e3000000-0000-0000-0000-000000000001'::uuid,
      'First Army',
      'nation',
      'e4000000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    $test$ values ('First Army'::text, 'nation'::text, 9) $test$,
    'nation manager can create an army stationed in their own nation'
  );

reset role;

-- Capture the created army id in a session GUC so later blocks (including
-- after role switches) can reference it without re-querying under a role
-- that may not have select access.
select
  set_config(
    'gubernator.test_army_id',
    (
      select
        id::text
      from
        public.armies
      where
        nation_id = 'e3000000-0000-0000-0000-000000000001'
        and name = 'First Army'
    ),
    false
  );

-- ===========================================================================
-- Tree CRUD as nation_manager.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.create_army_group (
          current_setting('gubernator.test_army_id')::uuid,
          null,
          'Root Division',
          0
        )
    ),
    'nation manager can create a root-level group'
  );

select
  ok (
    exists (
      select
        1
      from
        public.rename_army (
          current_setting('gubernator.test_army_id')::uuid,
          'Renamed Army'
        )
      where
        name = 'Renamed Army'
    ),
    'nation manager can rename the army'
  );

reset role;

select
  set_config(
    'gubernator.test_root_group_id',
    (
      select
        id::text
      from
        public.army_groups
      where
        army_id = current_setting('gubernator.test_army_id')::uuid
        and name = 'Root Division'
    ),
    false
  );

-- ---------------------------------------------------------------------------
-- Depth cap: build a chain of 5 nested groups under the root (depths 2-5),
-- then verify a 6th level is rejected.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.create_army_group (
    current_setting('gubernator.test_army_id')::uuid,
    current_setting('gubernator.test_root_group_id')::uuid,
    'Depth 2',
    0
  );

reset role;

select
  set_config(
    'gubernator.test_depth2_id',
    (
      select
        id::text
      from
        public.army_groups
      where
        army_id = current_setting('gubernator.test_army_id')::uuid
        and name = 'Depth 2'
    ),
    false
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.create_army_group (
    current_setting('gubernator.test_army_id')::uuid,
    current_setting('gubernator.test_depth2_id')::uuid,
    'Depth 3',
    0
  );

reset role;

select
  set_config(
    'gubernator.test_depth3_id',
    (
      select
        id::text
      from
        public.army_groups
      where
        army_id = current_setting('gubernator.test_army_id')::uuid
        and name = 'Depth 3'
    ),
    false
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.create_army_group (
    current_setting('gubernator.test_army_id')::uuid,
    current_setting('gubernator.test_depth3_id')::uuid,
    'Depth 4',
    0
  );

reset role;

select
  set_config(
    'gubernator.test_depth4_id',
    (
      select
        id::text
      from
        public.army_groups
      where
        army_id = current_setting('gubernator.test_army_id')::uuid
        and name = 'Depth 4'
    ),
    false
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.create_army_group (
    current_setting('gubernator.test_army_id')::uuid,
    current_setting('gubernator.test_depth4_id')::uuid,
    'Depth 5',
    0
  );

reset role;

select
  set_config(
    'gubernator.test_depth5_id',
    (
      select
        id::text
      from
        public.army_groups
      where
        army_id = current_setting('gubernator.test_army_id')::uuid
        and name = 'Depth 5'
    ),
    false
  );

-- Root Division = depth 1, so Depth 5 above is the 5th level; a child under
-- it would be depth 6 and must be rejected.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_army_group(
      current_setting('gubernator.test_army_id')::uuid,
      current_setting('gubernator.test_depth5_id')::uuid,
      'Depth 6',
      0
    )
  $test$,
    '22023',
    'group depth cannot exceed 5 levels',
    'creating a group at depth 6 is rejected'
  );

-- ---------------------------------------------------------------------------
-- Cycle rejection: cannot move a group under its own descendant.
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $test$
    select public.move_army_group(
      current_setting('gubernator.test_root_group_id')::uuid,
      current_setting('gubernator.test_depth2_id')::uuid
    )
  $test$,
    '22023',
    'cannot move a group under one of its own descendants',
    'moving a group under its own descendant (cycle) is rejected'
  );

-- ---------------------------------------------------------------------------
-- Race regression (#1131): move_army_group must lock the armies row so a
-- second reparent on the same tree re-reads post-move state instead of
-- validating against the stale pre-move tree. Simulated sequentially (pgTAP
-- has no concurrent-session support): move Sibling A under Sibling B, then
-- attempt to move Sibling B under Sibling A. Without the armies-row lock
-- forcing a fresh descendant check, this second move is exactly the second
-- half of the two concurrent "swap parentage" calls from the issue and would
-- commit a real cycle; with the lock, the fresh check sees A is now a
-- descendant of B and rejects it.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.create_army_group (
    current_setting('gubernator.test_army_id')::uuid,
    current_setting('gubernator.test_root_group_id')::uuid,
    'Sibling A',
    0
  );

select
  public.create_army_group (
    current_setting('gubernator.test_army_id')::uuid,
    current_setting('gubernator.test_root_group_id')::uuid,
    'Sibling B',
    0
  );

reset role;

select
  set_config(
    'gubernator.test_sibling_a_id',
    (
      select
        id::text
      from
        public.army_groups
      where
        army_id = current_setting('gubernator.test_army_id')::uuid
        and name = 'Sibling A'
    ),
    false
  );

select
  set_config(
    'gubernator.test_sibling_b_id',
    (
      select
        id::text
      from
        public.army_groups
      where
        army_id = current_setting('gubernator.test_army_id')::uuid
        and name = 'Sibling B'
    ),
    false
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.move_army_group (
          current_setting('gubernator.test_sibling_a_id')::uuid,
          current_setting('gubernator.test_sibling_b_id')::uuid
        )
    ),
    'moving Sibling A under Sibling B succeeds'
  );

select
  throws_ok (
    $test$
    select public.move_army_group(
      current_setting('gubernator.test_sibling_b_id')::uuid,
      current_setting('gubernator.test_sibling_a_id')::uuid
    )
  $test$,
    '22023',
    'cannot move a group under one of its own descendants',
    'swapping Sibling B under Sibling A (now its own descendant) is rejected, closing the race'
  );

-- Cleanup: Sibling A/B are extra fixtures for the race test above and must
-- not linger under the root group, which the deletion-guard tests below
-- expect to be empty before they delete it.
select
  public.delete_army_group (
    current_setting('gubernator.test_sibling_a_id')::uuid
  );

select
  public.delete_army_group (
    current_setting('gubernator.test_sibling_b_id')::uuid
  );

reset role;

-- ---------------------------------------------------------------------------
-- Cross-army move rejected: a second army's group cannot become the parent
-- of a group in the first army.
-- ---------------------------------------------------------------------------
select
  public.create_army (
    'e3000000-0000-0000-0000-000000000001'::uuid,
    'Second Army',
    'host_settlement',
    'e4000000-0000-0000-0000-000000000001'::uuid
  );

reset role;

select
  set_config(
    'gubernator.test_other_army_id',
    (
      select
        id::text
      from
        public.armies
      where
        nation_id = 'e3000000-0000-0000-0000-000000000001'
        and name = 'Second Army'
    ),
    false
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.create_army_group (
    current_setting('gubernator.test_other_army_id')::uuid,
    null,
    'Other Army Root',
    0
  );

reset role;

select
  set_config(
    'gubernator.test_other_root_group_id',
    (
      select
        id::text
      from
        public.army_groups
      where
        army_id = current_setting('gubernator.test_other_army_id')::uuid
        and name = 'Other Army Root'
    ),
    false
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.move_army_group(
      current_setting('gubernator.test_root_group_id')::uuid,
      current_setting('gubernator.test_other_root_group_id')::uuid
    )
  $test$,
    '22023',
    'new parent group must belong to the same army',
    'moving a group under a different army''s group is rejected'
  );

select
  throws_ok (
    $test$
    select public.create_army_unit(
      current_setting('gubernator.test_army_id')::uuid,
      current_setting('gubernator.test_other_root_group_id')::uuid,
      'e6000000-0000-0000-0000-000000000001'::uuid,
      'Cross Army Unit',
      0
    )
  $test$,
    '22023',
    'group must belong to the same army',
    'creating a unit in another army''s group is rejected'
  );

-- ---------------------------------------------------------------------------
-- Units: create, rename, move, delete.
-- ---------------------------------------------------------------------------
select
  ok (
    exists (
      select
        1
      from
        public.create_army_unit (
          current_setting('gubernator.test_army_id')::uuid,
          current_setting('gubernator.test_root_group_id')::uuid,
          'e6000000-0000-0000-0000-000000000001'::uuid,
          'First Unit',
          0
        )
    ),
    'nation manager can create a unit under a group'
  );

reset role;

select
  set_config(
    'gubernator.test_unit_id',
    (
      select
        id::text
      from
        public.army_units
      where
        army_id = current_setting('gubernator.test_army_id')::uuid
        and name = 'First Unit'
    ),
    false
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.move_army_unit (
          current_setting('gubernator.test_unit_id')::uuid,
          null,
          3
        )
      where
        group_id is null
        and sort_order = 3
    ),
    'nation manager can move a unit to the army root and reorder it'
  );

-- ---------------------------------------------------------------------------
-- Deletion guards: non-empty army/group rejected; emptied then succeeds.
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $test$ select public.delete_army_group(current_setting('gubernator.test_root_group_id')::uuid) $test$,
    '22023',
    'group must have no child groups or units before it can be deleted',
    'deleting a non-empty group is rejected'
  );

select
  throws_ok (
    $test$ select public.delete_army(current_setting('gubernator.test_army_id')::uuid) $test$,
    '22023',
    'army must have no groups or units before it can be deleted',
    'deleting a non-empty army is rejected'
  );

select
  lives_ok (
    $test$ select public.delete_army_unit(current_setting('gubernator.test_unit_id')::uuid) $test$,
    'nation manager can delete an empty unit'
  );

select
  lives_ok (
    $test$ select public.delete_army_group(current_setting('gubernator.test_depth5_id')::uuid) $test$,
    'nation manager can delete an empty leaf group'
  );

select
  lives_ok (
    $test$ select public.delete_army_group(current_setting('gubernator.test_depth4_id')::uuid) $test$,
    'nation manager can delete the now-empty parent group'
  );

select
  lives_ok (
    $test$ select public.delete_army_group(current_setting('gubernator.test_depth3_id')::uuid) $test$,
    'nation manager can delete the next now-empty parent group'
  );

select
  lives_ok (
    $test$ select public.delete_army_group(current_setting('gubernator.test_depth2_id')::uuid) $test$,
    'nation manager can delete the next now-empty parent group'
  );

select
  lives_ok (
    $test$ select public.delete_army_group(current_setting('gubernator.test_root_group_id')::uuid) $test$,
    'nation manager can delete the now-empty root group'
  );

select
  lives_ok (
    $test$ select public.delete_army(current_setting('gubernator.test_army_id')::uuid) $test$,
    'nation manager can delete the now-empty army'
  );

reset role;

-- ===========================================================================
-- RLS: outsider cannot read armies in an inaccessible world; world admin can.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.armies
      where
        nation_id = 'e3000000-0000-0000-0000-000000000001'
    ),
    0,
    'outsider cannot read armies in an inaccessible private world'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.armies
      where
        nation_id = 'e3000000-0000-0000-0000-000000000001'
    ),
    1,
    'world admin can read armies in the administered world'
  );

reset role;

select
  *
from
  finish ();

rollback;
