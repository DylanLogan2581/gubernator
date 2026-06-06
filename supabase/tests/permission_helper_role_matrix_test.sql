-- pgTAP tests for the Epic 3 permission helpers, viewed as a
-- role x helper matrix. The helpers added in
-- 20260522000001_extend_rls_permission_helpers.sql are reused by every
-- domain table from Epic 3 onward, so this file exercises each helper
-- directly against every role it is supposed to recognize -- independent
-- of any single feature's RLS policy.
--
-- Helpers under test:
--   current_user_player_character_ids
--   current_user_active_player_character_id
--   current_user_manages_nation
--   current_user_manages_settlement
--   current_user_has_world_access
--   nation_visible_to_current_user
--
-- Roles exercised against each helper:
--   super admin                (is_super_admin = true)
--   world admin                (explicit world_admins row)
--   Nation Manager             (player_character with role_type = nation_manager)
--   Settlement Manager         (player_character with role_type = settlement_manager)
--   unrelated authenticated    (active app user with no access)
begin;

select
  plan (30);

-- ---------------------------------------------------------------------------
-- Deterministic seed data
-- ---------------------------------------------------------------------------
-- Auth users. Identifiers use the b1...0X scheme so they do not collide
-- with other permission tests in this directory.
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
    'b1000000-0000-0000-0000-000000000001',
    'matrix-owner@example.com',
    'x',
    now(),
    '{"username":"matrix_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'matrix-super@example.com',
    'x',
    now(),
    '{"username":"matrix_super"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000003',
    'matrix-world-admin@example.com',
    'x',
    now(),
    '{"username":"matrix_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000004',
    'matrix-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"matrix_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000005',
    'matrix-settlement-mgr@example.com',
    'x',
    now(),
    '{"username":"matrix_settlement_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000006',
    'matrix-unrelated@example.com',
    'x',
    now(),
    '{"username":"matrix_unrelated"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'b1000000-0000-0000-0000-000000000002';

-- World W1 is the subject world for the matrix. Owned by a separate user
-- (b1...01) so the world owner path does not accidentally satisfy a role
-- that should otherwise fail.
insert into
  public.worlds (id, name, visibility, status)
values
  (
    'b2000000-0000-0000-0000-000000000001',
    'Matrix World W1',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000003'
  );

-- Two nations in W1: N1 (visible) and N2 (hidden). N1 hosts settlement S1
-- where the Nation Manager and Settlement Manager PCs live; N2 has no
-- player_character so the manager users cannot see it via the PC path.
insert into
  public.nations (id, world_id, name, is_hidden)
values
  (
    'b3000000-0000-0000-0000-00000000000a',
    'b2000000-0000-0000-0000-000000000001',
    'Nation N1',
    false
  ),
  (
    'b3000000-0000-0000-0000-00000000000b',
    'b2000000-0000-0000-0000-000000000001',
    'Nation N2 (hidden)',
    true
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'b4000000-0000-0000-0000-0000000000a1',
    'b3000000-0000-0000-0000-00000000000a',
    'Settlement S1'
  );

-- Nation Manager PC governs N1; lives in S1 (inside N1).
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
    role_nation_id,
    role_settlement_id
  )
values
  (
    'b5000000-0000-0000-0000-000000000004',
    'b2000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-0000000000a1',
    'player_character',
    'Matrix Nation Manager PC',
    'alive',
    'b1000000-0000-0000-0000-000000000004',
    'nation_manager',
    'b3000000-0000-0000-0000-00000000000a',
    null
  ),
  (
    'b5000000-0000-0000-0000-000000000005',
    'b2000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-0000000000a1',
    'player_character',
    'Matrix Settlement Manager PC',
    'alive',
    'b1000000-0000-0000-0000-000000000005',
    'settlement_manager',
    null,
    'b4000000-0000-0000-0000-0000000000a1'
  );

-- Active PC selections for both manager users.
insert into
  public.user_active_player_characters (user_id, world_id, citizen_id)
values
  (
    'b1000000-0000-0000-0000-000000000004',
    'b2000000-0000-0000-0000-000000000001',
    'b5000000-0000-0000-0000-000000000004'
  ),
  (
    'b1000000-0000-0000-0000-000000000005',
    'b2000000-0000-0000-0000-000000000001',
    'b5000000-0000-0000-0000-000000000005'
  );

-- ===========================================================================
-- current_user_player_character_ids(world_id)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.current_user_player_character_ids ('b2000000-0000-0000-0000-000000000001')
    ),
    0,
    'current_user_player_character_ids: super admin holds no player_character'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.current_user_player_character_ids ('b2000000-0000-0000-0000-000000000001')
    ),
    0,
    'current_user_player_character_ids: world admin holds no player_character'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.current_user_player_character_ids ('b2000000-0000-0000-0000-000000000001') id
      where
        id = 'b5000000-0000-0000-0000-000000000004'
    ),
    'current_user_player_character_ids: Nation Manager sees their own PC id'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.current_user_player_character_ids ('b2000000-0000-0000-0000-000000000001') id
      where
        id = 'b5000000-0000-0000-0000-000000000005'
    ),
    'current_user_player_character_ids: Settlement Manager sees their own PC id'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.current_user_player_character_ids ('b2000000-0000-0000-0000-000000000001')
    ),
    0,
    'current_user_player_character_ids: unrelated user gets empty set'
  );

