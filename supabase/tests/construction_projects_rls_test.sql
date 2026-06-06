-- pgTAP tests for public.construction_projects RLS, partial-unique index,
-- tier-blueprint mismatch trigger, and max_instances_per_settlement trigger.
-- Run with: npx supabase test db
begin;

select
  plan (12);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all numeric, unique to this file):
--   11xxxxxx = users          12xxxxxx = worlds
--   13xxxxxx = nations        14xxxxxx = settlements
--   15xxxxxx = blueprints     16xxxxxx = tiers
--   17xxxxxx = projects       18xxxxxx = citizens
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
    '11000000-0000-0000-0000-000000000001',
    'cp-owner@example.com',
    'x',
    now(),
    '{"username":"cp_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    'cp-admin@example.com',
    'x',
    now(),
    '{"username":"cp_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '11000000-0000-0000-0000-000000000003',
    'cp-outsider@example.com',
    'x',
    now(),
    '{"username":"cp_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '11000000-0000-0000-0000-000000000004',
    'cp-super@example.com',
    'x',
    now(),
    '{"username":"cp_super"}'::jsonb,
    now(),
    now()
  ),
  (
    '11000000-0000-0000-0000-000000000005',
    'cp-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"cp_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    '11000000-0000-0000-0000-000000000006',
    'cp-settlement-mgr@example.com',
    'x',
    now(),
    '{"username":"cp_settlement_mgr"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = '11000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    '12000000-0000-0000-0000-000000000001',
    'CP Private World',
    'private',
    'active'
  ),
  (
    '12000000-0000-0000-0000-000000000002',
    'CP Outsider World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '12000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '13000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    'CP Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '14000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000001',
    'CP Settlement'
  );

-- Farmhouse: max_instances_per_settlement = 2 (used for cap tests).
-- Barracks:  uncapped (used for RLS write tests and collision test).
insert into
  public.building_blueprints (
    id,
    world_id,
    name,
    slug,
    max_instances_per_settlement
  )
values
  (
    '15000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    'Farmhouse',
    'farmhouse',
    2
  ),
  (
    '15000000-0000-0000-0000-000000000002',
    '12000000-0000-0000-0000-000000000001',
    'Barracks',
    'barracks',
    null
  );

insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    worker_turns_required
  )
values
  (
    '16000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    1,
    10
  ),
  (
    '16000000-0000-0000-0000-000000000002',
    '15000000-0000-0000-0000-000000000002',
    1,
    5
  );

-- Nation manager and settlement manager citizens.
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
    role_settlement_id
  )
values
  (
    '18000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    'player_character',
    'CP Nation Manager PC',
    'alive',
    '11000000-0000-0000-0000-000000000005',
    'nation_manager',
    '13000000-0000-0000-0000-000000000001',
    null
  ),
  (
    '18000000-0000-0000-0000-000000000002',
    '12000000-0000-0000-0000-000000000001',
    'player_character',
    'CP Settlement Manager PC',
    'alive',
    '11000000-0000-0000-0000-000000000006',
    'settlement_manager',
    null,
    '14000000-0000-0000-0000-000000000001'
  );

-- Seed one Barracks project as postgres so read tests have a visible row.
insert into
  public.construction_projects (
    id,
    settlement_id,
    building_blueprint_id,
    target_tier_id,
    status,
    queue_position
  )
values
  (
    '17000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000002',
    '16000000-0000-0000-0000-000000000002',
    'queued',
    1
  );

-- ===========================================================================
-- ANONYMOUS: cannot read construction_projects
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
        public.construction_projects
    ),
    0,
    'anon cannot read construction_projects'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: cannot read private-world projects
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"11000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.construction_projects cp
        join public.settlements s on s.id = cp.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = '12000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read construction_projects in an inaccessible private world'
  );

reset role;

-- ===========================================================================
-- WORLD OWNER: can read projects in their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.construction_projects
      where
        id = '17000000-0000-0000-0000-000000000001'
    ),
    'world owner can read construction_projects in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: can insert, update, and delete
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.construction_projects (id, settlement_id, building_blueprint_id, target_tier_id, status, queue_position)
    values (
      '17000000-0000-0000-0000-000000000010',
      '14000000-0000-0000-0000-000000000001',
      '15000000-0000-0000-0000-000000000002',
      '16000000-0000-0000-0000-000000000002',
      'in_progress',
      2
    )
  $test$,
    'world admin can insert a construction project'
  );

