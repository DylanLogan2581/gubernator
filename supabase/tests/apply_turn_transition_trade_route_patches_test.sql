-- pgTAP tests for §C31: apply_turn_transition trade route outcome patches.
-- Run with: npx supabase test db
--
-- UUID prefix map (all a8-prefixed ranges, unique to this file):
--   a8100000 = users            a8200000 = worlds
--   a8300000 = nations          a8400000 = settlements
--   a8500000 = resources        a8600000 = citizens
--   a8700000 = trade_routes
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
    'a8100000-0000-0000-0000-000000000001',
    'atttr-superadmin@example.com',
    'x',
    now(),
    '{"username":"atttr_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'a8100000-0000-0000-0000-000000000001';

-- Three worlds — one per scenario, all at turn 5:
--   World 1: active route pauses on shortfall
--   World 2: paused route resumes
--   World 3: route unchanged (not included in tradeRouteOutcomes)
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'a8200000-0000-0000-0000-000000000001',
    'ATTTR Shortfall World',
    5,
    'private',
    'active'
  ),
  (
    'a8200000-0000-0000-0000-000000000002',
    'ATTTR Resume World',
    5,
    'private',
    'active'
  ),
  (
    'a8200000-0000-0000-0000-000000000003',
    'ATTTR Noop World',
    5,
    'private',
    'active'
  );

-- One nation per world
insert into
  public.nations (id, world_id, name)
values
  (
    'a8300000-0000-0000-0000-000000000001',
    'a8200000-0000-0000-0000-000000000001',
    'ATTTR Nation 1'
  ),
  (
    'a8300000-0000-0000-0000-000000000002',
    'a8200000-0000-0000-0000-000000000002',
    'ATTTR Nation 2'
  ),
  (
    'a8300000-0000-0000-0000-000000000003',
    'a8200000-0000-0000-0000-000000000003',
    'ATTTR Nation 3'
  );

-- Two settlements per world (trade routes require distinct origin/destination)
insert into
  public.settlements (id, nation_id, name)
values
  (
    'a8400000-0000-0000-0000-000000000001',
    'a8300000-0000-0000-0000-000000000001',
    'ATTTR Settlement 1A'
  ),
  (
    'a8400000-0000-0000-0000-000000000002',
    'a8300000-0000-0000-0000-000000000001',
    'ATTTR Settlement 1B'
  ),
  (
    'a8400000-0000-0000-0000-000000000003',
    'a8300000-0000-0000-0000-000000000002',
    'ATTTR Settlement 2A'
  ),
  (
    'a8400000-0000-0000-0000-000000000004',
    'a8300000-0000-0000-0000-000000000002',
    'ATTTR Settlement 2B'
  ),
  (
    'a8400000-0000-0000-0000-000000000005',
    'a8300000-0000-0000-0000-000000000003',
    'ATTTR Settlement 3A'
  ),
  (
    'a8400000-0000-0000-0000-000000000006',
    'a8300000-0000-0000-0000-000000000003',
    'ATTTR Settlement 3B'
  );

-- One resource per world
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'a8500000-0000-0000-0000-000000000001',
    'a8200000-0000-0000-0000-000000000001',
    'ATTTR Grain 1',
    'atttr-grain-1'
  ),
  (
    'a8500000-0000-0000-0000-000000000002',
    'a8200000-0000-0000-0000-000000000002',
    'ATTTR Grain 2',
    'atttr-grain-2'
  ),
  (
    'a8500000-0000-0000-0000-000000000003',
    'a8200000-0000-0000-0000-000000000003',
    'ATTTR Grain 3',
    'atttr-grain-3'
  );

-- One citizen per world (required as proposed_by_citizen_id)
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status
  )
values
  (
    'a8600000-0000-0000-0000-000000000001',
    'a8200000-0000-0000-0000-000000000001',
    'a8400000-0000-0000-0000-000000000001',
    'npc',
    'ATTTR Trader 1',
    'alive'
  ),
  (
    'a8600000-0000-0000-0000-000000000002',
    'a8200000-0000-0000-0000-000000000002',
    'a8400000-0000-0000-0000-000000000003',
    'npc',
    'ATTTR Trader 2',
    'alive'
  ),
  (
    'a8600000-0000-0000-0000-000000000003',
    'a8200000-0000-0000-0000-000000000003',
    'a8400000-0000-0000-0000-000000000005',
    'npc',
    'ATTTR Trader 3',
    'alive'
  );

-- Trade routes:
--   Route 1 (World 1): status='active', no pause reason — will be paused on shortfall
--   Route 2 (World 2): status='paused', pause_reason='prior shortfall' — will resume
--   Route 3 (World 3): status='active', no pause reason — will be unchanged (no-op)
insert into
  public.trade_routes (
    id,
    origin_settlement_id,
    destination_settlement_id,
    status,
    proposed_by_citizen_id,
    origin_approval_status,
    destination_approval_status,
    pause_reason_last_transition
  )
