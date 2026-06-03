-- pgTAP tests for the player-character SELECT path on public.worlds.
-- Covers the worlds_select_player_character policy added in
-- 20260525000003_extend_worlds_settlements_rls_pc_path.sql.
-- Run with: npx supabase test db
begin;

select
  plan (5);

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
    '81000000-0000-0000-0000-000000000001',
    'worlds-pc-owner@example.com',
    'x',
    now(),
    '{"username":"worlds_pc_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000002',
    'worlds-pc-outsider@example.com',
    'x',
    now(),
    '{"username":"worlds_pc_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000003',
    'worlds-pc-holder@example.com',
    'x',
    now(),
    '{"username":"worlds_pc_holder"}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000004',
    'worlds-pc-suspended@example.com',
    'x',
    now(),
    '{"username":"worlds_pc_suspended"}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000005',
    'worlds-pc-dead@example.com',
    'x',
    now(),
    '{"username":"worlds_pc_dead"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    '82000000-0000-0000-0000-000000000001',
    'PC Test Private World',
    '81000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '83000000-0000-0000-0000-000000000001',
    '82000000-0000-0000-0000-000000000001',
    'PC Test Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '84000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    'PC Test Settlement'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status,
    user_id,
    role_type,
    death_cause_category
  )
values
  (
    '85000000-0000-0000-0000-000000000003',
    '82000000-0000-0000-0000-000000000001',
    '84000000-0000-0000-0000-000000000001',
    'player_character',
    'PC Holder Citizen',
    'alive',
    '81000000-0000-0000-0000-000000000003',
    'none',
    null
  ),
  (
    '85000000-0000-0000-0000-000000000004',
    '82000000-0000-0000-0000-000000000001',
    '84000000-0000-0000-0000-000000000001',
    'player_character',
    'Suspended PC Holder Citizen',
    'alive',
    '81000000-0000-0000-0000-000000000004',
    'none',
    null
  ),
  (
    '85000000-0000-0000-0000-000000000005',
    '82000000-0000-0000-0000-000000000001',
    '84000000-0000-0000-0000-000000000001',
    'player_character',
    'Dead PC Holder Citizen',
    'dead',
    '81000000-0000-0000-0000-000000000005',
    'none',
    'unknown'
  );

-- ===========================================================================
-- ANONYMOUS: cannot read the PC-accessible private world
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  ok (
    not exists (
      select
        1
      from
        public.worlds
      where
        id = '82000000-0000-0000-0000-000000000001'
    ),
    'anon cannot read a PC-accessible private world'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: active user with no PC in the world cannot read the private world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"81000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.worlds
      where
        id = '82000000-0000-0000-0000-000000000001'
    ),
    'active user with no PC cannot read a private world via the PC path'
  );

reset role;

-- ===========================================================================
-- PC HOLDER: active user with a living PC in the world can read it
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"81000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.worlds
      where
        id = '82000000-0000-0000-0000-000000000001'
    ),
    'active user with a living PC in a private world can read the world row'
  );

reset role;

-- ===========================================================================
-- SUSPENDED PC HOLDER: suspended user loses PC-path world access
-- ===========================================================================
update public.users
set
  status = 'suspended'
where
  id = '81000000-0000-0000-0000-000000000004';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"81000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.worlds
      where
        id = '82000000-0000-0000-0000-000000000001'
    ),
    'suspended PC holder cannot read a private world via the PC path'
  );

reset role;

-- ===========================================================================
-- DEAD PC HOLDER: user whose only PC is dead loses PC-path world access
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"81000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.worlds
      where
        id = '82000000-0000-0000-0000-000000000001'
    ),
    'user with only a dead PC cannot read a private world via the PC path'
  );

reset role;

select
  finish ();

rollback;