reset role;

-- ===========================================================================
-- current_user_active_player_character_id(world_id)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    public.current_user_active_player_character_id ('b2000000-0000-0000-0000-000000000001'),
    null::uuid,
    'current_user_active_player_character_id: super admin has no active PC'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    public.current_user_active_player_character_id ('b2000000-0000-0000-0000-000000000001'),
    null::uuid,
    'current_user_active_player_character_id: world admin has no active PC'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    public.current_user_active_player_character_id ('b2000000-0000-0000-0000-000000000001'),
    'b5000000-0000-0000-0000-000000000004'::uuid,
    'current_user_active_player_character_id: Nation Manager returns their stored selection'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  is (
    public.current_user_active_player_character_id ('b2000000-0000-0000-0000-000000000001'),
    'b5000000-0000-0000-0000-000000000005'::uuid,
    'current_user_active_player_character_id: Settlement Manager returns their stored selection'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  is (
    public.current_user_active_player_character_id ('b2000000-0000-0000-0000-000000000001'),
    null::uuid,
    'current_user_active_player_character_id: unrelated user has no active PC'
  );

reset role;

-- ===========================================================================
-- current_user_manages_nation(nation_id)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    public.current_user_manages_nation ('b3000000-0000-0000-0000-00000000000a'),
    true,
    'current_user_manages_nation: super admin manages every nation'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    public.current_user_manages_nation ('b3000000-0000-0000-0000-00000000000a'),
    true,
    'current_user_manages_nation: world admin manages nations in their world'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    public.current_user_manages_nation ('b3000000-0000-0000-0000-00000000000a'),
    true,
    'current_user_manages_nation: Nation Manager manages the nation they govern'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  is (
    public.current_user_manages_nation ('b3000000-0000-0000-0000-00000000000a'),
    false,
    'current_user_manages_nation: Settlement Manager does not manage the parent nation'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  is (
    public.current_user_manages_nation ('b3000000-0000-0000-0000-00000000000a'),
    false,
    'current_user_manages_nation: unrelated user manages no nation'
  );

reset role;

-- ===========================================================================
-- current_user_manages_settlement(settlement_id)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    public.current_user_manages_settlement ('b4000000-0000-0000-0000-0000000000a1'),
    true,
    'current_user_manages_settlement: super admin manages every settlement'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    public.current_user_manages_settlement ('b4000000-0000-0000-0000-0000000000a1'),
    true,
    'current_user_manages_settlement: world admin manages settlements in their world'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    public.current_user_manages_settlement ('b4000000-0000-0000-0000-0000000000a1'),
    true,
    'current_user_manages_settlement: Nation Manager manages settlements inside their nation'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  is (
    public.current_user_manages_settlement ('b4000000-0000-0000-0000-0000000000a1'),
    true,
    'current_user_manages_settlement: Settlement Manager manages their settlement'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  is (
    public.current_user_manages_settlement ('b4000000-0000-0000-0000-0000000000a1'),
    false,
    'current_user_manages_settlement: unrelated user manages no settlement'
  );

reset role;

-- ===========================================================================
-- current_user_has_world_access(world_id)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    public.current_user_has_world_access ('b2000000-0000-0000-0000-000000000001'),
    true,
    'current_user_has_world_access: super admin reaches every world'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    public.current_user_has_world_access ('b2000000-0000-0000-0000-000000000001'),
    true,
    'current_user_has_world_access: world admin reaches their world'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    public.current_user_has_world_access ('b2000000-0000-0000-0000-000000000001'),
    true,
    'current_user_has_world_access: Nation Manager reaches the world via their PC'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  is (
    public.current_user_has_world_access ('b2000000-0000-0000-0000-000000000001'),
    true,
    'current_user_has_world_access: Settlement Manager reaches the world via their PC'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  is (
    public.current_user_has_world_access ('b2000000-0000-0000-0000-000000000001'),
    false,
    'current_user_has_world_access: unrelated user is denied'
  );

reset role;

-- ===========================================================================
-- nation_visible_to_current_user(nation_id)
-- ===========================================================================
-- Exercises the hidden nation N2: the Nation Manager and Settlement Manager
-- PCs live in N1, so the player-character branch of the helper does not
-- admit them to N2. Only super admin and world admin pass.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    public.nation_visible_to_current_user ('b3000000-0000-0000-0000-00000000000b'),
    true,
    'nation_visible_to_current_user: super admin sees hidden nations'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    public.nation_visible_to_current_user ('b3000000-0000-0000-0000-00000000000b'),
    true,
    'nation_visible_to_current_user: world admin sees hidden nations in their world'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    public.nation_visible_to_current_user ('b3000000-0000-0000-0000-00000000000b'),
    false,
    'nation_visible_to_current_user: Nation Manager cannot see a hidden nation outside their PC settlement'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  is (
    public.nation_visible_to_current_user ('b3000000-0000-0000-0000-00000000000b'),
    false,
    'nation_visible_to_current_user: Settlement Manager cannot see a hidden nation outside their PC settlement'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  is (
    public.nation_visible_to_current_user ('b3000000-0000-0000-0000-00000000000b'),
    false,
    'nation_visible_to_current_user: unrelated user cannot see hidden nations'
  );

reset role;

select
  finish ();

rollback;