values
  (
    'a8700000-0000-0000-0000-000000000001',
    'a8400000-0000-0000-0000-000000000001',
    'a8400000-0000-0000-0000-000000000002',
    'active',
    'a8600000-0000-0000-0000-000000000001',
    'approved',
    'approved',
    null
  ),
  (
    'a8700000-0000-0000-0000-000000000002',
    'a8400000-0000-0000-0000-000000000003',
    'a8400000-0000-0000-0000-000000000004',
    'paused',
    'a8600000-0000-0000-0000-000000000002',
    'approved',
    'approved',
    'prior shortfall'
  ),
  (
    'a8700000-0000-0000-0000-000000000003',
    'a8400000-0000-0000-0000-000000000005',
    'a8400000-0000-0000-0000-000000000006',
    'active',
    'a8600000-0000-0000-0000-000000000003',
    'approved',
    'approved',
    null
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
    'a8700000-0000-0000-0000-000000000001',
    'send',
    'a8500000-0000-0000-0000-000000000001',
    10
  ),
  (
    'a8700000-0000-0000-0000-000000000002',
    'send',
    'a8500000-0000-0000-0000-000000000002',
    10
  ),
  (
    'a8700000-0000-0000-0000-000000000003',
    'send',
    'a8500000-0000-0000-0000-000000000003',
    10
  );

insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status
  )
values
  (
    'a8300000-0000-0000-0000-000000000001',
    'a8200000-0000-0000-0000-000000000001',
    5,
    6,
    'a8100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'a8300000-0000-0000-0000-000000000002',
    'a8200000-0000-0000-0000-000000000002',
    5,
    6,
    'a8100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'a8300000-0000-0000-0000-000000000003',
    'a8200000-0000-0000-0000-000000000003',
    5,
    6,
    'a8100000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- All tests run as super admin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a8100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- TEST SCENARIO 1: route pauses on shortfall
-- Route starts as 'active' with no pause reason.
-- Apply tradeRouteOutcomes with toStatus='paused', pauseReason='shortfall'.
-- Expect: status = 'paused', pause_reason_last_transition = 'shortfall'.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a8200000-0000-0000-0000-000000000001',
    5,
    jsonb_build_object(
      'tradeRouteOutcomes',
      jsonb_build_array(
        jsonb_build_object(
          'tradeRouteId',
          'a8700000-0000-0000-0000-000000000001',
          'toStatus',
          'paused',
          'pauseReason',
          'shortfall'
        )
      )
    ),
    'a8300000-0000-0000-0000-000000000001'::uuid
  );

select
  is (
    (
      select
        tr.status
      from
        public.trade_routes tr
      where
        tr.id = 'a8700000-0000-0000-0000-000000000001'
    ),
    'paused',
    'shortfall: trade route status updated to paused'
  );

select
  is (
    (
      select
        tr.pause_reason_last_transition
      from
        public.trade_routes tr
      where
        tr.id = 'a8700000-0000-0000-0000-000000000001'
    ),
    'shortfall',
    'shortfall: pause_reason_last_transition set to shortfall'
  );

-- ===========================================================================
-- TEST SCENARIO 2: route resumes from paused
-- Route starts as 'paused' with pause_reason='prior shortfall'.
-- Apply tradeRouteOutcomes with toStatus='active', pauseReason=null.
-- Expect: status = 'active', pause_reason_last_transition = null.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a8200000-0000-0000-0000-000000000002',
    5,
    jsonb_build_object(
      'tradeRouteOutcomes',
      jsonb_build_array(
        jsonb_build_object(
          'tradeRouteId',
          'a8700000-0000-0000-0000-000000000002',
          'toStatus',
          'active',
          'pauseReason',
          null
        )
      )
    ),
    'a8300000-0000-0000-0000-000000000002'::uuid
  );

select
  is (
    (
      select
        tr.status
      from
        public.trade_routes tr
      where
        tr.id = 'a8700000-0000-0000-0000-000000000002'
    ),
    'active',
    'resume: trade route status updated to active'
  );

select
  is (
    (
      select
        tr.pause_reason_last_transition
      from
        public.trade_routes tr
      where
        tr.id = 'a8700000-0000-0000-0000-000000000002'
    ),
    null,
    'resume: pause_reason_last_transition cleared on resume'
  );

-- ===========================================================================
-- TEST SCENARIO 3: no-op on unchanged route
-- Route in World 3 is 'active' and is not included in tradeRouteOutcomes.
-- Apply with an empty tradeRouteOutcomes array.
-- Expect: status and pause_reason_last_transition remain unchanged.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a8200000-0000-0000-0000-000000000003',
    5,
    jsonb_build_object('tradeRouteOutcomes', '[]'::jsonb),
    'a8300000-0000-0000-0000-000000000003'::uuid
  );

select
  is (
    (
      select
        tr.status
      from
        public.trade_routes tr
      where
        tr.id = 'a8700000-0000-0000-0000-000000000003'
    ),
    'active',
    'no-op: route not in outcomes remains active'
  );

select
  is (
    (
      select
        tr.pause_reason_last_transition
      from
        public.trade_routes tr
      where
        tr.id = 'a8700000-0000-0000-0000-000000000003'
    ),
    null,
    'no-op: pause_reason_last_transition remains null when route not in outcomes'
  );

reset role;

rollback;
