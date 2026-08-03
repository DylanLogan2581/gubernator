-- pgTAP tests for public.army_turn_snapshots RLS and constraints.
-- Run with: npx supabase test db
--
-- RLS matrix:
--   SELECT  — world-access reads succeed (owner, world admin)
--   INSERT  — blocked for all authenticated callers (no grant; RPC is sole write path)
--   cross-world reads denied for outsiders
--
-- UUID ranges (all numeric/hex, unique to this file):
--   e1xxxxxx = users       e2xxxxxx = worlds
--   e3xxxxxx = nations     e4xxxxxx = settlements
--   e5xxxxxx = armies      e6xxxxxx = army_turn_snapshots
begin;

select
  plan (7);

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
    'e1000000-0000-0000-0000-000000000001',
    'ats-owner@example.com',
    'x',
    now(),
    '{"username":"ats_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'ats-admin@example.com',
    'x',
    now(),
    '{"username":"ats_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'ats-outsider@example.com',
    'x',
    now(),
    '{"username":"ats_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'ATS Private World',
    'active'
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'ATS Outsider World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001'
  ),
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'ATS Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'ATS Settlement'
  );

insert into
  public.armies (
    id,
    world_id,
    nation_id,
    name,
    funding_source,
    stationed_settlement_id,
    created_turn_number
  )
values
  (
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'ATS Guard',
    'nation',
    'e4000000-0000-0000-0000-000000000001',
    1
  );

-- postgres role bypasses RLS/grants -- simulates what apply_turn_transition's
-- internal_apply_turn_transition_military_upkeep helper does.
insert into
  public.army_turn_snapshots (
    id,
    world_id,
    army_id,
    turn_number,
    soldier_count_total,
    soldiers_by_unit_type_json,
    upkeep_paid
  )
values
  (
    'e6000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    2,
    5,
    '{}'::jsonb,
    true
  );

-- ===========================================================================
-- ANONYMOUS: no read access
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
        public.army_turn_snapshots
    ),
    0,
    'anon cannot read army_turn_snapshots'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: cannot read snapshots in an inaccessible world; cannot insert
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.army_turn_snapshots
      where
        id = 'e6000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read snapshots in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.army_turn_snapshots (
      world_id, army_id, turn_number, soldier_count_total, soldiers_by_unit_type_json, upkeep_paid
    ) values (
      'e2000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      3, 4, '{}'::jsonb, false
    )
    $test$,
    '42501',
    null,
    'outsider cannot insert an army turn snapshot (no INSERT grant)'
  );

reset role;

-- ===========================================================================
-- OWNER: world owner can read snapshots in their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.army_turn_snapshots
      where
        id = 'e6000000-0000-0000-0000-000000000001'
    ),
    'owner can read snapshots in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: can read; direct INSERT is denied (no grant; RPC-only writes)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.army_turn_snapshots
      where
        id = 'e6000000-0000-0000-0000-000000000001'
    ),
    'world admin can read snapshots in administered world'
  );

select
  throws_ok (
    $test$
    insert into public.army_turn_snapshots (
      world_id, army_id, turn_number, soldier_count_total, soldiers_by_unit_type_json, upkeep_paid
    ) values (
      'e2000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      3, 4, '{}'::jsonb, false
    )
    $test$,
    '42501',
    null,
    'world admin cannot directly insert a snapshot row (no INSERT grant; use RPC)'
  );

reset role;

-- ===========================================================================
-- CONSTRAINT: unique (army_id, turn_number) rejects a duplicate snapshot
-- (postgres role bypasses RLS and column grants)
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.army_turn_snapshots (
      world_id, army_id, turn_number, soldier_count_total, soldiers_by_unit_type_json, upkeep_paid
    ) values (
      'e2000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      2, 3, '{}'::jsonb, false
    )
    $test$,
    '23505',
    null,
    'unique (army_id, turn_number) rejects a duplicate snapshot'
  );

rollback;
