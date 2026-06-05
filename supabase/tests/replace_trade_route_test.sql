-- pgTAP tests for public.replace_trade_route RPC.
-- Run with: npx supabase test db
begin;

select
  plan (13);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all dd-prefixed, unique to this file):
--   dd1xxxxx = users          dd2xxxxx = worlds
--   dd3xxxxx = nations        dd4xxxxx = settlements
--   dd5xxxxx = resources      dd6xxxxx = citizens
--   dd7xxxxx = trade_routes
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
    'dd-owner@example.com',
    'x',
    now(),
    '{"username":"dd_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'dd100000-0000-0000-0000-000000000002',
    'dd-origin-mgr@example.com',
    'x',
    now(),
    '{"username":"dd_origin_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'dd100000-0000-0000-0000-000000000003',
    'dd-dest-mgr@example.com',
    'x',
    now(),
    '{"username":"dd_dest_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'dd100000-0000-0000-0000-000000000004',
    'dd-no-role@example.com',
    'x',
    now(),
    '{"username":"dd_no_role"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'dd200000-0000-0000-0000-000000000001',
    'DD World',
    'dd100000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'dd300000-0000-0000-0000-000000000001',
    'dd200000-0000-0000-0000-000000000001',
    'DD Origin Nation'
  ),
  (
    'dd300000-0000-0000-0000-000000000002',
    'dd200000-0000-0000-0000-000000000001',
    'DD Destination Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'dd400000-0000-0000-0000-000000000001',
    'dd300000-0000-0000-0000-000000000001',
    'DD Origin Settlement'
  ),
  (
    'dd400000-0000-0000-0000-000000000002',
    'dd300000-0000-0000-0000-000000000002',
    'DD Destination Settlement'
  );

insert into
  public.resources (id, world_id, name, slug, is_trashed)
values
  (
    'dd500000-0000-0000-0000-000000000001',
    'dd200000-0000-0000-0000-000000000001',
    'DD Grain',
    'dd-grain',
    false
  ),
  (
    'dd500000-0000-0000-0000-000000000002',
    'dd200000-0000-0000-0000-000000000001',
    'DD Trashed Resource',
    'dd-trashed',
    true
  );

-- Citizens:
--   dd6...001 – Origin Nation manager PC (user dd1...002)
--   dd6...002 – Destination Nation manager PC (user dd1...003)
--   dd6...003 – NPC proposer in Origin Settlement (used as proposed_by_citizen_id)
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    name,
    status,
    user_id,
    role_type,
    role_nation_id,
    role_settlement_id,
    settlement_id
  )
values
  (
    'dd600000-0000-0000-0000-000000000001',
    'dd200000-0000-0000-0000-000000000001',
    'player_character',
    'DD Origin Nation Mgr PC',
    'alive',
    'dd100000-0000-0000-0000-000000000002',
    'nation_manager',
    'dd300000-0000-0000-0000-000000000001',
    null,
    'dd400000-0000-0000-0000-000000000001'
  ),
  (
    'dd600000-0000-0000-0000-000000000002',
    'dd200000-0000-0000-0000-000000000001',
    'player_character',
    'DD Destination Nation Mgr PC',
    'alive',
    'dd100000-0000-0000-0000-000000000003',
    'nation_manager',
    'dd300000-0000-0000-0000-000000000002',
    null,
    'dd400000-0000-0000-0000-000000000002'
  ),
  (
    'dd600000-0000-0000-0000-000000000003',
    'dd200000-0000-0000-0000-000000000001',
    'npc',
    'DD NPC Origin',
    'alive',
    null,
    'none',
    null,
    null,
    'dd400000-0000-0000-0000-000000000001'
  );

-- Trade routes:
--   dd7...001 – active, used for replace success tests
--   dd7...002 – active, used for destination-manager replace test
--   dd7...003 – proposed, used for admin replace test
--   dd7...004 – cancelled, used for already-cancelled rejection test
--   dd7...005 – replaced, used for already-replaced rejection test
insert into
  public.trade_routes (
    id,
    origin_settlement_id,
    destination_settlement_id,
    status,
    proposed_by_citizen_id,
    origin_approval_status,
    destination_approval_status
  )
