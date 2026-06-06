-- pgTAP tests for public.propose_trade_route RPC.
-- Run with: npx supabase test db
begin;

select
  plan (16);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all fc-prefixed, unique to this file):
--   fc1xxxxx = users          fc2xxxxx = worlds
--   fc3xxxxx = nations        fc4xxxxx = settlements
--   fc5xxxxx = resources      fc6xxxxx = citizens
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
    'fc100000-0000-0000-0000-000000000001',
    'ptr-owner@example.com',
    'x',
    now(),
    '{"username":"ptr_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'fc100000-0000-0000-0000-000000000002',
    'ptr-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"ptr_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'fc100000-0000-0000-0000-000000000003',
    'ptr-settlement-mgr@example.com',
    'x',
    now(),
    '{"username":"ptr_settlement_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'fc100000-0000-0000-0000-000000000004',
    'ptr-no-role@example.com',
    'x',
    now(),
    '{"username":"ptr_no_role"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'fc200000-0000-0000-0000-000000000001',
    'PTR World',
    'private',
    'active'
  ),
  (
    'fc200000-0000-0000-0000-000000000002',
    'PTR World 2',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'fc200000-0000-0000-0000-000000000001',
    'fc100000-0000-0000-0000-000000000001'
  ),
  (
    'fc200000-0000-0000-0000-000000000002',
    'fc100000-0000-0000-0000-000000000001'
  );

-- Nation A and Nation B in World 1; Nation B has no managers (fallback target)
insert into
  public.nations (id, world_id, name)
values
  (
    'fc300000-0000-0000-0000-000000000001',
    'fc200000-0000-0000-0000-000000000001',
    'PTR Nation A'
  ),
  (
    'fc300000-0000-0000-0000-000000000002',
    'fc200000-0000-0000-0000-000000000001',
    'PTR Nation B'
  ),
  (
    'fc300000-0000-0000-0000-000000000003',
    'fc200000-0000-0000-0000-000000000002',
    'PTR Nation C (World 2)'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'fc400000-0000-0000-0000-000000000001',
    'fc300000-0000-0000-0000-000000000001',
    'PTR Settlement A1'
  ),
  (
    'fc400000-0000-0000-0000-000000000002',
    'fc300000-0000-0000-0000-000000000002',
    'PTR Settlement B1'
  ),
  (
    'fc400000-0000-0000-0000-000000000003',
    'fc300000-0000-0000-0000-000000000003',
    'PTR Settlement C1 (World 2)'
  );

-- Resources: active in World 1, trashed in World 1, and in World 2
insert into
  public.resources (id, world_id, name, slug, is_trashed)
values
  (
    'fc500000-0000-0000-0000-000000000001',
    'fc200000-0000-0000-0000-000000000001',
    'PTR Wheat',
    'ptr-wheat',
    false
  ),
  (
    'fc500000-0000-0000-0000-000000000002',
    'fc200000-0000-0000-0000-000000000001',
    'PTR Iron (trashed)',
    'ptr-iron-trashed',
    true
  ),
  (
    'fc500000-0000-0000-0000-000000000003',
    'fc200000-0000-0000-0000-000000000002',
    'PTR Gold (World 2)',
    'ptr-gold-w2',
    false
  );

-- Citizens:
--   fc6...001 – Nation A manager PC (user = fc100...002)
--   fc6...002 – Settlement A1 manager PC (user = fc100...003)
--   fc6...003 – NPC in Settlement A1 (correct nation for non-admin propose)
--   fc6...004 – NPC in Settlement C1 World 2 (wrong nation for non-admin test)
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
    'fc600000-0000-0000-0000-000000000001',
    'fc200000-0000-0000-0000-000000000001',
    'player_character',
    'PTR Nation Mgr PC',
    'alive',
    'fc100000-0000-0000-0000-000000000002',
    'nation_manager',
    'fc300000-0000-0000-0000-000000000001',
    null,
    'fc400000-0000-0000-0000-000000000001'
  ),
  (
    'fc600000-0000-0000-0000-000000000002',
    'fc200000-0000-0000-0000-000000000001',
    'player_character',
    'PTR Settlement Mgr PC',
    'alive',
    'fc100000-0000-0000-0000-000000000003',
    'settlement_manager',
    null,
    'fc400000-0000-0000-0000-000000000001',
    'fc400000-0000-0000-0000-000000000001'
  ),
  (
    'fc600000-0000-0000-0000-000000000003',
    'fc200000-0000-0000-0000-000000000001',
    'npc',
    'PTR NPC in Nation A',
    'alive',
    null,
    'none',
    null,
    null,
    'fc400000-0000-0000-0000-000000000001'
  ),
  (
    'fc600000-0000-0000-0000-000000000004',
    'fc200000-0000-0000-0000-000000000002',
    'npc',
    'PTR NPC in World 2',
    'alive',
    null,
    'none',
    null,
    null,
    'fc400000-0000-0000-0000-000000000003'
  );

