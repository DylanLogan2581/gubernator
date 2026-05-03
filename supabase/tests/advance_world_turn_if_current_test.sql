-- pgTAP tests for public.advance_world_turn_if_current().
-- Run with: npx supabase test db
begin;

select
  plan (14);

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

insert into
  public.nations (id, world_id, name)
values
  (
    '8b000000-0000-0000-0000-000000000001',
    '8a000000-0000-0000-0000-000000000001',
    'Advance Turn Nation'
  );

insert into
  public.settlements (
    id,
    nation_id,
    name,
    auto_ready_enabled,
    is_ready_current_turn,
    ready_set_at
  )
values
  (
    '8c000000-0000-0000-0000-000000000001',
    '8b000000-0000-0000-0000-000000000001',
    'Manual Ready Settlement',
    false,
    true,
    '2026-05-02 12:00:00+00'
  ),
  (
    '8c000000-0000-0000-0000-000000000002',
    '8b000000-0000-0000-0000-000000000001',
    'Auto Ready Settlement',
    true,
    false,
    '2026-05-02 12:05:00+00'
  ),
  (
    '8c000000-0000-0000-0000-000000000003',
    '8b000000-0000-0000-0000-000000000001',
    'Manual Not Ready Settlement',
    false,
    false,
    null
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

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '8b000000-0000-0000-0000-000000000001'
        and auto_ready_enabled = false
        and is_ready_current_turn = false
    ),
    2,
    'non-auto-ready settlements reset to not ready after turn advance'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '8b000000-0000-0000-0000-000000000001'
        and auto_ready_enabled = false
        and ready_set_at is null
    ),
    2,
    'non-auto-ready settlements clear ready_set_at after turn advance'
  );

select
  is (
    (
      select
        is_ready_current_turn
      from
        public.settlements
      where
        id = '8c000000-0000-0000-0000-000000000002'
    ),
    true,
    'auto-ready settlements remain ready after turn advance'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '8b000000-0000-0000-0000-000000000001'
        and (
          auto_ready_enabled
          or is_ready_current_turn
        )
    ),
    1,
    'mixed settlements keep only auto-ready rows counted ready for the new turn'
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
