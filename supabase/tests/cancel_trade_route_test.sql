-- pgTAP tests for public.cancel_trade_route RPC.
-- Run with: npx supabase test db
begin;

select
  plan (12);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all cc-prefixed, unique to this file):
--   cc1xxxxx = users          cc2xxxxx = worlds
--   cc3xxxxx = nations        cc4xxxxx = settlements
--   cc5xxxxx = resources      cc6xxxxx = citizens
--   cc7xxxxx = trade_routes
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
    'cc100000-0000-0000-0000-000000000001',
    'cc-owner@example.com',
    'x',
    now(),
    '{"username":"cc_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'cc100000-0000-0000-0000-000000000002',
    'cc-origin-mgr@example.com',
    'x',
    now(),
    '{"username":"cc_origin_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'cc100000-0000-0000-0000-000000000003',
    'cc-dest-mgr@example.com',
    'x',
    now(),
    '{"username":"cc_dest_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'cc100000-0000-0000-0000-000000000004',
    'cc-no-role@example.com',
    'x',
    now(),
    '{"username":"cc_no_role"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'cc200000-0000-0000-0000-000000000001',
    'CC World',
    'cc100000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'cc300000-0000-0000-0000-000000000001',
    'cc200000-0000-0000-0000-000000000001',
    'CC Origin Nation'
  ),
  (
    'cc300000-0000-0000-0000-000000000002',
    'cc200000-0000-0000-0000-000000000001',
    'CC Destination Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'cc400000-0000-0000-0000-000000000001',
    'cc300000-0000-0000-0000-000000000001',
    'CC Origin Settlement'
  ),
  (
    'cc400000-0000-0000-0000-000000000002',
    'cc300000-0000-0000-0000-000000000002',
    'CC Destination Settlement'
  );

insert into
  public.resources (id, world_id, name, slug, is_trashed)
values
  (
    'cc500000-0000-0000-0000-000000000001',
    'cc200000-0000-0000-0000-000000000001',
    'CC Grain',
    'cc-grain',
    false
  );

-- Citizens:
--   cc6...001 – Origin Nation manager PC (user cc1...002)
--   cc6...002 – Destination Nation manager PC (user cc1...003)
--   cc6...003 – NPC in Origin Settlement (assigned to route cc7...001 for cascade test)
--   cc6...004 – NPC in Destination Settlement (assigned to route cc7...001 for cascade test)
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
    'cc600000-0000-0000-0000-000000000001',
    'cc200000-0000-0000-0000-000000000001',
    'player_character',
    'CC Origin Nation Mgr PC',
    'alive',
    'cc100000-0000-0000-0000-000000000002',
    'nation_manager',
    'cc300000-0000-0000-0000-000000000001',
    null,
    'cc400000-0000-0000-0000-000000000001'
  ),
  (
    'cc600000-0000-0000-0000-000000000002',
    'cc200000-0000-0000-0000-000000000001',
    'player_character',
    'CC Destination Nation Mgr PC',
    'alive',
    'cc100000-0000-0000-0000-000000000003',
    'nation_manager',
    'cc300000-0000-0000-0000-000000000002',
    null,
    'cc400000-0000-0000-0000-000000000002'
  ),
  (
    'cc600000-0000-0000-0000-000000000003',
    'cc200000-0000-0000-0000-000000000001',
    'npc',
    'CC NPC Origin',
    'alive',
    null,
    'none',
    null,
    null,
    'cc400000-0000-0000-0000-000000000001'
  ),
  (
    'cc600000-0000-0000-0000-000000000004',
    'cc200000-0000-0000-0000-000000000001',
    'npc',
    'CC NPC Destination',
    'alive',
    null,
    'none',
    null,
    null,
    'cc400000-0000-0000-0000-000000000002'
  );

-- Trade routes:
--   cc7...001 – active, used for origin-manager cancel + cascade + notification tests
--   cc7...002 – active, used for destination-manager cancel test
--   cc7...003 – proposed, used for admin cancel test
--   cc7...004 – cancelled, used for already-cancelled rejection test
--   cc7...005 – replaced, used for already-replaced rejection test
insert into
  public.trade_routes (
    id,
    origin_settlement_id,
    destination_settlement_id,
    resource_id,
    quantity_per_transition,
    status,
    proposed_by_citizen_id,
    origin_approval_status,
    destination_approval_status
  )
