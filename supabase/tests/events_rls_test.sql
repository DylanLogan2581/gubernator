-- pgTAP tests for public.events RLS policies.
-- Run with: npx supabase test db
--
-- Tests cover:
-- - events_select_world_access: user must have world access to read
-- - events_insert_world_admin: only world admin or super admin can insert
-- - events_update_world_admin: only world admin or super admin can update
-- - events_delete_world_admin: only world admin or super admin can delete
-- - Cross-world denial: world-A admin cannot write events in world-B
begin;

select
  plan (16);

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
    'events-owner@example.com',
    'x',
    now(),
    '{"username":"events_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'events-admin@example.com',
    'x',
    now(),
    '{"username":"events_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'events-outsider@example.com',
    'x',
    now(),
    '{"username":"events_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'events-superadmin@example.com',
    'x',
    now(),
    '{"username":"events_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e1000000-0000-0000-0000-000000000004';

-- World A: subject world where events_owner and events_admin are admins
-- World B: separate world to test cross-world denial
insert into
  public.worlds (id, name, visibility, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Events World A',
    'private',
    'active'
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'Events World B',
    'private',
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
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000003'
  );

-- Events in World A
insert into
  public.events (
    id,
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number
  )
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Event A1',
    'deposit_discovered',
    0
  ),
  (
    'e3000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'Event A2',
    'population_loss',
    1
  );

-- Event in World B
insert into
  public.events (
    id,
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number
  )
values
  (
    'e3000000-0000-0000-0000-000000000003',
    'e2000000-0000-0000-0000-000000000002',
    'Event B1',
    'resource_grant',
    0
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
        public.events
    ),
    0,
    'anon cannot read events'
  );

reset role;

-- ===========================================================================
-- OUTSIDER (non-admin, no world access): no read, no write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.events
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    0,
    'non-admin cannot read events in world without access'
  );

select
  throws_ok (
    $test$
    insert into public.events (
      world_id,
      name,
      effect_type,
      activate_on_transition_after_turn_number
    )
    values (
      'e2000000-0000-0000-0000-000000000001',
      'Outsider Insert',
      'deposit_discovered',
      0
    )
  $test$,
    '42501',
    null,
    'non-admin cannot insert events into inaccessible world'
  );

select
  throws_ok (
    $test$
    update public.events
    set name = 'Outsider Update'
    where id = 'e3000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'non-admin cannot update events in inaccessible world'
  );

select
  throws_ok (
    $test$
    delete from public.events
    where id = 'e3000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'non-admin cannot delete events in inaccessible world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN (A): full read+write in World A, blocked from World B
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.events
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    2,
    'world admin can read events in administered world'
  );

select
  lives_ok (
    $test$
    insert into public.events (
      id,
      world_id,
      name,
      effect_type,
      activate_on_transition_after_turn_number
    )
    values (
      'e3000000-0000-0000-0000-000000000004',
      'e2000000-0000-0000-0000-000000000001',
      'Admin Insert A',
      'deposit_discovered',
      2
    )
  $test$,
    'world admin can insert events in administered world'
  );

select
  lives_ok (
    $test$
    update public.events
    set name = 'Admin Updated'
    where id = 'e3000000-0000-0000-0000-000000000004'
  $test$,
    'world admin can update events in administered world'
  );

select
  lives_ok (
    $test$
    delete from public.events
    where id = 'e3000000-0000-0000-0000-000000000004'
  $test$,
    'world admin can delete events in administered world'
  );

-- World-A admin blocked from writing to World-B events
select
  throws_ok (
    $test$
    insert into public.events (
      world_id,
      name,
      effect_type,
      activate_on_transition_after_turn_number
    )
    values (
      'e2000000-0000-0000-0000-000000000002',
      'Admin Cross-World Insert',
      'resource_grant',
      1
    )
  $test$,
    '42501',
    null,
    'world-A admin cannot insert events into world-B'
  );

select
  throws_ok (
    $test$
    update public.events
    set name = 'World A Admin Hack B'
    where id = 'e3000000-0000-0000-0000-000000000003'
  $test$,
    '42501',
    null,
    'world-A admin cannot update events in world-B'
  );

select
  throws_ok (
    $test$
    delete from public.events
    where id = 'e3000000-0000-0000-0000-000000000003'
  $test$,
    '42501',
    null,
    'world-A admin cannot delete events in world-B'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: cross-world read+write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.events
      where
        world_id in (
          'e2000000-0000-0000-0000-000000000001',
          'e2000000-0000-0000-0000-000000000002'
        )
    ),
    3,
    'super admin can read events across worlds'
  );

select
  lives_ok (
    $test$
    insert into public.events (
      id,
      world_id,
      name,
      effect_type,
      activate_on_transition_after_turn_number
    )
    values (
      'e3000000-0000-0000-0000-000000000005',
      'e2000000-0000-0000-0000-000000000002',
      'Super Admin Insert B',
      'population_loss',
      1
    )
  $test$,
    'super admin can insert events in any world'
  );

select
  lives_ok (
    $test$
    update public.events
    set name = 'Super Admin Updated'
    where id = 'e3000000-0000-0000-0000-000000000005'
  $test$,
    'super admin can update events in any world'
  );

select
  lives_ok (
    $test$
    delete from public.events
    where id = 'e3000000-0000-0000-0000-000000000005'
  $test$,
    'super admin can delete events in any world'
  );

reset role;

select
  *
from
  finish ();

rollback;
