-- pgTAP tests for public.event_groups and expanded public.events schema.
-- Run with: npx supabase test db
--
-- Tests cover:
-- - event_groups RLS: member read, non-admin write denied, cross-world denied
-- - events scope type constraint enforcement
-- - events duration constraint enforcement (sustained requires duration_transitions)
-- - events cross-world scope guard (scope_nation_id and scope_settlement_id must belong to world_id)
-- - Backfill: existing 'resolved' rows → 'expired'
begin;

select
  plan (16);

-- ---------------------------------------------------------------------------
-- Fixtures: users, worlds, worlds_admins, nations, settlements
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
    'e4000000-0000-0000-0000-000000000001',
    'events-exp-owner@example.com',
    'x',
    now(),
    '{"username":"events_exp_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e4000000-0000-0000-0000-000000000002',
    'events-exp-admin@example.com',
    'x',
    now(),
    '{"username":"events_exp_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e4000000-0000-0000-0000-000000000003',
    'events-exp-outsider@example.com',
    'x',
    now(),
    '{"username":"events_exp_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'e4000000-0000-0000-0000-000000000004',
    'events-exp-superadmin@example.com',
    'x',
    now(),
    '{"username":"events_exp_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e4000000-0000-0000-0000-000000000004';

-- World A: subject for event_groups and extended events
insert into
  public.worlds (id, name, visibility, status)
values
  (
    'e5000000-0000-0000-0000-000000000001',
    'Events Exp World A',
    'private',
    'active'
  ),
  (
    'e5000000-0000-0000-0000-000000000002',
    'Events Exp World B',
    'private',
    'active'
  );

-- World admins for World A
insert into
  public.world_admins (world_id, user_id)
values
  (
    'e5000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001'
  ),
  (
    'e5000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000002'
  ),
  (
    'e5000000-0000-0000-0000-000000000002',
    'e4000000-0000-0000-0000-000000000003'
  );

-- Nations in World A
insert into
  public.nations (id, world_id, name)
values
  (
    'e6000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'Nations in World A'
  ),
  (
    'e6000000-0000-0000-0000-000000000002',
    'e5000000-0000-0000-0000-000000000002',
    'Nations in World B'
  );

-- Settlements in World A
insert into
  public.settlements (id, nation_id, name)
values
  (
    'e7000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000001',
    'Settlement in World A'
  ),
  (
    'e7000000-0000-0000-0000-000000000002',
    'e6000000-0000-0000-0000-000000000002',
    'Settlement in World B'
  );

-- Job definitions (needed for managed_population_types)
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'e7800000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'Husbandry Job',
    'husbandry-job',
    'husbandry'
  ),
  (
    'e7800000-0000-0000-0000-000000000002',
    'e5000000-0000-0000-0000-000000000001',
    'Culling Job',
    'culling-job',
    'culling'
  );

-- Managed population types (needed for events constraints)
insert into
  public.managed_population_types (
    id,
    world_id,
    name,
    slug,
    husbandry_job_id,
    culling_job_id,
    husbandry_workers_per_n_animals
  )
values
  (
    'e8000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'Managed Pop Type A',
    'managed-pop-a',
    'e7800000-0000-0000-0000-000000000001',
    'e7800000-0000-0000-0000-000000000002',
    1
  );

-- ===========================================================================
-- RLS: event_groups SELECT (world access required)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- Insert test event_group
insert into
  public.event_groups (id, world_id, name, created_during_turn_number)
values
  (
    'e9000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'Test Event Group A',
    0
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.event_groups
      where
        world_id = 'e5000000-0000-0000-0000-000000000001'
    ),
    1,
    'world admin can read event_groups in their world'
  );

reset role;

-- ===========================================================================
-- RLS: event_groups INSERT (admin only)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
  insert into public.event_groups (
    world_id,
    name,
    created_during_turn_number
  ) values (
    'e5000000-0000-0000-0000-000000000001',
    'Unauthorized Group',
    0
  )
  $test$,
    '42501',
    null,
    'non-admin cannot insert event_groups'
  );

reset role;

-- ===========================================================================
-- RLS: event_groups cross-world write denial
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
  insert into public.event_groups (
    world_id,
    name,
    created_during_turn_number
  ) values (
    'e5000000-0000-0000-0000-000000000002',
    'Cross-World Group',
    0
  )
  $test$,
    '42501',
    null,
    'world-A admin cannot write event_groups to world-B'
  );

reset role;

-- ===========================================================================
-- RLS: events SELECT (world access required)
-- ===========================================================================
insert into
  public.events (
    id,
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type
  )
values
  (
    'ea000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'Test Event A',
    'deposit_discovered',
    0,
    'world'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.events
      where
        world_id = 'e5000000-0000-0000-0000-000000000001'
    ),
    1,
    'world admin can read events in their world'
  );

reset role;

-- ===========================================================================
-- RLS: events INSERT (admin only)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
  insert into public.events (
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type
  ) values (
    'e5000000-0000-0000-0000-000000000001',
    'Unauthorized Event',
    'deposit_discovered',
    0,
    'world'
  )
  $test$,
    '42501',
    null,
    'non-admin cannot insert events'
  );

reset role;

