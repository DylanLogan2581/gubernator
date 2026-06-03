-- pgTAP tests for public.approve_trade_route_side RPC.
-- Run with: npx supabase test db
begin;

select
  plan (16);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all af-prefixed, unique to this file):
--   af1xxxxx = users          af2xxxxx = worlds
--   af3xxxxx = nations        af4xxxxx = settlements
--   af5xxxxx = resources      af6xxxxx = citizens
--   af7xxxxx = trade_routes
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
    'af100000-0000-0000-0000-000000000001',
    'af-owner@example.com',
    'x',
    now(),
    '{"username":"af_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'af100000-0000-0000-0000-000000000002',
    'af-origin-mgr@example.com',
    'x',
    now(),
    '{"username":"af_origin_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'af100000-0000-0000-0000-000000000003',
    'af-dest-mgr@example.com',
    'x',
    now(),
    '{"username":"af_dest_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'af100000-0000-0000-0000-000000000004',
    'af-no-role@example.com',
    'x',
    now(),
    '{"username":"af_no_role"}'::jsonb,
    now(),
    now()
  ),
  (
    'af100000-0000-0000-0000-000000000005',
    'af-dual-mgr@example.com',
    'x',
    now(),
    '{"username":"af_dual_mgr"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'af200000-0000-0000-0000-000000000001',
    'AF World',
    'af100000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'af300000-0000-0000-0000-000000000001',
    'af200000-0000-0000-0000-000000000001',
    'AF Origin Nation'
  ),
  (
    'af300000-0000-0000-0000-000000000002',
    'af200000-0000-0000-0000-000000000001',
    'AF Destination Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'af400000-0000-0000-0000-000000000001',
    'af300000-0000-0000-0000-000000000001',
    'AF Origin Settlement'
  ),
  (
    'af400000-0000-0000-0000-000000000002',
    'af300000-0000-0000-0000-000000000002',
    'AF Destination Settlement'
  );

insert into
  public.resources (id, world_id, name, slug, is_trashed)
values
  (
    'af500000-0000-0000-0000-000000000001',
    'af200000-0000-0000-0000-000000000001',
    'AF Grain',
    'af-grain',
    false
  );

-- Citizens:
--   af6...001 – Origin Nation manager PC (user af1...002)
--   af6...002 – Destination Nation manager PC (user af1...003)
--   af6...003 – NPC in Origin Settlement (valid approver for origin side)
--   af6...004 – NPC in Destination Settlement (valid approver for destination side)
--   af6...005 – Dual manager PC for Origin Nation (user af1...005)
--   af6...006 – Dual manager PC for Destination Nation (user af1...005)
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
    'af600000-0000-0000-0000-000000000001',
    'af200000-0000-0000-0000-000000000001',
    'player_character',
    'AF Origin Nation Mgr PC',
    'alive',
    'af100000-0000-0000-0000-000000000002',
    'nation_manager',
    'af300000-0000-0000-0000-000000000001',
    null,
    'af400000-0000-0000-0000-000000000001'
  ),
  (
    'af600000-0000-0000-0000-000000000002',
    'af200000-0000-0000-0000-000000000001',
    'player_character',
    'AF Destination Nation Mgr PC',
    'alive',
    'af100000-0000-0000-0000-000000000003',
    'nation_manager',
    'af300000-0000-0000-0000-000000000002',
    null,
    'af400000-0000-0000-0000-000000000002'
  ),
  (
    'af600000-0000-0000-0000-000000000003',
    'af200000-0000-0000-0000-000000000001',
    'npc',
    'AF NPC Origin',
    'alive',
    null,
    'none',
    null,
    null,
    'af400000-0000-0000-0000-000000000001'
  ),
  (
    'af600000-0000-0000-0000-000000000004',
    'af200000-0000-0000-0000-000000000001',
    'npc',
    'AF NPC Destination',
    'alive',
    null,
    'none',
    null,
    null,
    'af400000-0000-0000-0000-000000000002'
  ),
  (
    'af600000-0000-0000-0000-000000000005',
    'af200000-0000-0000-0000-000000000001',
    'player_character',
    'AF Dual Mgr Origin PC',
    'alive',
    'af100000-0000-0000-0000-000000000005',
    'nation_manager',
    'af300000-0000-0000-0000-000000000001',
    null,
    'af400000-0000-0000-0000-000000000001'
  ),
  (
    'af600000-0000-0000-0000-000000000006',
    'af200000-0000-0000-0000-000000000001',
    'player_character',
    'AF Dual Mgr Dest PC',
    'alive',
    'af100000-0000-0000-0000-000000000005',
    'nation_manager',
    'af300000-0000-0000-0000-000000000002',
    null,
    'af400000-0000-0000-0000-000000000002'
  );

-- Main trade route used for sequential approval tests (origin → both approved)
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
    'af700000-0000-0000-0000-000000000001',
    'af400000-0000-0000-0000-000000000001',
    'af400000-0000-0000-0000-000000000002',
    'af500000-0000-0000-0000-000000000001',
    10,
    'proposed',
    'af600000-0000-0000-0000-000000000003',
    'pending',
    'pending'
  );

