-- pgTAP tests for public.nation_turn_snapshots RLS (#1083, discovery-gated
-- per #1132).
-- Run with: npx supabase test db
--
-- RLS matrix:
--   SELECT — visible reads succeed (world admin, PC holder in the snapshot's
--     nation); outsider (no world access) and undiscovered-nation member
--     (world access, but home nation has not met the snapshot's nation)
--     both denied
--   INSERT/UPDATE — blocked for all authenticated callers (no grant; RPC-only)
--
-- UUID ranges (all numeric/hex, unique to this file):
--   e1xxxxxx = users          e2xxxxxx = worlds
--   e3xxxxxx = nations        e4xxxxxx = settlements
--   e5xxxxxx = turn_transitions  e6xxxxxx = citizens
--   e7xxxxxx = nation_turn_snapshots
begin;

select
  plan (6);

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
    'ntsnap-admin@example.com',
    'x',
    now(),
    '{"username":"ntsnap_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'ntsnap-member@example.com',
    'x',
    now(),
    '{"username":"ntsnap_member"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'ntsnap-outsider@example.com',
    'x',
    now(),
    '{"username":"ntsnap_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'ntsnap-undiscovered@example.com',
    'x',
    now(),
    '{"username":"ntsnap_undiscovered"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Nation Snapshot World',
    3,
    'private',
    'active'
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
    'Nation Snapshot Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'Nation Snapshot Settlement'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id
  )
values
  (
    'e6000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'player_character',
    'Nation Snapshot Member',
    'alive',
    'e1000000-0000-0000-0000-000000000002'
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
  );

insert into
  public.nation_turn_snapshots (
    id,
    turn_transition_id,
    world_id,
    nation_id,
    turn_number,
    tax_collected_by_resource_json
  )
values
  (
    'e7000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    3,
    '{}'::jsonb
  );

-- Second nation in the same world, undiscovered by the snapshot's nation (no
-- nation_discoveries row between them), with its own PC-holding member --
-- world access alone must not leak the snapshot.
insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'Nation Snapshot Undiscovered Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000002',
    'e3000000-0000-0000-0000-000000000002',
    'Nation Snapshot Undiscovered Settlement'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id
  )
values
  (
    'e6000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000002',
    'player_character',
    'Nation Snapshot Undiscovered Member',
    'alive',
    'e1000000-0000-0000-0000-000000000004'
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
        public.nation_turn_snapshots
    ),
    0,
    'anon cannot read nation_turn_snapshots'
  );

reset role;

-- ===========================================================================
-- MEMBER: world member (PC holder) can read
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
        public.nation_turn_snapshots
      where
        id = 'e7000000-0000-0000-0000-000000000001'
    ),
    'world member can read nation_turn_snapshots in their world'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: cannot read snapshots for a world they have no access to
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
        public.nation_turn_snapshots
      where
        id = 'e7000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read nation_turn_snapshots in an inaccessible world'
  );

reset role;

-- ===========================================================================
-- UNDISCOVERED-NATION MEMBER: world access via own nation, but that nation
-- has not met the snapshot's nation -- must not see the snapshot (#1132).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.nation_turn_snapshots
      where
        id = 'e7000000-0000-0000-0000-000000000001'
    ),
    'member of an undiscovered nation cannot read another nation''s turn snapshot'
  );

reset role;

-- ===========================================================================
-- WRITE DENIED: world admin cannot directly insert or update (RPC-only table)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.nation_turn_snapshots (
      turn_transition_id, world_id, nation_id, turn_number, tax_collected_by_resource_json
    ) values (
      'e5000000-0000-0000-0000-000000000001',
      'e2000000-0000-0000-0000-000000000001',
      'e3000000-0000-0000-0000-000000000001',
      4,
      '{}'::jsonb
    )
    $test$,
    '42501',
    null,
    'world admin cannot directly insert a nation_turn_snapshots row (no grant; RPC-only)'
  );

update public.nation_turn_snapshots
set
  turn_number = 99
where
  id = 'e7000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        turn_number
      from
        public.nation_turn_snapshots
      where
        id = 'e7000000-0000-0000-0000-000000000001'
    ),
    3,
    'world admin cannot directly update a nation_turn_snapshots row (RLS filters the row, update affects zero rows)'
  );

select
  *
from
  finish ();

rollback;
