-- pgTAP tests for public.trade_routes same-world guard (issue #675).
-- Validates that trade routes cannot be created with origin and destination
-- settlements in different worlds, both via direct INSERT (trigger) and via
-- propose_trade_route RPC (which includes the same check).
--
-- Run with: npx supabase test db
--
-- UUID ranges (all numeric/hex, unique to this file):
--   c1xxxxxx = users          c2xxxxxx = worlds
--   c3xxxxxx = nations        c4xxxxxx = settlements
--   c5xxxxxx = resources      c6xxxxxx = citizens
--   c7xxxxxx = trade_routes
begin;

-- If the migration didn't create the trigger, create it here for testing.
-- This helps isolate whether the issue is with the migration or the trigger code itself.
drop trigger if exists trade_routes_same_world on public.trade_routes;

create or replace function public.check_trade_routes_same_world () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_origin_world_id      uuid;
  v_destination_world_id uuid;
begin
  select n.world_id into v_origin_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = new.origin_settlement_id;

  select n.world_id into v_destination_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = new.destination_settlement_id;

  if v_origin_world_id is distinct from v_destination_world_id then
    raise exception
      'origin settlement % and destination settlement % must belong to the same world',
      new.origin_settlement_id, new.destination_settlement_id
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

create trigger trade_routes_same_world before insert
or
update on public.trade_routes for each row
execute function public.check_trade_routes_same_world ();

select
  plan (5);

-- ---------------------------------------------------------------------------
-- Fixtures: two worlds, each with nations and settlements
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
    'c1aaaa00-0000-0000-0000-000000000001',
    'world-a-admin@example.com',
    'x',
    now(),
    '{"username":"world_a_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1aaaa00-0000-0000-0000-000000000002',
    'world-b-admin@example.com',
    'x',
    now(),
    '{"username":"world_b_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1aaaa00-0000-0000-0000-000000000003',
    'both-nations-mgr@example.com',
    'x',
    now(),
    '{"username":"both_nations_mgr"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'c2aaaa00-0000-0000-0000-000000000001',
    'World A',
    'private',
    'active'
  ),
  (
    'c2aaaa00-0000-0000-0000-000000000002',
    'World B',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c2aaaa00-0000-0000-0000-000000000001',
    'c1aaaa00-0000-0000-0000-000000000001'
  ),
  (
    'c2aaaa00-0000-0000-0000-000000000002',
    'c1aaaa00-0000-0000-0000-000000000002'
  );

-- World A: two nations with settlements
insert into
  public.nations (id, world_id, name, is_hidden)
values
  (
    'c3aaaa00-0000-0000-0000-000000000001',
    'c2aaaa00-0000-0000-0000-000000000001',
    'World A Nation 1',
    false
  ),
  (
    'c3aaaa00-0000-0000-0000-000000000002',
    'c2aaaa00-0000-0000-0000-000000000001',
    'World A Nation 2',
    false
  ),
  (
    'c3aaaa00-0000-0000-0000-000000000003',
    'c2aaaa00-0000-0000-0000-000000000002',
    'World B Nation 1',
    false
  );

-- Settlements: 2 in World A, 1 in World B
insert into
  public.settlements (id, nation_id, name)
values
  (
    'c4aaaa00-0000-0000-0000-000000000001',
    'c3aaaa00-0000-0000-0000-000000000001',
    'World A Settle 1'
  ),
  (
    'c4aaaa00-0000-0000-0000-000000000002',
    'c3aaaa00-0000-0000-0000-000000000002',
    'World A Settle 2'
  ),
  (
    'c4aaaa00-0000-0000-0000-000000000003',
    'c3aaaa00-0000-0000-0000-000000000003',
    'World B Settle 1'
  );

-- Resource in World A
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'c5aaaa00-0000-0000-0000-000000000001',
    'c2aaaa00-0000-0000-0000-000000000001',
    'Grain',
    'grain-a'
  );

-- Citizens: nation managers for World A (both nations)
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_nation_id
  )