select
  lives_ok (
    $test$
    update public.construction_projects
    set status = 'paused'
    where id = '17000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can update a construction project'
  );

select
  lives_ok (
    $test$
    delete from public.construction_projects
    where id = '17000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can delete a construction project'
  );

reset role;

-- ===========================================================================
-- NATION MANAGER: can insert via current_user_manages_settlement
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"11000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.construction_projects (id, settlement_id, building_blueprint_id, target_tier_id, status, queue_position)
    values (
      '17000000-0000-0000-0000-000000000011',
      '14000000-0000-0000-0000-000000000001',
      '15000000-0000-0000-0000-000000000002',
      '16000000-0000-0000-0000-000000000002',
      'queued',
      2
    )
  $test$,
    'nation manager can insert a construction project'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: can insert via current_user_manages_settlement
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"11000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.construction_projects (id, settlement_id, building_blueprint_id, target_tier_id, status, queue_position)
    values (
      '17000000-0000-0000-0000-000000000012',
      '14000000-0000-0000-0000-000000000001',
      '15000000-0000-0000-0000-000000000002',
      '16000000-0000-0000-0000-000000000002',
      'queued',
      3
    )
  $test$,
    'settlement manager can insert a construction project'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can insert projects in any world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"11000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.construction_projects (id, settlement_id, building_blueprint_id, target_tier_id, status, queue_position)
    values (
      '17000000-0000-0000-0000-000000000013',
      '14000000-0000-0000-0000-000000000001',
      '15000000-0000-0000-0000-000000000002',
      '16000000-0000-0000-0000-000000000002',
      'queued',
      4
    )
  $test$,
    'super admin can insert a construction project'
  );

reset role;

-- ===========================================================================
-- Constraint tests run as postgres (no role) to bypass RLS so only the
-- structural constraints are exercised.
-- ===========================================================================
-- ===========================================================================
-- PARTIAL UNIQUE INDEX: reorder collision rejected.
-- 17...01 already occupies (14...01, queue_position=1, status='queued').
-- Inserting a second row with the same (settlement_id, queue_position) while
-- both have a non-terminal status must be rejected with a unique_violation.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.construction_projects (settlement_id, building_blueprint_id, target_tier_id, status, queue_position)
    values (
      '14000000-0000-0000-0000-000000000001',
      '15000000-0000-0000-0000-000000000002',
      '16000000-0000-0000-0000-000000000002',
      'queued',
      1
    )
  $test$,
    '23505',
    null,
    'duplicate (settlement_id, queue_position) for non-terminal status is rejected by the partial unique index'
  );

-- ===========================================================================
-- TIER-BLUEPRINT MISMATCH: target_tier_id must belong to building_blueprint_id.
-- Barracks blueprint (15...02) has no instance cap so check_max_instances
-- returns early, ensuring check_tier_match fires and surfaces the error.
-- Tier 16...01 belongs to Farmhouse (15...01), not Barracks.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.construction_projects (settlement_id, building_blueprint_id, target_tier_id, status, queue_position)
    values (
      '14000000-0000-0000-0000-000000000001',
      '15000000-0000-0000-0000-000000000002',
      '16000000-0000-0000-0000-000000000001',
      'queued',
      5
    )
  $test$,
    '23514',
    null,
    'tier belonging to a different blueprint is rejected by the tier_match trigger'
  );

-- ===========================================================================
-- MAX INSTANCES: inserting a third Farmhouse project is rejected when the cap
-- is 2. Seed two Farmhouse rows first, then attempt a third.
-- ===========================================================================
insert into
  public.construction_projects (
    id,
    settlement_id,
    building_blueprint_id,
    target_tier_id,
    status,
    queue_position
  )
values
  (
    '17000000-0000-0000-0000-000000000020',
    '14000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    'queued',
    10
  ),
  (
    '17000000-0000-0000-0000-000000000021',
    '14000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    'queued',
    20
  );

select
  throws_ok (
    $test$
    insert into public.construction_projects (settlement_id, building_blueprint_id, target_tier_id, status, queue_position)
    values (
      '14000000-0000-0000-0000-000000000001',
      '15000000-0000-0000-0000-000000000001',
      '16000000-0000-0000-0000-000000000001',
      'queued',
      30
    )
  $test$,
    '23514',
    null,
    'inserting a third Farmhouse project exceeds max_instances_per_settlement=2 and is rejected'
  );

select
  *
from
  finish ();

rollback;
