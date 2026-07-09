-- pgTAP tests for public.nation_currency_snapshots RLS (#1094, discovery-
-- gated per #1132).
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
--   f1xxxxxx = users          f2xxxxxx = worlds
--   f3xxxxxx = nations        f4xxxxxx = settlements
--   f5xxxxxx = turn_transitions  f6xxxxxx = citizens
--   f7xxxxxx = resources      f8xxxxxx = nation_currencies
--   f9xxxxxx = nation_currency_snapshots
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
    'f1000000-0000-0000-0000-000000000001',
    'ncsnap-admin@example.com',
    'x',
    now(),
    '{"username":"ncsnap_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'ncsnap-member@example.com',
    'x',
    now(),
    '{"username":"ncsnap_member"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000003',
    'ncsnap-outsider@example.com',
    'x',
    now(),
    '{"username":"ncsnap_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000004',
    'ncsnap-undiscovered@example.com',
    'x',
    now(),
    '{"username":"ncsnap_undiscovered"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'Nation Currency Snapshot World',
    3,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Nation Currency Snapshot Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    'Nation Currency Snapshot Settlement'
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
    'f6000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'player_character',
    'Nation Currency Snapshot Member',
    'alive',
    'f1000000-0000-0000-0000-000000000002'
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'f7000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Nation Currency Snapshot Grain',
    'ncsnap-grain'
  );

insert into
  public.nation_currencies (
    id,
    world_id,
    nation_id,
    name,
    symbol,
    currency_type,
    money_supply,
    reserve_quantity,
    confidence,
    established_turn_number
  )
values
  (
    'f8000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    'Nation Currency Snapshot Crown',
    'NCS',
    'fiat',
    10,
    0,
    1,
    2
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
    'f5000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    2,
    3,
    'f1000000-0000-0000-0000-000000000001',
    'completed',
    now()
  );

insert into
  public.nation_currency_snapshots (
    id,
    turn_transition_id,
    world_id,
    nation_id,
    currency_id,
    turn_number,
    money_supply,
    reserve_quantity,
    confidence,
    minted,
    burned
  )
values
  (
    'f9000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    'f8000000-0000-0000-0000-000000000001',
    3,
    10,
    0,
    1,
    0,
    0
  );

-- Second nation in the same world, undiscovered by the snapshot's nation (no
-- nation_discoveries row between them), with its own PC-holding member --
-- world access alone must not leak the snapshot.
insert into
  public.nations (id, world_id, name)
values
  (
    'f3000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'Nation Currency Snapshot Undiscovered Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f4000000-0000-0000-0000-000000000002',
    'f3000000-0000-0000-0000-000000000002',
    'Nation Currency Snapshot Undiscovered Settlement'
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
    'f6000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000002',
    'player_character',
    'Nation Currency Snapshot Undiscovered Member',
    'alive',
    'f1000000-0000-0000-0000-000000000004'
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
        public.nation_currency_snapshots
    ),
    0,
    'anon cannot read nation_currency_snapshots'
  );

reset role;

-- ===========================================================================
-- MEMBER: world member (PC holder) can read
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.nation_currency_snapshots
      where
        id = 'f9000000-0000-0000-0000-000000000001'
    ),
    'world member can read nation_currency_snapshots in their world'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: cannot read snapshots for a world they have no access to
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.nation_currency_snapshots
      where
        id = 'f9000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read nation_currency_snapshots in an inaccessible world'
  );

reset role;

-- ===========================================================================
-- UNDISCOVERED-NATION MEMBER: world access via own nation, but that nation
-- has not met the snapshot's nation -- must not see the snapshot (#1132).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.nation_currency_snapshots
      where
        id = 'f9000000-0000-0000-0000-000000000001'
    ),
    'member of an undiscovered nation cannot read another nation''s currency snapshot'
  );

reset role;

-- ===========================================================================
-- WRITE DENIED: world admin cannot directly insert or update (RPC-only table)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.nation_currency_snapshots (
      turn_transition_id, world_id, nation_id, currency_id, turn_number,
      money_supply, reserve_quantity, confidence, minted, burned
    ) values (
      'f5000000-0000-0000-0000-000000000001',
      'f2000000-0000-0000-0000-000000000001',
      'f3000000-0000-0000-0000-000000000001',
      'f8000000-0000-0000-0000-000000000001',
      4,
      10, 0, 1, 0, 0
    )
    $test$,
    '42501',
    null,
    'world admin cannot directly insert a nation_currency_snapshots row (no grant; RPC-only)'
  );

update public.nation_currency_snapshots
set
  turn_number = 99
where
  id = 'f9000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        turn_number
      from
        public.nation_currency_snapshots
      where
        id = 'f9000000-0000-0000-0000-000000000001'
    ),
    3,
    'world admin cannot directly update a nation_currency_snapshots row (RLS filters the row, update affects zero rows)'
  );

select
  *
from
  finish ();

rollback;
