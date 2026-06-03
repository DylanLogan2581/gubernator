-- pgTAP tests for public.settlement_turn_resource_snapshots RLS and constraints.
-- Run with: npx supabase test db
--
-- RLS matrix:
--   SELECT  — world-access reads succeed (owner, world admin, super admin, PC holder)
--   INSERT  — admin-only (world admin or super admin); non-admins and PC-holders denied
--   UPDATE  — blocked for all authenticated callers (column grant; append-only table)
--   DELETE  — admin-only
--   cross-world reads/writes denied for outsiders
--
-- UUID ranges (all numeric/hex, unique to this file):
--   e1xxxxxx = users          e2xxxxxx = worlds
--   e3xxxxxx = nations        e4xxxxxx = settlements
--   e5xxxxxx = turn_transitions  e6xxxxxx = resources
--   e7xxxxxx = citizens       e8xxxxxx = settlement_turn_resource_snapshots
begin;

select
  plan (13);

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
    'rsnap-owner@example.com',
    'x',
    now(),
    '{"username":"rsnap_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'rsnap-admin@example.com',
    'x',
    now(),
    '{"username":"rsnap_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'rsnap-outsider@example.com',
    'x',
    now(),
    '{"username":"rsnap_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'rsnap-superadmin@example.com',
    'x',
    now(),
    '{"username":"rsnap_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000005',
    'rsnap-pc-holder@example.com',
    'x',
    now(),
    '{"username":"rsnap_pc_holder"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (
    id,
    name,
    owner_id,
    current_turn_number,
    visibility,
    status
  )
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'RSnap Private World',
    'e1000000-0000-0000-0000-000000000001',
    3,
    'private',
    'active'
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'RSnap Outsider World',
    'e1000000-0000-0000-0000-000000000003',
    1,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'RSnap Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'RSnap Settlement'
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'e6000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'RSnap Grain',
    'rsnap-grain'
  ),
  (
    'e6000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'RSnap Iron',
    'rsnap-iron'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status,
    user_id,
    role_type
  )
values
  (
    'e7000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'player_character',
    'RSnap PC Holder Citizen',
    'alive',
    'e1000000-0000-0000-0000-000000000005',
    'none'
  );

insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status,
    finished_at
  )
values
  (
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    2,
    3,
    'e1000000-0000-0000-0000-000000000001',
    'completed',
    now()
  ),
  (
    'e5000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000002',
    0,
    1,
    'e1000000-0000-0000-0000-000000000003',
    'completed',
    now()
  );

insert into
  public.settlement_turn_resource_snapshots (
    id,
    turn_transition_id,
    world_id,
    settlement_id,
    resource_id,
    turn_number,
    quantity_before,
    quantity_after
  )
values
  (
    'e8000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000001',
    3,
    100.0,
    90.0
  );

-- ===========================================================================
-- ANONYMOUS: no read access
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
        public.settlement_turn_resource_snapshots
    ),
    0,
    'anon cannot read settlement_turn_resource_snapshots'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: cannot read private-world snapshots (cross-world read denied)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.settlement_turn_resource_snapshots
      where
        id = 'e8000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read resource snapshots in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.settlement_turn_resource_snapshots (
      turn_transition_id, world_id, settlement_id, resource_id, turn_number,
      quantity_before, quantity_after
    ) values (
      'e5000000-0000-0000-0000-000000000001',
      'e2000000-0000-0000-0000-000000000001',
      'e4000000-0000-0000-0000-000000000001',
      'e6000000-0000-0000-0000-000000000001',
      3, 100.0, 90.0
    )
    $test$,
    '42501',
    null,
    'outsider cannot insert resource snapshots into an inaccessible world'
  );

reset role;

-- ===========================================================================
-- OWNER: world owner can read snapshots in their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_resource_snapshots
      where
        id = 'e8000000-0000-0000-0000-000000000001'
    ),
    'owner can read resource snapshots in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: can read and manage snapshots in the administered world
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
        public.settlement_turn_resource_snapshots
      where
        id = 'e8000000-0000-0000-0000-000000000001'
    ),
    'world admin can read resource snapshots in administered world'
  );

select
  lives_ok (
    $test$
    insert into public.settlement_turn_resource_snapshots (
      id, turn_transition_id, world_id, settlement_id, resource_id, turn_number,
      quantity_before, quantity_after
    ) values (
      'e8000000-0000-0000-0000-000000000002',
      'e5000000-0000-0000-0000-000000000001',
      'e2000000-0000-0000-0000-000000000001',
      'e4000000-0000-0000-0000-000000000001',
      'e6000000-0000-0000-0000-000000000002',
      3, 50.0, 40.0
    )
    $test$,
    'world admin can insert a resource snapshot row'
  );

select
  throws_ok (
    $test$
    update public.settlement_turn_resource_snapshots
    set turn_number = 99
    where id = 'e8000000-0000-0000-0000-000000000002'
    $test$,
    '42501',
    null,
    'world admin cannot directly update a resource snapshot row (column grant enforces append-only)'
  );

select
  lives_ok (
    $test$
    delete from public.settlement_turn_resource_snapshots
    where id = 'e8000000-0000-0000-0000-000000000002'
    $test$,
    'world admin can delete a resource snapshot row'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read across worlds and insert into any world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_resource_snapshots
      where
        id = 'e8000000-0000-0000-0000-000000000001'
    ),
    'super admin can read resource snapshots across worlds'
  );

select
  lives_ok (
    $test$
    insert into public.settlement_turn_resource_snapshots (
      id, turn_transition_id, world_id, settlement_id, resource_id, turn_number,
      quantity_before, quantity_after
    ) values (
      'e8000000-0000-0000-0000-000000000003',
      'e5000000-0000-0000-0000-000000000001',
      'e2000000-0000-0000-0000-000000000001',
      'e4000000-0000-0000-0000-000000000001',
      'e6000000-0000-0000-0000-000000000002',
      3, 200.0, 180.0
    )
    $test$,
    'super admin can insert a resource snapshot row in any world'
  );

reset role;

-- ===========================================================================
-- PC HOLDER: user with a living player character in the world can read via
-- the current_user_has_world_access player-character path
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_resource_snapshots
      where
        id = 'e8000000-0000-0000-0000-000000000001'
    ),
    'pc holder can read resource snapshots in a private world they have PC access to'
  );

select
  throws_ok (
    $test$
    insert into public.settlement_turn_resource_snapshots (
      turn_transition_id, world_id, settlement_id, resource_id, turn_number,
      quantity_before, quantity_after
    ) values (
      'e5000000-0000-0000-0000-000000000001',
      'e2000000-0000-0000-0000-000000000001',
      'e4000000-0000-0000-0000-000000000001',
      'e6000000-0000-0000-0000-000000000001',
      3, 100.0, 90.0
    )
    $test$,
    '42501',
    null,
    'pc holder (non-admin) cannot directly insert resource snapshot rows'
  );

reset role;

-- ===========================================================================
-- CONSTRAINT: composite FK rejects (turn_transition_id, world_id) mismatch
-- (postgres role bypasses RLS and column grants)
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.settlement_turn_resource_snapshots (
      turn_transition_id, world_id, settlement_id, resource_id, turn_number,
      quantity_before, quantity_after
    ) values (
      'e5000000-0000-0000-0000-000000000002',
      'e2000000-0000-0000-0000-000000000001',
      'e4000000-0000-0000-0000-000000000001',
      'e6000000-0000-0000-0000-000000000001',
      3, 100.0, 90.0
    )
    $test$,
    '23503',
    null,
    'composite FK rejects turn_transition_id from a different world'
  );

rollback;