values
  (
    'cc700000-0000-0000-0000-000000000001',
    'cc400000-0000-0000-0000-000000000001',
    'cc400000-0000-0000-0000-000000000002',
    'cc500000-0000-0000-0000-000000000001',
    10,
    'active',
    'cc600000-0000-0000-0000-000000000003',
    'approved',
    'approved'
  ),
  (
    'cc700000-0000-0000-0000-000000000002',
    'cc400000-0000-0000-0000-000000000001',
    'cc400000-0000-0000-0000-000000000002',
    'cc500000-0000-0000-0000-000000000001',
    5,
    'active',
    'cc600000-0000-0000-0000-000000000003',
    'approved',
    'approved'
  ),
  (
    'cc700000-0000-0000-0000-000000000003',
    'cc400000-0000-0000-0000-000000000001',
    'cc400000-0000-0000-0000-000000000002',
    'cc500000-0000-0000-0000-000000000001',
    8,
    'proposed',
    'cc600000-0000-0000-0000-000000000003',
    'pending',
    'pending'
  ),
  (
    'cc700000-0000-0000-0000-000000000004',
    'cc400000-0000-0000-0000-000000000001',
    'cc400000-0000-0000-0000-000000000002',
    'cc500000-0000-0000-0000-000000000001',
    3,
    'cancelled',
    'cc600000-0000-0000-0000-000000000003',
    'pending',
    'pending'
  ),
  (
    'cc700000-0000-0000-0000-000000000005',
    'cc400000-0000-0000-0000-000000000001',
    'cc400000-0000-0000-0000-000000000002',
    'cc500000-0000-0000-0000-000000000001',
    7,
    'replaced',
    'cc600000-0000-0000-0000-000000000003',
    'approved',
    'approved'
  );

-- Citizen assignments for route cc7...001 (cascade-unassignment test)
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    trade_route_id,
    trade_route_end,
    assigned_on_turn_number
  )
values
  (
    'cc600000-0000-0000-0000-000000000003',
    'trade_route',
    'cc700000-0000-0000-0000-000000000001',
    'origin',
    1
  ),
  (
    'cc600000-0000-0000-0000-000000000004',
    'trade_route',
    'cc700000-0000-0000-0000-000000000001',
    'destination',
    1
  );

-- ===========================================================================
-- ANONYMOUS: rejected (42501) — grant is only to authenticated
-- ===========================================================================
set
  local role anon;

select
  throws_ok (
    $test$
    select public.cancel_trade_route('cc700000-0000-0000-0000-000000000001')
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
  local "request.jwt.claims" = '{"sub":"cc100000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.cancel_trade_route('cc700000-0000-0000-0000-000000000001')
    $test$,
    '42501',
    null,
    'authenticated user with no nation role is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- ORIGIN MANAGER SUCCESS — also exercises cascade-unassign and notifications
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.cancel_trade_route('cc700000-0000-0000-0000-000000000001')
    $test$,
    'origin manager can cancel an active route'
  );

reset role;

-- Verify status = 'cancelled'
select
  is (
    (
      select
        tr.status
      from
        public.trade_routes tr
      where
        tr.id = 'cc700000-0000-0000-0000-000000000001'
    ),
    'cancelled',
    'route status is cancelled after origin manager cancels'
  );

-- Verify cascade-unassignment: no citizen_assignments remain for the route
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.trade_route_id = 'cc700000-0000-0000-0000-000000000001'
    ),
    0,
    'citizen_assignments for cancelled route are deleted'
  );

-- Check notifications (as superuser to bypass RLS)
select
  is (
    (
      select
        exists (
          select
            1
          from
            public.notifications n
          where
            n.recipient_user_id = 'cc100000-0000-0000-0000-000000000002'
            and n.notification_type = 'trade_route_cancelled'
            and n.trade_route_id = 'cc700000-0000-0000-0000-000000000001'
        )
    ),
    true,
    'origin manager receives trade_route_cancelled notification'
  );

select
  is (
    (
      select
        exists (
          select
            1
          from
            public.notifications n
          where
            n.recipient_user_id = 'cc100000-0000-0000-0000-000000000003'
            and n.notification_type = 'trade_route_cancelled'
            and n.trade_route_id = 'cc700000-0000-0000-0000-000000000001'
        )
    ),
    true,
    'destination manager receives trade_route_cancelled notification'
  );

-- ===========================================================================
-- DESTINATION MANAGER SUCCESS
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.cancel_trade_route('cc700000-0000-0000-0000-000000000002')
    $test$,
    'destination manager can cancel an active route'
  );

reset role;

-- ===========================================================================
-- ADMIN (world owner) SUCCESS
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.cancel_trade_route('cc700000-0000-0000-0000-000000000003')
    $test$,
    'world admin can cancel a proposed route'
  );

reset role;

-- ===========================================================================
-- ALREADY-CANCELLED: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.cancel_trade_route('cc700000-0000-0000-0000-000000000004')
    $test$,
    'P0001',
    null,
    'cancelling an already-cancelled route raises P0001'
  );

reset role;

-- ===========================================================================
-- ALREADY-REPLACED: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.cancel_trade_route('cc700000-0000-0000-0000-000000000005')
    $test$,
    'P0001',
    null,
    'cancelling a replaced route raises P0001'
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
        proname = 'cancel_trade_route'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'cancel_trade_route is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