-- ===========================================================================
-- SELF-LOOP: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fc100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.propose_trade_route(
      'fc400000-0000-0000-0000-000000000001',
      'fc400000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'direction', 'send',
        'resource_id', 'fc500000-0000-0000-0000-000000000001',
        'quantity', 10
      )),
      'fc600000-0000-0000-0000-000000000003'
    )
    $test$,
    'P0001',
    null,
    'self-loop is rejected with P0001'
  );

-- ===========================================================================
-- QUANTITY = 0: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.propose_trade_route(
      'fc400000-0000-0000-0000-000000000001',
      'fc400000-0000-0000-0000-000000000002',
      jsonb_build_array(jsonb_build_object(
        'direction', 'send',
        'resource_id', 'fc500000-0000-0000-0000-000000000001',
        'quantity', 0
      )),
      'fc600000-0000-0000-0000-000000000003'
    )
    $test$,
    'P0001',
    null,
    'zero quantity is rejected with P0001'
  );

-- ===========================================================================
-- CROSS-WORLD RESOURCE: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.propose_trade_route(
      'fc400000-0000-0000-0000-000000000001',
      'fc400000-0000-0000-0000-000000000002',
      jsonb_build_array(jsonb_build_object(
        'direction', 'send',
        'resource_id', 'fc500000-0000-0000-0000-000000000003',
        'quantity', 10
      )),
      'fc600000-0000-0000-0000-000000000003'
    )
    $test$,
    'P0001',
    null,
    'cross-world resource is rejected with P0001'
  );

-- ===========================================================================
-- SOFT-DELETED RESOURCE: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.propose_trade_route(
      'fc400000-0000-0000-0000-000000000001',
      'fc400000-0000-0000-0000-000000000002',
      jsonb_build_array(jsonb_build_object(
        'direction', 'send',
        'resource_id', 'fc500000-0000-0000-0000-000000000002',
        'quantity', 10
      )),
      'fc600000-0000-0000-0000-000000000003'
    )
    $test$,
    'P0001',
    null,
    'trashed resource is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- CITIZEN FROM WRONG NATION (non-admin): rejected (P0001)
-- Nation A manager calls, but proposing citizen (fc6...004) is in World 2 Nation C.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fc100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.propose_trade_route(
      'fc400000-0000-0000-0000-000000000001',
      'fc400000-0000-0000-0000-000000000002',
      jsonb_build_array(jsonb_build_object(
        'direction', 'send',
        'resource_id', 'fc500000-0000-0000-0000-000000000001',
        'quantity', 10
      )),
      'fc600000-0000-0000-0000-000000000004'
    )
    $test$,
    'P0001',
    null,
    'proposing citizen from wrong nation is rejected with P0001 for non-admin'
  );

reset role;

-- ===========================================================================
-- NON-MANAGER: rejected (42501)
-- fc100...004 has no management role.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fc100000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.propose_trade_route(
      'fc400000-0000-0000-0000-000000000001',
      'fc400000-0000-0000-0000-000000000002',
      jsonb_build_array(jsonb_build_object(
        'direction', 'send',
        'resource_id', 'fc500000-0000-0000-0000-000000000001',
        'quantity', 10
      )),
      'fc600000-0000-0000-0000-000000000003'
    )
    $test$,
    '42501',
    null,
    'non-manager caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- PROPOSE BY MANAGER SUCCESS
