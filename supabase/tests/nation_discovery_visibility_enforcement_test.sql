-- pgTAP tests for issue #1086: nation_discoveries as the sole visibility gate
-- between nations, replacing nations.is_hidden, and blocking relationship /
-- trade-route interaction between nations that have not met.
-- Run with: npx supabase test db
--
-- Covers the three visibility roles called out in the issue:
--   • unmet member cannot SELECT the other nation, its relationships, or its
--     trade routes.
--   • met member (nations_have_met via the caller's active player_character)
--     can SELECT all of the above.
--   • admin (world admin / super admin) sees everything regardless of met
--     status.
-- Plus interaction blocking at the RPC/trigger level:
--   • a fresh bilateral relationship propose between unmet nations is
--     rejected (P0001, "Nations have not met.").
--   • respond_to_bilateral against an unmet pair returns an empty set.
--   • propose_trade_route between unmet nations is rejected (P0001).
-- Plus the v1 product decision that a spectator with world access but no
-- player_character sees no nations at all (no more is_hidden fallback).
--
-- UUID ranges (all numeric/hex, unique to this file):
--   d1xxxxxx = users        d2xxxxxx = worlds
--   d3xxxxxx = nations      d4xxxxxx = settlements
--   d5xxxxxx = citizens     d6xxxxxx = trade_routes / legs
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
    'd1000000-0000-0000-0000-000000000001',
    'discover-world-admin@example.com',
    'x',
    now(),
    '{"username":"discover_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'discover-met-member@example.com',
    'x',
    now(),
    '{"username":"discover_met_member"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'discover-unmet-member@example.com',
    'x',
    now(),
    '{"username":"discover_unmet_member"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000004',
    'discover-spectator@example.com',
    'x',
    now(),
    '{"username":"discover_spectator"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'Discovery Enforcement World',
    'public',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001'
  );

-- Nation A (home of the met/unmet members), Nation B (has met A), Nation C
-- (has not met A).
insert into
  public.nations (id, world_id, name)
values
  (
    'd3000000-0000-0000-0000-00000000000a',
    'd2000000-0000-0000-0000-000000000001',
    'Nation A'
  ),
  (
    'd3000000-0000-0000-0000-00000000000b',
    'd2000000-0000-0000-0000-000000000001',
    'Nation B (met A)'
  ),
  (
    'd3000000-0000-0000-0000-00000000000c',
    'd2000000-0000-0000-0000-000000000001',
    'Nation C (unmet by A)'
  );

insert into
  public.nation_discoveries (
    world_id,
    nation_a_id,
    nation_b_id,
    met_at_turn_number
  )
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-00000000000a',
    'd3000000-0000-0000-0000-00000000000b',
    1
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd4000000-0000-0000-0000-0000000000a1',
    'd3000000-0000-0000-0000-00000000000a',
    'Settlement A1'
  ),
  (
    'd4000000-0000-0000-0000-0000000000b1',
    'd3000000-0000-0000-0000-00000000000b',
    'Settlement B1'
  ),
  (
    'd4000000-0000-0000-0000-0000000000c1',
    'd3000000-0000-0000-0000-00000000000c',
    'Settlement C1'
  );

-- Met member: PC in Nation A, active selection set (nation_visible_to_current_user's
-- have-met arm resolves the caller's own nation via the ACTIVE player_character).
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
    'd5000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-0000000000a1',
    'player_character',
    'Met Member PC',
    'alive',
    'd1000000-0000-0000-0000-000000000002'
  );

insert into
  public.user_active_player_characters (user_id, world_id, citizen_id)
values
  (
    'd1000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000001'
  );

-- Unmet member: same setup, but no discovery row exists between Nation A and
-- Nation C, so this user's home nation (A) has not met Nation C.
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
    'd5000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-0000000000a1',
    'player_character',
    'Unmet Member PC',
    'alive',
    'd1000000-0000-0000-0000-000000000003'
  );

insert into
  public.user_active_player_characters (user_id, world_id, citizen_id)
values
  (
    'd1000000-0000-0000-0000-000000000003',
    'd2000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000002'
  );

-- A relationship and a trade route between Nation A and Nation C (the unmet
-- pair) so the "cannot SELECT" assertions have rows to target.
insert into
  public.nation_relationships (id, from_nation_id, to_nation_id, current_stance)
values
  (
    'd3100000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-00000000000a',
    'd3000000-0000-0000-0000-00000000000c',
    'neutral'
  );

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
    'd6000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-0000000000a1',
    'd4000000-0000-0000-0000-0000000000c1',
    'd5000000-0000-0000-0000-000000000001',
    'proposed',
    'pending',
    'pending'
  );

-- ===========================================================================
-- UNMET MEMBER: cannot see Nation C, the A<->C relationship, or the A<->C
-- trade route. Nation A (their own nation) and Nation B (A has met B) remain
-- visible.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.nations
      where
        id = 'd3000000-0000-0000-0000-00000000000c'
    ),
    'unmet member cannot SELECT a nation their home nation has not met'
  );