values
  (
    'dd700000-0000-0000-0000-000000000001',
    'dd400000-0000-0000-0000-000000000001',
    'dd400000-0000-0000-0000-000000000002',
    'active',
    'dd600000-0000-0000-0000-000000000003',
    'approved',
    'approved'
  ),
  (
    'dd700000-0000-0000-0000-000000000002',
    'dd400000-0000-0000-0000-000000000001',
    'dd400000-0000-0000-0000-000000000002',
    'active',
    'dd600000-0000-0000-0000-000000000003',
    'approved',
    'approved'
  ),
  (
    'dd700000-0000-0000-0000-000000000003',
    'dd400000-0000-0000-0000-000000000001',
    'dd400000-0000-0000-0000-000000000002',
    'proposed',
    'dd600000-0000-0000-0000-000000000003',
    'pending',
    'pending'
  ),
  (
    'dd700000-0000-0000-0000-000000000004',
    'dd400000-0000-0000-0000-000000000001',
    'dd400000-0000-0000-0000-000000000002',
    'cancelled',
    'dd600000-0000-0000-0000-000000000003',
    'pending',
    'pending'
  ),
  (
    'dd700000-0000-0000-0000-000000000005',
    'dd400000-0000-0000-0000-000000000001',
    'dd400000-0000-0000-0000-000000000002',
    'replaced',
    'dd600000-0000-0000-0000-000000000003',
    'approved',
    'approved'
  ),
  (
    'dd700000-0000-0000-0000-000000000006',
    'dd400000-0000-0000-0000-000000000001',
    'dd400000-0000-0000-0000-000000000002',
    'active',
    'dd600000-0000-0000-0000-000000000003',
    'approved',
    'approved'
  );

insert into
  public.trade_route_legs (
    trade_route_id,
    direction,
    resource_id,
    quantity_per_transition
  )
values
  (
    'dd700000-0000-0000-0000-000000000001',
    'send',
    'dd500000-0000-0000-0000-000000000001',
    10
  ),
  (
    'dd700000-0000-0000-0000-000000000002',
    'send',
    'dd500000-0000-0000-0000-000000000001',
    5
  ),
  (
    'dd700000-0000-0000-0000-000000000003',
    'send',
    'dd500000-0000-0000-0000-000000000001',
    8
  ),
  (
    'dd700000-0000-0000-0000-000000000004',
    'send',
    'dd500000-0000-0000-0000-000000000001',
    3
  ),
  (
    'dd700000-0000-0000-0000-000000000005',
    'send',
    'dd500000-0000-0000-0000-000000000001',
    7
  ),
  (
    'dd700000-0000-0000-0000-000000000006',
    'send',
    'dd500000-0000-0000-0000-000000000001',
    9
  );

-- ===========================================================================
-- ANONYMOUS: rejected (42501) — grant is only to authenticated
-- ===========================================================================
set
  local role anon;

select
  throws_ok (
    $test$
    select public.replace_trade_route(
      'dd700000-0000-0000-0000-000000000001',
      '{"origin_settlement_id":"dd400000-0000-0000-0000-000000000001","destination_settlement_id":"dd400000-0000-0000-0000-000000000002","legs":[{"direction":"send","resource_id":"dd500000-0000-0000-0000-000000000001","quantity":15}]}'::jsonb,
      'dd600000-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- NO-ROLE AUTHENTICATED USER: rejected (42501)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dd100000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.replace_trade_route(
      'dd700000-0000-0000-0000-000000000001',
      '{"origin_settlement_id":"dd400000-0000-0000-0000-000000000001","destination_settlement_id":"dd400000-0000-0000-0000-000000000002","legs":[{"direction":"send","resource_id":"dd500000-0000-0000-0000-000000000001","quantity":15}]}'::jsonb,
      'dd600000-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'authenticated user with no nation role is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- ORIGIN MANAGER SUCCESS — new route links to old, old flips to replaced,
-- new route is proposed, notifications written
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dd100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.replace_trade_route(
      'dd700000-0000-0000-0000-000000000001',
      '{"origin_settlement_id":"dd400000-0000-0000-0000-000000000001","destination_settlement_id":"dd400000-0000-0000-0000-000000000002","legs":[{"direction":"send","resource_id":"dd500000-0000-0000-0000-000000000001","quantity":15}]}'::jsonb,
      'dd600000-0000-0000-0000-000000000001'
    )
    $test$,
    'origin manager can replace an active route'
  );

reset role;

-- Old route status flipped to 'replaced'
select
  is (
    (
      select
        tr.status
      from
        public.trade_routes tr
      where
        tr.id = 'dd700000-0000-0000-0000-000000000001'
    ),
    'replaced',
    'old route status is replaced after replace call'
  );

-- New route enters 'proposed' and links back to the old route
select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes tr
      where
        tr.replacement_for_trade_route_id = 'dd700000-0000-0000-0000-000000000001'
        and tr.status = 'proposed'
    ),
    1,
    'new route is proposed and linked to the old route'
  );

