-- pgTAP tests for public.advance_world_turn_if_current().
-- Run with: npx supabase test db
begin;

select
  plan (10);

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
    '89000000-0000-0000-0000-000000000001',
    'advance-turn-owner@example.com',
    'x',
    now(),
    '{"username":"advance_turn_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '89000000-0000-0000-0000-000000000002',
    'advance-turn-admin@example.com',
    'x',
    now(),
    '{"username":"advance_turn_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '89000000-0000-0000-0000-000000000003',
    'advance-turn-outsider@example.com',
    'x',
    now(),
    '{"username":"advance_turn_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (
    id,
    name,
    owner_id,
    current_turn_number,
    visibility,
    status
  )
values
  (
    '8a000000-0000-0000-0000-000000000001',
    'Advance Turn World',
    '89000000-0000-0000-0000-000000000001',
    4,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '8a000000-0000-0000-0000-000000000001',
    '89000000-0000-0000-0000-000000000002'
  );

-- ---------------------------------------------------------------------------
-- OWNER: matching expected turn advances exactly one turn.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"89000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.advance_world_turn_if_current ('8a000000-0000-0000-0000-000000000001', 4)
    ),
    1,
    'matching expected turn returns one running transition'
  );

select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = '8a000000-0000-0000-0000-000000000001'
    ),
    5,
    'matching expected turn advances the world exactly one turn'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_transitions
      where
        world_id = '8a000000-0000-0000-0000-000000000001'
        and from_turn_number = 4
        and to_turn_number = 5
        and initiated_by_user_id = '89000000-0000-0000-0000-000000000001'
        and status = 'running'
    ),
    1,
    'matching expected turn records the running transition'
  );

-- ---------------------------------------------------------------------------
-- STALE EXPECTED TURN: no world update and no second transition.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::integer
      from
        public.advance_world_turn_if_current ('8a000000-0000-0000-0000-000000000001', 4)
    ),
    0,
    'stale expected turn returns no transition'
  );

select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = '8a000000-0000-0000-0000-000000000001'
    ),
    5,
    'stale expected turn does not advance the world'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_transitions
      where
        world_id = '8a000000-0000-0000-0000-000000000001'
        and from_turn_number = 4
    ),
    1,
    'stale expected turn does not create another transition'
  );

reset role;

-- ---------------------------------------------------------------------------
-- WORLD ADMIN: explicit admins may advance through the narrow RPC.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"89000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.advance_world_turn_if_current ('8a000000-0000-0000-0000-000000000001', 5)
    ),
    1,
    'world admin can advance an administered world'
  );

select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = '8a000000-0000-0000-0000-000000000001'
    ),
    6,
    'world admin advance still increments exactly one turn'
  );

reset role;

-- ---------------------------------------------------------------------------
-- OUTSIDER: unauthorized callers cannot advance the world.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"89000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.advance_world_turn_if_current ('8a000000-0000-0000-0000-000000000001', 6)
    ),
    0,
    'outsider cannot advance an inaccessible world'
  );

reset role;

select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = '8a000000-0000-0000-0000-000000000001'
    ),
    6,
    'outsider request does not advance the world'
  );

rollback;
