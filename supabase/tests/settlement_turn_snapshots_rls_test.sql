-- pgTAP tests for public.settlement_turn_snapshots RLS and constraints.
-- Run with: npx supabase test db
--
-- RLS matrix:
--   SELECT  — world-access reads succeed (owner, world admin, super admin, PC holder)
--   INSERT  — blocked for all authenticated callers (grant revoked; RPC is sole write path)
--   UPDATE  — blocked for all authenticated callers (grant revoked; append-only table)
--   DELETE  — super admin only (incident-recovery escape hatch); world admin denied
--   cross-world reads/writes denied for outsiders
--
-- UUID ranges (all numeric/hex, unique to this file):
--   d1xxxxxx = users          d2xxxxxx = worlds
--   d3xxxxxx = nations        d4xxxxxx = settlements
--   d5xxxxxx = turn_transitions  d6xxxxxx = citizens
--   d7xxxxxx = settlement_turn_snapshots
begin;

select
  plan (14);

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
    'd1000000-0000-0000-0000-000000000001',
    'snap-owner@example.com',
    'x',
    now(),
    '{"username":"snap_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'snap-admin@example.com',
    'x',
    now(),
    '{"username":"snap_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'snap-outsider@example.com',
    'x',
    now(),
    '{"username":"snap_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000004',
    'snap-superadmin@example.com',
    'x',
    now(),
    '{"username":"snap_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000005',
    'snap-pc-holder@example.com',
    'x',
    now(),
    '{"username":"snap_pc_holder"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'd1000000-0000-0000-0000-000000000004';

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
    'd2000000-0000-0000-0000-000000000001',
    'Snap Private World',
    'd1000000-0000-0000-0000-000000000001',
    3,
    'private',
    'active'
  ),
  (
    'd2000000-0000-0000-0000-000000000002',
    'Snap Outsider World',
    'd1000000-0000-0000-0000-000000000003',
    1,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'd3000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Snap Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd4000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000001',
    'Snap Settlement'
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
    'd6000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000001',
    'player_character',
    'Snap PC Holder Citizen',
    'alive',
    'd1000000-0000-0000-0000-000000000005',
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
    'd5000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    2,
    3,
    'd1000000-0000-0000-0000-000000000001',
    'completed',
    now()
  ),
  (
    'd5000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000002',
    0,
    1,
    'd1000000-0000-0000-0000-000000000003',
    'completed',
    now()
  );

insert into
  public.settlement_turn_snapshots (
    id,
    turn_transition_id,
    world_id,
    settlement_id,
    turn_number,
    population_total,
    population_npc,
    population_player_character,
    population_cap
  )
values
  (
    'd7000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000001',
    3,
    10,
    9,
    1,
    50
  ),
  (
    'd7000000-0000-0000-0000-000000000002',
    null,
    'd2000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000001',
    4,
    12,
    11,
    1,
    50
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
        public.settlement_turn_snapshots
    ),
    0,
    'anon cannot read settlement_turn_snapshots'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: cannot read private-world snapshots (cross-world read denied)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.settlement_turn_snapshots
      where
        id = 'd7000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read snapshots in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.settlement_turn_snapshots (
      turn_transition_id, world_id, settlement_id, turn_number,
      population_total, population_npc, population_player_character, population_cap
    ) values (
      'd5000000-0000-0000-0000-000000000001',
      'd2000000-0000-0000-0000-000000000001',
      'd4000000-0000-0000-0000-000000000001',
      3, 10, 9, 1, 50
    )
    $test$,
    '42501',
    null,
    'outsider cannot insert snapshots into an inaccessible world'
  );

reset role;

-- ===========================================================================
-- OWNER: world owner can read snapshots in their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_snapshots
      where
        id = 'd7000000-0000-0000-0000-000000000001'
    ),
    'owner can read snapshots in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: can read snapshots; direct INSERT/UPDATE/DELETE are denied
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_snapshots
      where
        id = 'd7000000-0000-0000-0000-000000000001'
    ),
    'world admin can read snapshots in administered world'
  );