select
  ok (
    exists (
      select
        1
      from
        public.nations
      where
        id = 'd3000000-0000-0000-0000-00000000000a'
    ),
    'unmet member can SELECT their own nation'
  );

select
  ok (
    exists (
      select
        1
      from
        public.nations
      where
        id = 'd3000000-0000-0000-0000-00000000000b'
    ),
    'unmet member can SELECT a nation their home nation has met'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.nation_relationships
      where
        id = 'd3100000-0000-0000-0000-000000000001'
    ),
    'unmet member cannot SELECT a relationship with an unmet participant'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.trade_routes
      where
        id = 'd6000000-0000-0000-0000-000000000001'
    ),
    'unmet member cannot SELECT a trade route with an unmet endpoint'
  );

reset role;

-- ===========================================================================
-- MET MEMBER: same fixtures, but this user's own nation (A) has met Nation B.
-- Re-target the relationship/route rows at the met pair (A, B) to prove the
-- positive case.
-- ===========================================================================
update public.nation_relationships
set
  to_nation_id = 'd3000000-0000-0000-0000-00000000000b'
where
  id = 'd3100000-0000-0000-0000-000000000001';

update public.trade_routes
set
  destination_settlement_id = 'd4000000-0000-0000-0000-0000000000b1'
where
  id = 'd6000000-0000-0000-0000-000000000001';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.nations
      where
        id = 'd3000000-0000-0000-0000-00000000000b'
    ),
    'met member can SELECT a nation their home nation has met'
  );

select
  ok (
    exists (
      select
        1
      from
        public.nation_relationships
      where
        id = 'd3100000-0000-0000-0000-000000000001'
    ),
    'met member can SELECT a relationship between two nations they can see'
  );

select
  ok (
    exists (
      select
        1
      from
        public.trade_routes
      where
        id = 'd6000000-0000-0000-0000-000000000001'
    ),
    'met member can SELECT a trade route between two nations they can see'
  );

reset role;

-- ===========================================================================
-- ADMIN: world admin sees every nation, relationship, and trade route
-- regardless of met status.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nations
      where
        id in (
          'd3000000-0000-0000-0000-00000000000a',
          'd3000000-0000-0000-0000-00000000000b',
          'd3000000-0000-0000-0000-00000000000c'
        )
    ),
    3,
    'world admin sees every nation regardless of met status'
  );

select
  ok (
    exists (
      select
        1
      from
        public.nation_relationships
      where
        id = 'd3100000-0000-0000-0000-000000000001'
    ),
    'world admin sees the relationship regardless of met status'
  );

select
  ok (
    exists (
      select
        1
      from
        public.trade_routes
      where
        id = 'd6000000-0000-0000-0000-000000000001'
    ),
    'world admin sees the trade route regardless of met status'
  );

reset role;

-- ===========================================================================
-- SPECTATOR: world access (public world) but no player_character and no
-- admin role sees NO nations at all (v1 decision, #1086 notes -- there is no
-- more is_hidden fallback for general world access).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nations
      where
        id in (
          'd3000000-0000-0000-0000-00000000000a',
          'd3000000-0000-0000-0000-00000000000b',
          'd3000000-0000-0000-0000-00000000000c'
        )
    ),
    0,
    'spectator with world access but no player_character sees no nations'
  );

reset role;

-- ===========================================================================
-- INTERACTION BLOCKING: propose/respond and trade-route proposals between
-- unmet nations are rejected at the RPC / trigger level.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.nation_relationships (
      from_nation_id, to_nation_id, pending_stance, pending_status
    ) values (
      'd3000000-0000-0000-0000-00000000000a',
      'd3000000-0000-0000-0000-00000000000c',
      'allied',
      'proposed'
    )
    on conflict (from_nation_id, to_nation_id) do update
    set pending_stance = excluded.pending_stance,
        pending_status = excluded.pending_status
    $test$,
    'P0001',
    'Nations have not met.',
    'proposing a bilateral relationship between unmet nations is rejected'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.respond_to_bilateral (
          'd3000000-0000-0000-0000-00000000000a',
          'd3000000-0000-0000-0000-00000000000c',
          'accepted'
        )
    ),
    0,
    'respond_to_bilateral against an unmet pair returns an empty set'
  );

select
  throws_ok (
    $test$
    select public.propose_trade_route(
      'd4000000-0000-0000-0000-0000000000a1',
      'd4000000-0000-0000-0000-0000000000c1',
      jsonb_build_array(jsonb_build_object(
        'direction', 'send',
        'resource_id', gen_random_uuid(),
        'quantity', 5
      )),
      'd5000000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    'Nations have not met.',
    'propose_trade_route between unmet nations is rejected'
  );

select
  *
from
  finish ();

rollback;
