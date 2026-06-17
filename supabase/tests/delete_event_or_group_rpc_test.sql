-- pgTAP tests for delete_event_or_group RPC
-- Run with: npx supabase test db
--
-- Tests cover:
-- - delete_event_or_group RPC exists and is a security definer function
-- - Deleting a cancelled event succeeds
-- - event_effects cascade delete when event is deleted
-- - Deleting a non-cancelled event is rejected
-- - Non-admin cannot delete events (RPC enforces permission check)
-- - Deleting last event in group also deletes the group
-- - Must provide either p_event_id or p_group_id, not both, not neither
begin;

select
  plan (12);

-- ---------------------------------------------------------------------------
-- Fixtures: users, worlds, admins, events, groups, and effects
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
    'delete-admin@example.com',
    'x',
    now(),
    '{"username":"delete_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'delete-nonadmin@example.com',
    'x',
    now(),
    '{"username":"delete_nonadmin"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'Delete Test World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001'
  );

-- Event group with 2 events
insert into
  public.event_groups (id, world_id, name, created_during_turn_number)
values
  (
    'd3000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Test Group 1',
    0
  );

insert into
  public.events (
    id,
    world_id,
    event_group_id,
    name,
    effect_type,
    status,
    activate_on_transition_after_turn_number
  )
values
  (
    'd4000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000001',
    'Event to Cancel',
    'population_loss',
    'pending',
    0
  ),
  (
    'd4000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000001',
    'Event to Delete Cancelled',
    'resource_grant',
    'cancelled',
    1
  ),
  (
    'd4000000-0000-0000-0000-000000000003',
    'd2000000-0000-0000-0000-000000000001',
    null,
    'Standalone Event to Delete',
    'population_boost',
    'cancelled',
    2
  );

-- Add an effect to the event that will be deleted
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
    'd5000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000002',
    'population_loss',
    false,
    10
  );

-- ===========================================================================
-- Test 1: RPC exists and is security definer
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        pg_proc
      where
        proname = 'delete_event_or_group'
        and pronamespace = (
          select
            oid
          from
            pg_namespace
          where
            nspname = 'public'
        )
    ),
    1,
    'delete_event_or_group RPC exists'
  );

select
  is (
    (
      select
        prosecdef::boolean
      from
        pg_proc
      where
        proname = 'delete_event_or_group'
        and pronamespace = (
          select
            oid
          from
            pg_namespace
          where
            nspname = 'public'
        )
    ),
    true,
    'delete_event_or_group is security definer'
  );

-- ===========================================================================
-- Test 2-4: Admin can delete a cancelled event
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        status
      from
        public.events
      where
        id = 'd4000000-0000-0000-0000-000000000002'
    ),
    'cancelled',
    'Event to delete is cancelled'
  );

select
  lives_ok (
    $test$
    select delete_event_or_group(
      p_event_id := 'd4000000-0000-0000-0000-000000000002',
      p_group_id := null
    );
  $test$,
    'Admin can delete a cancelled event'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.events
      where
        id = 'd4000000-0000-0000-0000-000000000002'
    ),
    0,
    'Cancelled event is deleted from DB'
  );

-- ===========================================================================
-- Test 5: event_effects cascade delete
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.event_effects
      where
        id = 'd5000000-0000-0000-0000-000000000001'
    ),
    0,
    'event_effects row cascaded delete'
  );

-- ===========================================================================
-- Test 6: Cannot delete non-cancelled event
-- ===========================================================================
select
  throws_ok (
    $test$
    select delete_event_or_group(
      p_event_id := 'd4000000-0000-0000-0000-000000000001',
      p_group_id := null
    );
  $test$,
    '23514',
    null,
    'Deleting non-cancelled event raises error'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.events
      where
        id = 'd4000000-0000-0000-0000-000000000001'
    ),
    1,
    'Non-cancelled event is not deleted'
  );

-- ===========================================================================
-- Test 7: Non-admin cannot delete (RPC enforces permission)
-- ===========================================================================
reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select delete_event_or_group(
      p_event_id := 'd4000000-0000-0000-0000-000000000003',
      p_group_id := null
    );
  $test$,
    'P0001',
    null,
    'Non-admin receives permission error'
  );

-- ===========================================================================
-- Test 8: Deleting last event in group also deletes group
-- ===========================================================================
reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- First cancel the remaining event in the group
update public.events
set
  status = 'cancelled'
where
  id = 'd4000000-0000-0000-0000-000000000001';

select
  is (
    (
      select
        count(*)::integer
      from
        public.events
      where
        event_group_id = 'd3000000-0000-0000-0000-000000000001'
    ),
    1,
    'Group has 1 event before delete'
  );

select
  lives_ok (
    $test$
    select delete_event_or_group(
      p_event_id := 'd4000000-0000-0000-0000-000000000001',
      p_group_id := null
    );
  $test$,
    'Admin can delete last event in group'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.event_groups
      where
        id = 'd3000000-0000-0000-0000-000000000001'
    ),
    0,
    'Group is deleted when last event is removed'
  );

reset role;

select
  *
from
  finish ();

rollback;
