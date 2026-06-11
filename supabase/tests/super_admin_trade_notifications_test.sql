-- pgTAP tests for issue #581: super admins receive trade-route notifications for every world.
-- Verifies that super admins without an explicit world_admins row receive
-- trade_proposal_received and trade_proposal_accepted notifications, and that
-- UNION deduplication prevents duplicate rows when a user is both super admin
-- and world admin.
-- Run with: npx supabase test db
--
-- UUID ranges (all fd-prefixed, unique to this file):
--   fd1xxxxx = users          fd2xxxxx = worlds
--   fd3xxxxx = nations        fd4xxxxx = settlements
--   fd5xxxxx = resources      fd6xxxxx = citizens
--   fd7xxxxx = trade_routes
begin;

select
  plan (8);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- Users:
--   fd1...001 = super admin, NOT in world_admins (key case for #581)
--   fd1...002 = super admin + explicit world admin (dedup test)
--   fd1...003 = origin nation manager (PC)
--   fd1...004 = destination nation manager (PC)
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
    'fd100000-0000-0000-0000-000000000001',
    'fd-superadmin-only@example.com',
    'x',
    now(),
    '{"username":"fd_superadmin_only"}'::jsonb,
    now(),
    now()
  ),
  (
    'fd100000-0000-0000-0000-000000000002',
    'fd-superadmin-and-wadmin@example.com',
    'x',
    now(),
    '{"username":"fd_superadmin_and_wadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'fd100000-0000-0000-0000-000000000003',
    'fd-origin-mgr@example.com',
    'x',
    now(),
    '{"username":"fd_origin_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'fd100000-0000-0000-0000-000000000004',
    'fd-dest-mgr@example.com',
    'x',
    now(),
    '{"username":"fd_dest_mgr"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'fd200000-0000-0000-0000-000000000001',
    'FD World',
    'private',
    'active'
  );

-- fd1...002 is world admin; fd1...001 is NOT (the critical distinction for #581)
insert into
  public.world_admins (world_id, user_id)
values
  (
    'fd200000-0000-0000-0000-000000000001',
    'fd100000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'fd300000-0000-0000-0000-000000000001',
    'fd200000-0000-0000-0000-000000000001',
    'FD Origin Nation'
  ),
  (
    'fd300000-0000-0000-0000-000000000002',
    'fd200000-0000-0000-0000-000000000001',
    'FD Destination Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'fd400000-0000-0000-0000-000000000001',
    'fd300000-0000-0000-0000-000000000001',
    'FD Origin Settlement'
  ),
  (
    'fd400000-0000-0000-0000-000000000002',
    'fd300000-0000-0000-0000-000000000002',
    'FD Destination Settlement'
  );

insert into
  public.resources (id, world_id, name, slug, is_trashed)
values
  (
    'fd500000-0000-0000-0000-000000000001',
    'fd200000-0000-0000-0000-000000000001',
    'FD Grain',
    'fd-grain',
    false
  );

-- Citizens:
--   fd6...001 = PC, origin nation manager, user fd1...003
--   fd6...002 = PC, destination nation manager, user fd1...004
--   fd6...003 = NPC in Origin Settlement (used as proposed_by)
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
    'fd600000-0000-0000-0000-000000000001',
    'fd200000-0000-0000-0000-000000000001',
    'player_character',
    'FD Origin Nation Mgr PC',
    'alive',
    'fd100000-0000-0000-0000-000000000003',
    'nation_manager',
    'fd300000-0000-0000-0000-000000000001',
    null,
    'fd400000-0000-0000-0000-000000000001'
  ),
  (
    'fd600000-0000-0000-0000-000000000002',
    'fd200000-0000-0000-0000-000000000001',
    'player_character',
    'FD Destination Nation Mgr PC',
    'alive',
    'fd100000-0000-0000-0000-000000000004',
    'nation_manager',
    'fd300000-0000-0000-0000-000000000002',
    null,
    'fd400000-0000-0000-0000-000000000002'
  ),
  (
    'fd600000-0000-0000-0000-000000000003',
    'fd200000-0000-0000-0000-000000000001',
    'npc',
    'FD NPC Origin',
    'alive',
    null,
    'none',
    null,
    null,
    'fd400000-0000-0000-0000-000000000001'
  );

