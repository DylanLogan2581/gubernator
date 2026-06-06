-- pgTAP tests for public.trade_routes RLS, triggers, and constraints.
-- Run with: npx supabase test db
--
-- Read visibility chains through settlements → nations: a route is visible
-- when either endpoint settlement's nation is visible to the caller. Hidden
-- nations stay private to super admins, world admins, and users whose player
-- character settlement belongs to that nation.
--
-- Writes: INSERT (propose) is open to world admins and nation managers on
-- either side. Direct UPDATE of approval columns, status, and
-- pause_reason_last_transition is blocked by column-level grants (42501) for
-- all authenticated callers; Cards 20–23 supply SECURITY DEFINER RPCs for the
-- approval lifecycle. Quantity changes go through replace_trade_route;
-- quantity_per_transition lives on trade_route_legs (SELECT-only grant).
--
-- UUID ranges (all numeric/hex, unique to this file):
--   c1xxxxxx = users          c2xxxxxx = worlds
--   c3xxxxxx = nations        c4xxxxxx = settlements
--   c5xxxxxx = resources      c6xxxxxx = citizens
--   c7xxxxxx = trade_routes   c8xxxxxx = trade_route_legs
begin;

select
  plan (15);

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
    'c1000000-0000-0000-0000-000000000001',
    'tr-owner@example.com',
    'x',
    now(),
    '{"username":"tr_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'tr-admin@example.com',
    'x',
    now(),
    '{"username":"tr_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'tr-origin-mgr@example.com',
    'x',
    now(),
    '{"username":"tr_origin_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000004',
    'tr-dest-mgr@example.com',
    'x',
    now(),
    '{"username":"tr_dest_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000005',
    'tr-outsider@example.com',
    'x',
    now(),
    '{"username":"tr_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000006',
    'tr-super@example.com',
    'x',
    now(),
    '{"username":"tr_super"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'c1000000-0000-0000-0000-000000000006';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'TR Main World',
    'c1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    'TR Other World',
    'c1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000002'
  );

-- Two visible nations for the main route, two hidden nations for the
-- hidden-pair visibility test.
insert into
  public.nations (id, world_id, name, is_hidden)
values
  (
    'c3000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'TR Origin Nation',
    false
  ),
  (
    'c3000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000001',
    'TR Destination Nation',
    false
  ),
  (
    'c3000000-0000-0000-0000-000000000003',
    'c2000000-0000-0000-0000-000000000001',
    'TR Hidden Nation A',
    true
  ),
  (
    'c3000000-0000-0000-0000-000000000004',
    'c2000000-0000-0000-0000-000000000001',
    'TR Hidden Nation B',
    true
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'c4000000-0000-0000-0000-000000000001',
    'c3000000-0000-0000-0000-000000000001',
    'TR Origin Settlement'
  ),
  (
    'c4000000-0000-0000-0000-000000000002',
    'c3000000-0000-0000-0000-000000000002',
    'TR Destination Settlement'
  ),
  (
    'c4000000-0000-0000-0000-000000000003',
    'c3000000-0000-0000-0000-000000000003',
    'TR Hidden Settlement A'
  ),
  (
    'c4000000-0000-0000-0000-000000000004',
    'c3000000-0000-0000-0000-000000000004',
    'TR Hidden Settlement B'
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'c5000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'TR Grain',
    'tr-grain'
  ),
  (
    'c5000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000002',
    'TR Other World Grain',
    'tr-other-grain'
  );

-- Origin nation manager PC (sits in origin settlement, role=nation_manager for
-- origin nation). Used as proposed_by_citizen_id and as the correct origin approver.
-- Destination manager (c6..002) doubles as the wrong-nation approver for the
-- approver-nation trigger test: their settlement is in destination nation (c3..002),
-- so using them as origin_approved_by_citizen_id (which expects c3..001) is rejected.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status,
    user_id,
    role_type,
    role_nation_id
  )
values
  (
    'c6000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'c4000000-0000-0000-0000-000000000001',
    'player_character',
    'TR Origin Manager PC',
    'alive',
    'c1000000-0000-0000-0000-000000000003',
    'nation_manager',
    'c3000000-0000-0000-0000-000000000001'
  ),
  -- Destination nation manager PC (sits in destination settlement).
  (
    'c6000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000001',
    'c4000000-0000-0000-0000-000000000002',
    'player_character',
    'TR Destination Manager PC',
    'alive',
    'c1000000-0000-0000-0000-000000000004',
    'nation_manager',
    'c3000000-0000-0000-0000-000000000002'
  );

-- Seed a visible route and a hidden-pair route as postgres (bypasses RLS and
-- column grants) so read tests have rows to target.
insert into
  public.trade_routes (
    id,
    origin_settlement_id,
    destination_settlement_id,
    proposed_by_citizen_id,
    status,
    origin_approval_status,
    destination_approval_status
  )
values
  (
    'c7000000-0000-0000-0000-000000000001',
    'c4000000-0000-0000-0000-000000000001',
    'c4000000-0000-0000-0000-000000000002',
    'c6000000-0000-0000-0000-000000000001',
    'proposed',
    'pending',
    'pending'
  ),
  -- Route between the two hidden nations: invisible to anyone without
  -- privileged access to both nations.
  (
    'c7000000-0000-0000-0000-000000000002',
    'c4000000-0000-0000-0000-000000000003',
    'c4000000-0000-0000-0000-000000000004',
    'c6000000-0000-0000-0000-000000000001',
    'proposed',
    'pending',
    'pending'
  );

