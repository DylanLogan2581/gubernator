-- pgTAP tests for public.reject_trade_route_side RPC.
-- Run with: npx supabase test db
begin;

select
  plan (10);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all b1-prefixed, unique to this file):
--   b11xxxxx = users          b12xxxxx = worlds
--   b13xxxxx = nations        b14xxxxx = settlements
--   b15xxxxx = resources      b16xxxxx = citizens
--   b17xxxxx = trade_routes
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
    'b1100000-0000-0000-0000-000000000001',
    'b1-owner@example.com',
    'x',
    now(),
    '{"username":"b1_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1100000-0000-0000-0000-000000000002',
    'b1-origin-mgr@example.com',
    'x',
    now(),
    '{"username":"b1_origin_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1100000-0000-0000-0000-000000000003',
    'b1-dest-mgr@example.com',
    'x',
    now(),
    '{"username":"b1_dest_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1100000-0000-0000-0000-000000000004',
    'b1-no-role@example.com',
    'x',
    now(),
    '{"username":"b1_no_role"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'b1200000-0000-0000-0000-000000000001',
    'B1 World',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'b1300000-0000-0000-0000-000000000001',
    'b1200000-0000-0000-0000-000000000001',
    'B1 Origin Nation'
  ),
  (
    'b1300000-0000-0000-0000-000000000002',
    'b1200000-0000-0000-0000-000000000001',
    'B1 Destination Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'b1400000-0000-0000-0000-000000000001',
    'b1300000-0000-0000-0000-000000000001',
    'B1 Origin Settlement'
  ),
  (
    'b1400000-0000-0000-0000-000000000002',
    'b1300000-0000-0000-0000-000000000002',
    'B1 Destination Settlement'
  );

insert into
  public.resources (id, world_id, name, slug, is_trashed)
values
  (
    'b1500000-0000-0000-0000-000000000001',
    'b1200000-0000-0000-0000-000000000001',
    'B1 Grain',
    'b1-grain',
    false
  );

-- Citizens:
--   b16...001 – Origin Nation manager PC (user b11...002)
--   b16...002 – Destination Nation manager PC (user b11...003)
--   b16...003 – NPC in Origin Settlement (valid rejector for origin side)
--   b16...004 – NPC in Destination Settlement (valid rejector for destination side)
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
    role_settlement_id,
    settlement_id
  )
values
  (
    'b1600000-0000-0000-0000-000000000001',
    'b1200000-0000-0000-0000-000000000001',
    'player_character',
    'B1 Origin Nation Mgr PC',
    'alive',
    'b1100000-0000-0000-0000-000000000002',
    'nation_manager',
    'b1300000-0000-0000-0000-000000000001',
    null,
    'b1400000-0000-0000-0000-000000000001'
  ),
  (
    'b1600000-0000-0000-0000-000000000002',
    'b1200000-0000-0000-0000-000000000001',
    'player_character',
    'B1 Destination Nation Mgr PC',
    'alive',
    'b1100000-0000-0000-0000-000000000003',
    'nation_manager',
    'b1300000-0000-0000-0000-000000000002',
    null,
    'b1400000-0000-0000-0000-000000000002'
  ),
  (
    'b1600000-0000-0000-0000-000000000003',
    'b1200000-0000-0000-0000-000000000001',
    'npc',
    'B1 NPC Origin',
    'alive',
    null,
    'none',
    null,
    null,
    'b1400000-0000-0000-0000-000000000001'
  ),
  (
    'b1600000-0000-0000-0000-000000000004',
    'b1200000-0000-0000-0000-000000000001',
    'npc',
    'B1 NPC Destination',
    'alive',
    null,
    'none',
    null,
    null,
    'b1400000-0000-0000-0000-000000000002'
  );

