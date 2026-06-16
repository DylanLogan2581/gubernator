-- pgTAP tests for update_event_group_with_events RPC bug fixes
-- Run with: npx supabase test db
--
-- Tests cover:
-- - Effects are inserted per event (not just the first one) in a multi-event group
-- - Pre-existing effects are deleted and replaced by the updated effect list
-- - Active events keep their remaining_transitions (in-flight countdown preserved)
-- - Pending events get remaining_transitions reset to the new duration value
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
    'f1000000-0000-0000-0000-000000000001',
    'upd-eg-admin@example.com',
    'x',
    now(),
    '{"username":"upd_eg_admin"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'Update EG World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001'
  );

insert into
  public.event_groups (id, world_id, name, created_during_turn_number)
values
  (
    'f5000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Multi-Target Group',
    0
  );

-- Event 1: pending, sustained, remaining_transitions=3 (original duration)
-- Event 2: active,  sustained, remaining_transitions=1 (in-flight, partially consumed)
insert into
  public.events (
    id,
    world_id,
    event_group_id,
    name,
    effect_type,
    status,
    activate_on_transition_after_turn_number,
    duration_type,
    duration_transitions,
    remaining_transitions
  )
values
  (
    'f6000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    'Event Pending',
    'resource_grant',
    'pending',
    0,
    'sustained',
    3,
    3
  ),
  (
    'f6000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    'Event Active',
    'resource_grant',
    'active',
    0,
    'sustained',
    3,
    1
  );

-- Pre-existing effects (stale, should be replaced by update)
insert into
  public.event_effects (
    id,
    event_id,
    effect_type,
    is_percent,
    amount_value
  )
values
  (
    'f7000000-0000-0000-0000-000000000001',
    'f6000000-0000-0000-0000-000000000001',
    'population_loss',
    false,
    50
  ),
  (
    'f7000000-0000-0000-0000-000000000002',
    'f6000000-0000-0000-0000-000000000002',
    'population_loss',
    false,
    50
  );

-- ===========================================================================
-- Call update_event_group_with_events as the world admin.
-- New duration = 5, new effect = resource_drain (replaces old population_loss).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.update_event_group_with_events(
      p_group_id                              := 'f5000000-0000-0000-0000-000000000001',
      p_group_name                            := 'Multi-Target Group (edited)',
      p_group_description                     := null,
      p_effects                               := '[{"effect_type":"building_damage"}]'::jsonb,
      p_duration_type                         := 'sustained',
      p_duration_transitions                  := 5,
      p_activate_on_transition_after_turn_number := 0,
      p_create_citizen_memories               := false,
      p_memory_text                           := null
    );
    $test$,
    'update_event_group_with_events succeeds for world admin'
  );

reset role;

-- ===========================================================================
-- Test 2: Effects exist on event 1 (pending)
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.event_effects
      where
        event_id = 'f6000000-0000-0000-0000-000000000001'
    ),
    1,
    'pending event has exactly 1 effect after update'
  );

-- ===========================================================================
-- Test 3: Effects exist on event 2 (active) — proves not just first event
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.event_effects
      where
        event_id = 'f6000000-0000-0000-0000-000000000002'
    ),
    1,
    'active event has exactly 1 effect after update (not only first event targeted)'
  );

-- ===========================================================================
-- Test 4: Total effects for group = 2 (one per non-expired event)
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.event_effects ee
        join public.events e on e.id = ee.event_id
      where
        e.event_group_id = 'f5000000-0000-0000-0000-000000000001'
    ),
    2,
    'total effects for group = 2 after update (one per event)'
  );

-- ===========================================================================
-- Test 5: Old effect replaced — new effect_type is resource_drain, not population_loss
-- ===========================================================================
select
  is (
    (
      select
        effect_type
      from
        public.event_effects
      where
        event_id = 'f6000000-0000-0000-0000-000000000001'
    ),
    'building_damage',
    'stale effect replaced: pending event now has building_damage effect'
  );

-- ===========================================================================
-- Test 6: Active event remaining_transitions preserved (was 1, not reset to 5)
-- ===========================================================================
select
  is (
    (
      select
        remaining_transitions
      from
        public.events
      where
        id = 'f6000000-0000-0000-0000-000000000002'
    ),
    1,
    'active event remaining_transitions preserved (in-flight countdown not reset)'
  );

-- ===========================================================================
-- Test 7: Pending event remaining_transitions reset to new duration (5)
-- ===========================================================================
select
  is (
    (
      select
        remaining_transitions
      from
        public.events
      where
        id = 'f6000000-0000-0000-0000-000000000001'
    ),
    5,
    'pending event remaining_transitions reset to new duration (5)'
  );

select
  *
from
  finish ();

rollback;