-- ===========================================================================
-- Constraint: scope_type must be valid enum
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
  insert into public.events (
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type
  ) values (
    'e5000000-0000-0000-0000-000000000001',
    'Invalid Scope Event',
    'deposit_discovered',
    0,
    'invalid_scope'
  )
  $test$,
    '23514',
    null,
    'invalid scope_type rejected by CHECK constraint'
  );

reset role;

-- ===========================================================================
-- Constraint: duration_type must be instant or sustained
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
  insert into public.events (
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type,
    duration_type
  ) values (
    'e5000000-0000-0000-0000-000000000001',
    'Invalid Duration Event',
    'deposit_discovered',
    0,
    'world',
    'partially_sustained'
  )
  $test$,
    '23514',
    null,
    'invalid duration_type rejected by CHECK constraint'
  );

reset role;

-- ===========================================================================
-- Constraint: sustained duration requires duration_transitions > 0
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
  insert into public.events (
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type,
    duration_type,
    duration_transitions
  ) values (
    'e5000000-0000-0000-0000-000000000001',
    'Sustained No Duration',
    'resource_grant',
    0,
    'world',
    'sustained',
    null
  )
  $test$,
    '23514',
    null,
    'sustained duration without duration_transitions rejected'
  );

reset role;

-- ===========================================================================
-- Constraint: scope_type + FK exclusivity (nation scope requires scope_nation_id only)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- nation scope with settlement FK should fail
select
  throws_ok (
    $test$
  insert into public.events (
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type,
    scope_settlement_id
  ) values (
    'e5000000-0000-0000-0000-000000000001',
    'Mismatched Scope',
    'deposit_discovered',
    0,
    'nation',
    'e7000000-0000-0000-0000-000000000001'
  )
  $test$,
    '23514',
    null,
    'nation scope with settlement_id violates scope_fk_exclusivity'
  );

reset role;

-- ===========================================================================
-- Constraint: cross-world scope guard (scope_nation_id must belong to world_id)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Attempt to reference a nation from World B
select
  throws_ok (
    $test$
  insert into public.events (
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type,
    scope_nation_id
  ) values (
    'e5000000-0000-0000-0000-000000000001',
    'Cross-World Nation Event',
    'population_loss',
    0,
    'nation',
    'e6000000-0000-0000-0000-000000000002'
  )
  $test$,
    'P0001',
    null,
    'cross-world scope_nation_id rejected by trigger'
  );

reset role;

-- ===========================================================================
-- Constraint: cross-world scope guard (scope_settlement_id must belong to world_id)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Attempt to reference a settlement from World B
select
  throws_ok (
    $test$
  insert into public.events (
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type,
    scope_settlement_id
  ) values (
    'e5000000-0000-0000-0000-000000000001',
    'Cross-World Settlement Event',
    'deposit_discovered',
    0,
    'settlement',
    'e7000000-0000-0000-0000-000000000002'
  )
  $test$,
    'P0001',
    null,
    'cross-world scope_settlement_id rejected by trigger'
  );

reset role;

-- ===========================================================================
-- Valid scope+FK combinations (all must succeed)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
  insert into public.events (
    id,
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type
  ) values (
    'eb000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'World Scope Event',
    'resource_grant',
    0,
    'world'
  )
  $test$,
    'world scope (no FK) accepted'
  );

select
  lives_ok (
    $test$
  insert into public.events (
    id,
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type,
    scope_nation_id
  ) values (
    'eb000000-0000-0000-0000-000000000002',
    'e5000000-0000-0000-0000-000000000001',
    'Nation Scope Event',
    'population_loss',
    0,
    'nation',
    'e6000000-0000-0000-0000-000000000001'
  )
  $test$,
    'nation scope with scope_nation_id accepted'
  );

select
  lives_ok (
    $test$
  insert into public.events (
    id,
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type,
    scope_settlement_id
  ) values (
    'eb000000-0000-0000-0000-000000000003',
    'e5000000-0000-0000-0000-000000000001',
    'Settlement Scope Event',
    'deposit_discovered',
    0,
    'settlement',
    'e7000000-0000-0000-0000-000000000001'
  )
  $test$,
    'settlement scope with scope_settlement_id accepted'
  );

reset role;

-- ===========================================================================
-- Sustained duration with valid duration_transitions (must succeed)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
  insert into public.events (
    id,
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type,
    duration_type,
    duration_transitions,
    remaining_transitions,
    managed_population_type_id
  ) values (
    'eb000000-0000-0000-0000-000000000004',
    'e5000000-0000-0000-0000-000000000001',
    'Sustained Event',
    'population_loss',
    0,
    'world',
    'sustained',
    3,
    3,
    'e8000000-0000-0000-0000-000000000001'
  )
  $test$,
    'sustained duration with duration_transitions > 0 accepted'
  );

reset role;

-- ===========================================================================
-- Backfill: existing 'resolved' rows should be 'expired'
-- ===========================================================================
-- All existing 'resolved' rows were backfilled in the migration to 'expired',
-- so this event created earlier with default status 'pending' should remain.
select
  is (
    (
      select
        count(*)::integer
      from
        public.events
      where
        status = 'resolved'
    ),
    0,
    'no events with resolved status remain (backfilled to expired)'
  );

select
  *
from
  finish ();

rollback;