-- Main route used for rejection tests
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
    'b1700000-0000-0000-0000-000000000001',
    'b1400000-0000-0000-0000-000000000001',
    'b1400000-0000-0000-0000-000000000002',
    'proposed',
    'b1600000-0000-0000-0000-000000000003',
    'pending',
    'pending'
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
    'b1700000-0000-0000-0000-000000000001',
    'send',
    'b1500000-0000-0000-0000-000000000001',
    10
  );

-- Second route for invalid-status test (will be cancelled after first test)
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
    'b1700000-0000-0000-0000-000000000002',
    'b1400000-0000-0000-0000-000000000001',
    'b1400000-0000-0000-0000-000000000002',
    'cancelled',
    'b1600000-0000-0000-0000-000000000003',
    'pending',
    'pending'
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
    'b1700000-0000-0000-0000-000000000002',
    'send',
    'b1500000-0000-0000-0000-000000000001',
    5
  );

-- ===========================================================================
-- ANONYMOUS: rejected (42501) — grant is only to authenticated
-- ===========================================================================
set
  local role anon;

select
  throws_ok (
    $test$
    select public.reject_trade_route_side(
      'b1700000-0000-0000-0000-000000000001',
      'origin',
      'b1600000-0000-0000-0000-000000000003'
    )
    $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- WRONG-SIDE MANAGER: destination manager tries to reject origin side
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.reject_trade_route_side(
      'b1700000-0000-0000-0000-000000000001',
      'origin',
      'b1600000-0000-0000-0000-000000000004'
    )
    $test$,
    '42501',
    null,
    'destination manager cannot reject origin side'
  );

reset role;

-- ===========================================================================
-- INVALID STATUS: route already cancelled → P0001
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.reject_trade_route_side(
      'b1700000-0000-0000-0000-000000000002',
      'origin',
      'b1600000-0000-0000-0000-000000000003'
    )
    $test$,
    'P0001',
    null,
    'rejecting a cancelled route raises P0001'
  );

reset role;

-- ===========================================================================
-- REJECT ORIGIN SUCCESS
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.reject_trade_route_side(
      'b1700000-0000-0000-0000-000000000001',
      'origin',
      'b1600000-0000-0000-0000-000000000003'
    )
    $test$,
    'origin manager can reject origin side'
  );

reset role;

-- Route status must be cancelled after a single rejection
select
  is (
    (
      select
        tr.status
      from
        public.trade_routes tr
      where
        tr.id = 'b1700000-0000-0000-0000-000000000001'
    ),
    'cancelled',
    'route status is cancelled after rejection'
  );

-- Origin approval status must be set to rejected
select
  is (
    (
      select
        tr.origin_approval_status
      from
        public.trade_routes tr
      where
        tr.id = 'b1700000-0000-0000-0000-000000000001'
    ),
    'rejected',
    'origin_approval_status is rejected after rejection'
  );

-- ===========================================================================
-- NOTIFICATIONS: both sides receive trade_proposal_rejected
-- Check as superuser to bypass notification RLS.
-- ===========================================================================
reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications n
      where
        n.notification_type = 'trade_proposal_rejected'
        and n.trade_route_id = 'b1700000-0000-0000-0000-000000000001'
    ),
    3,
    'three trade_proposal_rejected notifications inserted (origin mgr, dest mgr, seeded super admin)'
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
            n.recipient_user_id = 'b1100000-0000-0000-0000-000000000002'
            and n.notification_type = 'trade_proposal_rejected'
            and n.trade_route_id = 'b1700000-0000-0000-0000-000000000001'
        )
    ),
    true,
    'origin manager receives trade_proposal_rejected notification'
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
            n.recipient_user_id = 'b1100000-0000-0000-0000-000000000003'
            and n.notification_type = 'trade_proposal_rejected'
            and n.trade_route_id = 'b1700000-0000-0000-0000-000000000001'
        )
    ),
    true,
    'destination manager receives trade_proposal_rejected notification'
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
        proname = 'reject_trade_route_side'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'reject_trade_route_side is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