select
  throws_ok (
    $test$
    insert into public.settlement_turn_snapshots (
      id, turn_transition_id, world_id, settlement_id, turn_number,
      population_total, population_npc, population_player_character, population_cap
    ) values (
      'd7000000-0000-0000-0000-000000000002',
      null,
      'd2000000-0000-0000-0000-000000000001',
      'd4000000-0000-0000-0000-000000000001',
      4, 12, 11, 1, 50
    )
    $test$,
    '42501',
    null,
    'world admin cannot directly insert a snapshot row (INSERT grant revoked)'
  );

select
  throws_ok (
    $test$
    update public.settlement_turn_snapshots
    set turn_number = 99
    where id = 'd7000000-0000-0000-0000-000000000001'
    $test$,
    '42501',
    null,
    'world admin cannot directly update a snapshot row (grant revoked; append-only)'
  );

select
  throws_ok (
    $test$
    delete from public.settlement_turn_snapshots
    where id = 'd7000000-0000-0000-0000-000000000001'
    $test$,
    '42501',
    null,
    'world admin cannot directly delete a snapshot row (policy dropped)'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read across worlds; INSERT blocked (grant revoked);
-- DELETE allowed as incident-recovery escape hatch
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_snapshots
      where
        id = 'd7000000-0000-0000-0000-000000000001'
    ),
    'super admin can read snapshots across worlds'
  );

select
  throws_ok (
    $test$
    insert into public.settlement_turn_snapshots (
      id, turn_transition_id, world_id, settlement_id, turn_number,
      population_total, population_npc, population_player_character, population_cap
    ) values (
      'd7000000-0000-0000-0000-000000000003',
      null,
      'd2000000-0000-0000-0000-000000000001',
      'd4000000-0000-0000-0000-000000000001',
      5, 15, 14, 1, 50
    )
    $test$,
    '42501',
    null,
    'super admin cannot directly insert a snapshot row (INSERT grant revoked; use RPC)'
  );

select
  lives_ok (
    $test$
    delete from public.settlement_turn_snapshots
    where id = 'd7000000-0000-0000-0000-000000000002'
    $test$,
    'super admin can delete a snapshot row (incident-recovery escape hatch)'
  );

reset role;

-- ===========================================================================
-- PC HOLDER: user with a living player character in the world can read via
-- the current_user_has_world_access player-character path
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_snapshots
      where
        id = 'd7000000-0000-0000-0000-000000000001'
    ),
    'pc holder can read snapshots in a private world they have PC access to'
  );

select
  throws_ok (
    $test$
    insert into public.settlement_turn_snapshots (
      turn_transition_id, world_id, settlement_id, turn_number,
      population_total, population_npc, population_player_character, population_cap
    ) values (
      'd5000000-0000-0000-0000-000000000001',
      'd2000000-0000-0000-0000-000000000001',
      'd4000000-0000-0000-0000-000000000001',
      3, 10, 9, 1, 50
    )
    $test$,
    '42501',
    null,
    'pc holder (non-admin) cannot directly insert snapshot rows'
  );

reset role;

-- ===========================================================================
-- CONSTRAINT: composite FK rejects (turn_transition_id, world_id) mismatch
-- (postgres role bypasses RLS and column grants)
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.settlement_turn_snapshots (
      turn_transition_id, world_id, settlement_id, turn_number,
      population_total, population_npc, population_player_character, population_cap
    ) values (
      'd5000000-0000-0000-0000-000000000002',
      'd2000000-0000-0000-0000-000000000001',
      'd4000000-0000-0000-0000-000000000001',
      3, 10, 9, 1, 50
    )
    $test$,
    '23503',
    null,
    'composite FK rejects turn_transition_id from a different world'
  );

rollback;