-- Grant super-admin status to fd1...001 (pure super admin) and fd1...002 (super admin + world admin)
update public.users
set
  is_super_admin = true
where
  id in (
    'fd100000-0000-0000-0000-000000000001',
    'fd100000-0000-0000-0000-000000000002'
  );

-- Pre-insert a proposed route for the approve test (both sides pending)
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
    'fd700000-0000-0000-0000-000000000001',
    'fd400000-0000-0000-0000-000000000001',
    'fd400000-0000-0000-0000-000000000002',
    'proposed',
    'fd600000-0000-0000-0000-000000000003',
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
    'fd700000-0000-0000-0000-000000000001',
    'send',
    'fd500000-0000-0000-0000-000000000001',
    10
  );

-- ===========================================================================
-- PROPOSE: both sides have active managers → super admin receives notification
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fd100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.propose_trade_route(
      'fd400000-0000-0000-0000-000000000001',
      'fd400000-0000-0000-0000-000000000002',
      jsonb_build_array(jsonb_build_object(
        'direction', 'send',
        'resource_id', 'fd500000-0000-0000-0000-000000000001',
        'quantity', 5.0
      )),
      'fd600000-0000-0000-0000-000000000001'
    )
    $test$,
    'origin nation manager can propose a trade route'
  );

reset role;

-- Check as superuser (RLS: notifications are only visible to recipient_user_id = auth.uid()).
-- T1: pure super admin (fd1...001, not in world_admins) receives trade_proposal_received
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
            n.recipient_user_id = 'fd100000-0000-0000-0000-000000000001'
            and n.notification_type = 'trade_proposal_received'
            and n.world_id = 'fd200000-0000-0000-0000-000000000001'
        )
    ),
    true,
    'super admin without world_admins row receives trade_proposal_received (#581)'
  );

-- T2: super admin + world admin (fd1...002) receives exactly one notification (UNION dedup)
select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications n
      where
        n.recipient_user_id = 'fd100000-0000-0000-0000-000000000002'
        and n.notification_type = 'trade_proposal_received'
        and n.world_id = 'fd200000-0000-0000-0000-000000000001'
    ),
    1,
    'super admin who is also world admin receives exactly one trade_proposal_received (no dups)'
  );

-- T3: total count = 5 (origin mgr + dest mgr + 2 fixture super admins + seeded super admin)
select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications n
      where
        n.notification_type = 'trade_proposal_received'
        and n.world_id = 'fd200000-0000-0000-0000-000000000001'
    ),
    5,
    'five trade_proposal_received notifications (origin mgr, dest mgr, 2 fixture super admins, seeded super admin)'
  );

-- ===========================================================================
-- APPROVE: approve both sides → super admin receives trade_proposal_accepted
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fd100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.approve_trade_route_side(
      'fd700000-0000-0000-0000-000000000001',
      'origin',
      'fd600000-0000-0000-0000-000000000001'
    )
    $test$,
    'origin manager can approve origin side'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fd100000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.approve_trade_route_side(
      'fd700000-0000-0000-0000-000000000001',
      'destination',
      'fd600000-0000-0000-0000-000000000002'
    )
    $test$,
    'destination manager can approve destination side'
  );

reset role;

-- T6: pure super admin (fd1...001) receives trade_proposal_accepted
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
            n.recipient_user_id = 'fd100000-0000-0000-0000-000000000001'
            and n.notification_type = 'trade_proposal_accepted'
            and n.trade_route_id = 'fd700000-0000-0000-0000-000000000001'
        )
    ),
    true,
    'super admin without world_admins row receives trade_proposal_accepted (#581)'
  );

-- T7: super admin + world admin (fd1...002) receives exactly one trade_proposal_accepted
select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications n
      where
        n.recipient_user_id = 'fd100000-0000-0000-0000-000000000002'
        and n.notification_type = 'trade_proposal_accepted'
        and n.trade_route_id = 'fd700000-0000-0000-0000-000000000001'
    ),
    1,
    'super admin who is also world admin receives exactly one trade_proposal_accepted (no dups)'
  );

select
  finish ();

rollback;