values
  (
    'c6aaaa00-0000-0000-0000-000000000001',
    'c2aaaa00-0000-0000-0000-000000000001',
    'c4aaaa00-0000-0000-0000-000000000001',
    'player_character',
    'Nation A Manager',
    'alive',
    'c1aaaa00-0000-0000-0000-000000000003',
    'nation_manager',
    'c3aaaa00-0000-0000-0000-000000000001'
  ),
  (
    'c6aaaa00-0000-0000-0000-000000000002',
    'c2aaaa00-0000-0000-0000-000000000001',
    'c4aaaa00-0000-0000-0000-000000000002',
    'player_character',
    'Nation B Manager',
    'alive',
    'c1aaaa00-0000-0000-0000-000000000003',
    'nation_manager',
    'c3aaaa00-0000-0000-0000-000000000002'
  );

-- ---------------------------------------------------------------------------
-- Test 1: Same-world route via RPC succeeds (propose_trade_route)
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1aaaa00-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $$select public.propose_trade_route(
    'c4aaaa00-0000-0000-0000-000000000001',
    'c4aaaa00-0000-0000-0000-000000000002',
    jsonb_build_array(jsonb_build_object(
      'direction', 'send',
      'resource_id', 'c5aaaa00-0000-0000-0000-000000000001',
      'quantity', 10
    )),
    'c6aaaa00-0000-0000-0000-000000000001'
  )$$,
    'same-world route via propose_trade_route succeeds'
  );

reset role;

-- Verify route was created
select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes
      where
        origin_settlement_id = 'c4aaaa00-0000-0000-0000-000000000001'
    ),
    1,
    'same-world route was inserted successfully'
  );

-- ---------------------------------------------------------------------------
-- Test 2: Cross-world route via RPC fails with P0002 (not found)
-- The RPC checks that destination is in the same world as origin (line 90-96
-- of 20260604000012_propose_trade_route_multi_leg.sql). Destination must match
-- origin's world_id when joined through settlements → nations.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1aaaa00-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $$select public.propose_trade_route(
    'c4aaaa00-0000-0000-0000-000000000001',
    'c4aaaa00-0000-0000-0000-000000000003',
    jsonb_build_array(jsonb_build_object(
      'direction', 'send',
      'resource_id', 'c5aaaa00-0000-0000-0000-000000000001',
      'quantity', 10
    )),
    'c6aaaa00-0000-0000-0000-000000000001'
  )$$,
    'P0002',
    null,
    'cross-world route via propose_trade_route fails (RPC destination-world check)'
  );

reset role;

-- Note: Trigger should be created by migration (20260618000001). If this test
-- is creating it again, check that the migration actually ran and created it.
-- ---------------------------------------------------------------------------
-- Test 3: Direct INSERT with cross-world endpoints fails (trigger)
-- This tests that the new trigger blocks cross-world routes at the table level,
-- preventing the RLS policy loophole (issue #675).
-- ---------------------------------------------------------------------------
-- First, insert a same-world route as postgres (bypasses RLS)
insert into
  public.trade_routes (
    origin_settlement_id,
    destination_settlement_id,
    proposed_by_citizen_id,
    status,
    origin_approval_status,
    destination_approval_status
  )
values
  (
    'c4aaaa00-0000-0000-0000-000000000001',
    'c4aaaa00-0000-0000-0000-000000000002',
    'c6aaaa00-0000-0000-0000-000000000001',
    'proposed',
    'pending',
    'pending'
  );

-- The cross-world INSERT should be rejected by the trigger.
-- The trigger raises exception with errcode 'foreign_key_violation'.
select
  throws_like (
    $$insert into public.trade_routes (
    origin_settlement_id,
    destination_settlement_id,
    proposed_by_citizen_id,
    status,
    origin_approval_status,
    destination_approval_status
  ) values (
    'c4aaaa00-0000-0000-0000-000000000001',
    'c4aaaa00-0000-0000-0000-000000000003',
    'c6aaaa00-0000-0000-0000-000000000001',
    'proposed',
    'pending',
    'pending'
  )$$,
    '%must belong to the same world',
    'direct cross-world INSERT rejected by same-world trigger'
  );

-- Verify that NO cross-world route was created (should have 1 same-world route only)
select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes
      where
        destination_settlement_id = 'c4aaaa00-0000-0000-0000-000000000003'
    ),
    0,
    'no cross-world route was created'
  );

select
  *
from
  finish ();

rollback;