-- Origin manager receives trade_proposal_received for the new route
select
  is (
    (
      select
        exists (
          select
            1
          from
            public.notifications n
            join public.trade_routes tr on tr.id = n.trade_route_id
          where
            n.recipient_user_id = 'dd100000-0000-0000-0000-000000000002'
            and n.notification_type = 'trade_proposal_received'
            and tr.replacement_for_trade_route_id = 'dd700000-0000-0000-0000-000000000001'
        )
    ),
    true,
    'origin manager receives trade_proposal_received notification for new route'
  );

-- Destination manager receives trade_proposal_received for the new route
select
  is (
    (
      select
        exists (
          select
            1
          from
            public.notifications n
            join public.trade_routes tr on tr.id = n.trade_route_id
          where
            n.recipient_user_id = 'dd100000-0000-0000-0000-000000000003'
            and n.notification_type = 'trade_proposal_received'
            and tr.replacement_for_trade_route_id = 'dd700000-0000-0000-0000-000000000001'
        )
    ),
    true,
    'destination manager receives trade_proposal_received notification for new route'
  );

-- ===========================================================================
-- DESTINATION MANAGER SUCCESS
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dd100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.replace_trade_route(
      'dd700000-0000-0000-0000-000000000002',
      '{"origin_settlement_id":"dd400000-0000-0000-0000-000000000001","destination_settlement_id":"dd400000-0000-0000-0000-000000000002","legs":[{"direction":"send","resource_id":"dd500000-0000-0000-0000-000000000001","quantity":20}]}'::jsonb,
      'dd600000-0000-0000-0000-000000000002'
    )
    $test$,
    'destination manager can replace an active route'
  );

reset role;

-- ===========================================================================
-- ADMIN (world owner) SUCCESS
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dd100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.replace_trade_route(
      'dd700000-0000-0000-0000-000000000003',
      '{"origin_settlement_id":"dd400000-0000-0000-0000-000000000001","destination_settlement_id":"dd400000-0000-0000-0000-000000000002","legs":[{"direction":"send","resource_id":"dd500000-0000-0000-0000-000000000001","quantity":12}]}'::jsonb,
      'dd600000-0000-0000-0000-000000000001'
    )
    $test$,
    'world admin can replace a proposed route'
  );

reset role;

-- ===========================================================================
-- ALREADY-CANCELLED: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dd100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.replace_trade_route(
      'dd700000-0000-0000-0000-000000000004',
      '{"origin_settlement_id":"dd400000-0000-0000-0000-000000000001","destination_settlement_id":"dd400000-0000-0000-0000-000000000002","legs":[{"direction":"send","resource_id":"dd500000-0000-0000-0000-000000000001","quantity":5}]}'::jsonb,
      'dd600000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'replacing a cancelled route raises P0001'
  );

reset role;

-- ===========================================================================
-- ALREADY-REPLACED: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dd100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.replace_trade_route(
      'dd700000-0000-0000-0000-000000000005',
      '{"origin_settlement_id":"dd400000-0000-0000-0000-000000000001","destination_settlement_id":"dd400000-0000-0000-0000-000000000002","legs":[{"direction":"send","resource_id":"dd500000-0000-0000-0000-000000000001","quantity":5}]}'::jsonb,
      'dd600000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'replacing a replaced route raises P0001'
  );

reset role;

-- ===========================================================================
-- INVALID PAYLOAD — trashed resource rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dd100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.replace_trade_route(
      'dd700000-0000-0000-0000-000000000006',
      '{"origin_settlement_id":"dd400000-0000-0000-0000-000000000001","destination_settlement_id":"dd400000-0000-0000-0000-000000000002","legs":[{"direction":"send","resource_id":"dd500000-0000-0000-0000-000000000002","quantity":5}]}'::jsonb,
      'dd600000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'replacing with a trashed resource in the new payload raises P0001'
  );

reset role;

-- ===========================================================================
-- SECURITY DEFINER check
-- ===========================================================================
select
  is (
    (
      select
        prosecdef
      from
        pg_proc
      where
        proname = 'replace_trade_route'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'replace_trade_route is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