-- Separate route for the dual-manager test
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
    'af700000-0000-0000-0000-000000000002',
    'af400000-0000-0000-0000-000000000001',
    'af400000-0000-0000-0000-000000000002',
    'af500000-0000-0000-0000-000000000001',
    5,
    'proposed',
    'af600000-0000-0000-0000-000000000003',
    'pending',
    'pending'
  );

-- ===========================================================================
-- ANONYMOUS: rejected (42501) — grant is only to authenticated
-- ===========================================================================
set
  local role anon;

select
  throws_ok (
    $test$
    select public.approve_trade_route_side(
      'af700000-0000-0000-0000-000000000001',
      'origin',
      'af600000-0000-0000-0000-000000000003'
    )
    $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- WRONG-SIDE MANAGER: destination manager tries to approve origin side
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"af100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.approve_trade_route_side(
      'af700000-0000-0000-0000-000000000001',
      'origin',
      'af600000-0000-0000-0000-000000000004'
    )
    $test$,
    '42501',
    null,
    'destination manager cannot approve origin side'
  );

reset role;

-- ===========================================================================
-- APPROVER CITIZEN FROM WRONG NATION: origin manager uses destination citizen
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"af100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.approve_trade_route_side(
      'af700000-0000-0000-0000-000000000001',
      'origin',
      'af600000-0000-0000-0000-000000000004'
    )
    $test$,
    'P0001',
    null,
    'approver citizen from wrong nation is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- APPROVE ORIGIN SUCCESS
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"af100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.approve_trade_route_side(
      'af700000-0000-0000-0000-000000000001',
      'origin',
      'af600000-0000-0000-0000-000000000003'
    )
    $test$,
    'origin manager can approve origin side'
  );

reset role;

-- Route should remain proposed after one side approval
select
  is (
    (
      select
        tr.status
      from
        public.trade_routes tr
      where
        tr.id = 'af700000-0000-0000-0000-000000000001'
    ),
    'proposed',
    'route status remains proposed after only origin approved'
  );

-- ===========================================================================
-- DOUBLE-APPROVAL SAME SIDE: origin is already approved
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"af100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.approve_trade_route_side(
      'af700000-0000-0000-0000-000000000001',
      'origin',
      'af600000-0000-0000-0000-000000000003'
    )
    $test$,
    'P0001',
    null,
    'double-approval of same side is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- APPROVE DESTINATION → BOTH SIDES APPROVED → ACTIVE + NOTIFICATIONS
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"af100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.approve_trade_route_side(
      'af700000-0000-0000-0000-000000000001',
      'destination',
      'af600000-0000-0000-0000-000000000004'
    )
    $test$,
    'destination manager can approve destination side'
  );

reset role;

-- Verify status = active as superuser
select
  is (
    (
      select
        tr.status
      from
        public.trade_routes tr
      where
        tr.id = 'af700000-0000-0000-0000-000000000001'
    ),
    'active',
    'route status is active after both sides approved'
  );

-- Notifications: af1...002 (origin mgr), af1...003 (dest mgr), af1...005 (dual mgr
-- on both sides, deduplicated by union to one row).
-- Check as superuser to bypass notification RLS.
select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications n
      where
        n.notification_type = 'trade_proposal_accepted'
        and n.trade_route_id = 'af700000-0000-0000-0000-000000000001'
    ),
    3,
    'three trade_proposal_accepted notifications inserted (origin mgr, dest mgr, dual mgr)'
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
            n.recipient_user_id = 'af100000-0000-0000-0000-000000000002'
            and n.notification_type = 'trade_proposal_accepted'
            and n.trade_route_id = 'af700000-0000-0000-0000-000000000001'
        )
    ),
    true,
    'origin manager receives trade_proposal_accepted notification'
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
            n.recipient_user_id = 'af100000-0000-0000-0000-000000000003'
            and n.notification_type = 'trade_proposal_accepted'
            and n.trade_route_id = 'af700000-0000-0000-0000-000000000001'
        )
    ),
    true,
    'destination manager receives trade_proposal_accepted notification'
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
            n.recipient_user_id = 'af100000-0000-0000-0000-000000000005'
            and n.notification_type = 'trade_proposal_accepted'
            and n.trade_route_id = 'af700000-0000-0000-0000-000000000001'
        )
    ),
    true,
    'dual-side manager receives trade_proposal_accepted notification'
  );

-- ===========================================================================
-- SINGLE NATION MANAGER CONTROLLING BOTH SIDES: can approve both
-- (af1...005 has PCs managing both origin and destination nations)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"af100000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.approve_trade_route_side(
      'af700000-0000-0000-0000-000000000002',
      'origin',
      'af600000-0000-0000-0000-000000000003'
    )
    $test$,
    'dual-side manager can approve origin side'
  );

select
  lives_ok (
    $test$
    select public.approve_trade_route_side(
      'af700000-0000-0000-0000-000000000002',
      'destination',
      'af600000-0000-0000-0000-000000000004'
    )
    $test$,
    'dual-side manager can approve destination side'
  );

reset role;

select
  is (
    (
      select
        tr.status
      from
        public.trade_routes tr
      where
        tr.id = 'af700000-0000-0000-0000-000000000002'
    ),
    'active',
    'route is active after dual-side manager approves both sides'
  );

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
        proname = 'approve_trade_route_side'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'approve_trade_route_side is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