-- A single leg for the visible route — used by the quantity_per_transition
-- column-grant tests below.
insert into
  public.trade_route_legs (
    id,
    trade_route_id,
    direction,
    resource_id,
    quantity_per_transition
  )
values
  (
    'c8000000-0000-0000-0000-000000000001',
    'c7000000-0000-0000-0000-000000000001',
    'send',
    'c5000000-0000-0000-0000-000000000001',
    50
  );

-- ===========================================================================
-- ANONYMOUS: cannot read trade_routes
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
        public.trade_routes
    ),
    0,
    'anon cannot read trade_routes'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: no world access → cannot read any route
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes
    ),
    0,
    'outsider cannot read any trade_routes'
  );

reset role;

-- ===========================================================================
-- READ FROM ORIGIN SIDE: origin nation manager sees the visible route
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.trade_routes
      where
        id = 'c7000000-0000-0000-0000-000000000001'
    ),
    'origin nation manager can read the visible route (origin-side visibility)'
  );

reset role;

-- ===========================================================================
-- READ FROM DESTINATION SIDE: destination nation manager sees the same route
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.trade_routes
      where
        id = 'c7000000-0000-0000-0000-000000000001'
    ),
    'destination nation manager can read the visible route (destination-side visibility)'
  );

reset role;

-- ===========================================================================
-- HIDDEN PAIR: the origin nation manager cannot read a route when both
-- endpoint nations are hidden. The manager has world access via their PC in
-- the visible origin nation but holds no privileged path into the two hidden
-- nations, so neither arm of the SELECT policy matches.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.trade_routes
      where
        id = 'c7000000-0000-0000-0000-000000000002'
    ),
    'origin nation manager cannot read a route when both endpoint nations are hidden'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: can insert and update non-restricted columns
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.trade_routes (
      id,
      origin_settlement_id,
      destination_settlement_id,
      proposed_by_citizen_id
    ) values (
      'c7000000-0000-0000-0000-000000000010',
      'c4000000-0000-0000-0000-000000000001',
      'c4000000-0000-0000-0000-000000000002',
      'c6000000-0000-0000-0000-000000000001'
    )
  $test$,
    'world admin can insert a trade route'
  );

select
  throws_ok (
    $test$
    update public.trade_routes
    set pause_reason_last_transition = 'stockpile_empty'
    where id = 'c7000000-0000-0000-0000-000000000010'
  $test$,
    '42501',
    null,
    'world admin cannot directly update pause_reason_last_transition (simulation-only field)'
  );

select
  throws_ok (
    $test$
    update public.trade_route_legs
    set quantity_per_transition = 9999
    where id = 'c8000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'world admin cannot directly update quantity_per_transition on trade_route_legs'
  );

reset role;

-- ===========================================================================
-- ORIGIN NATION MANAGER: can insert (propose) a route
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.trade_routes (
      id,
      origin_settlement_id,
      destination_settlement_id,
      proposed_by_citizen_id
    ) values (
      'c7000000-0000-0000-0000-000000000011',
      'c4000000-0000-0000-0000-000000000001',
      'c4000000-0000-0000-0000-000000000002',
      'c6000000-0000-0000-0000-000000000001'
    )
  $test$,
    'origin nation manager can insert (propose) a trade route'
  );

reset role;

-- ===========================================================================
-- MANAGER: cannot update approval columns directly (column grant restriction)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    update public.trade_routes
    set origin_approval_status = 'approved'
    where id = 'c7000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'origin nation manager cannot directly update origin_approval_status'
  );

select
  throws_ok (
    $test$
    update public.trade_routes
    set status = 'active'
    where id = 'c7000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'origin nation manager cannot directly update status'
  );

select
  throws_ok (
    $test$
    update public.trade_route_legs
    set quantity_per_transition = 9999
    where id = 'c8000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'origin nation manager cannot directly update quantity_per_transition on trade_route_legs'
  );

reset role;

-- ===========================================================================
-- ANONYMOUS: cannot insert
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
    insert into public.trade_routes (
      origin_settlement_id,
      destination_settlement_id,
      proposed_by_citizen_id
    ) values (
      'c4000000-0000-0000-0000-000000000001',
      'c4000000-0000-0000-0000-000000000002',
      'c6000000-0000-0000-0000-000000000001'
    )
  $test$,
    '42501',
    null,
    'anon cannot insert trade_routes'
  );

reset role;

-- ===========================================================================
-- CONSTRAINT: approver citizen from wrong nation rejected (errcode = 23503)
-- ===========================================================================
-- Citizen c6..002 (destination manager) lives in destination settlement
-- (nation c3..002). Setting them as the origin approver targets nation c3..001 —
-- a mismatch that the approver-nation trigger must reject.
select
  throws_ok (
    $test$
    update public.trade_routes
    set origin_approved_by_citizen_id = 'c6000000-0000-0000-0000-000000000002'
    where id = 'c7000000-0000-0000-0000-000000000001'
  $test$,
    '23503',
    null,
    'approver citizen from wrong nation is rejected by the approver-nation trigger'
  );

-- ===========================================================================
-- CONSTRAINT: origin_settlement_id = destination_settlement_id rejected (23514)
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.trade_routes (
      origin_settlement_id,
      destination_settlement_id,
      proposed_by_citizen_id
    ) values (
      'c4000000-0000-0000-0000-000000000001',
      'c4000000-0000-0000-0000-000000000001',
      'c6000000-0000-0000-0000-000000000001'
    )
  $test$,
    '23514',
    null,
    'self-referential settlement pair is rejected by the distinct_settlements check'
  );

select
  *
from
  finish ();

rollback;