-- Nation A manager (fc100...002) proposes A1 → B1. Citizen fc6...003 is in Nation A.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fc100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.propose_trade_route(
      'fc400000-0000-0000-0000-000000000001',
      'fc400000-0000-0000-0000-000000000002',
      jsonb_build_array(jsonb_build_object(
        'direction', 'send',
        'resource_id', 'fc500000-0000-0000-0000-000000000001',
        'quantity', 25.5
      )),
      'fc600000-0000-0000-0000-000000000003'
    )
    $test$,
    'nation manager can propose a trade route'
  );

reset role;

-- Verify trade route and notifications as superuser to bypass notification RLS
-- (notifications are only visible to recipient; superuser sees all rows).
-- The proposer (fc6...003) is in Nation A (origin), so origin is auto-approved.
select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes tr
      where
        tr.origin_settlement_id = 'fc400000-0000-0000-0000-000000000001'
        and tr.destination_settlement_id = 'fc400000-0000-0000-0000-000000000002'
        and tr.status = 'proposed'
        and tr.origin_approval_status = 'approved'
        and tr.destination_approval_status = 'pending'
    ),
    1,
    'trade route inserted with origin auto-approved (proposer side) and destination pending'
  );

select
  is (
    (
      select
        tr.origin_approved_by_citizen_id
      from
        public.trade_routes tr
      where
        tr.origin_settlement_id = 'fc400000-0000-0000-0000-000000000001'
        and tr.destination_settlement_id = 'fc400000-0000-0000-0000-000000000002'
        and tr.status = 'proposed'
        and tr.origin_approval_status = 'approved'
      limit
        1
    ),
    'fc600000-0000-0000-0000-000000000003'::uuid,
    'origin_approved_by_citizen_id is set to the proposing citizen'
  );

-- ---------------------------------------------------------------------------
-- Notifications: origin side → fc100...002 (nation mgr) + fc100...003 (settlement mgr)
--                destination side → fc100...001 (world owner fallback, Nation B has no managers)
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications n
      where
        n.notification_type = 'trade_proposal_received'
        and n.world_id = 'fc200000-0000-0000-0000-000000000001'
    ),
    4,
    'four notifications created (two origin managers + one world-admin fallback + seeded super admin)'
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
            n.recipient_user_id = 'fc100000-0000-0000-0000-000000000001'
            and n.notification_type = 'trade_proposal_received'
        )
    ),
    true,
    'world owner receives notification as fallback for Nation B side'
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
            n.recipient_user_id = 'fc100000-0000-0000-0000-000000000002'
            and n.notification_type = 'trade_proposal_received'
        )
    ),
    true,
    'nation A manager receives notification'
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
            n.recipient_user_id = 'fc100000-0000-0000-0000-000000000003'
            and n.notification_type = 'trade_proposal_received'
        )
    ),
    true,
    'settlement A1 manager receives notification'
  );

-- ===========================================================================
-- ADMIN OVERRIDE: world admin can propose with a citizen from a wrong nation;
-- both sides stay pending because the citizen belongs to neither endpoint nation.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fc100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.propose_trade_route(
      'fc400000-0000-0000-0000-000000000001',
      'fc400000-0000-0000-0000-000000000002',
      jsonb_build_array(jsonb_build_object(
        'direction', 'send',
        'resource_id', 'fc500000-0000-0000-0000-000000000001',
        'quantity', 5
      )),
      'fc600000-0000-0000-0000-000000000004'
    )
    $test$,
    'world admin can propose with citizen from wrong nation (admin override)'
  );

reset role;

-- Admin-proposed route uses a citizen outside either endpoint nation → both pending.
select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes tr
      where
        tr.origin_settlement_id = 'fc400000-0000-0000-0000-000000000001'
        and tr.destination_settlement_id = 'fc400000-0000-0000-0000-000000000002'
        and tr.status = 'proposed'
        and tr.origin_approval_status = 'pending'
        and tr.destination_approval_status = 'pending'
    ),
    1,
    'admin route with foreign citizen leaves both sides pending'
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
        proname = 'propose_trade_route'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'propose_trade_route is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
