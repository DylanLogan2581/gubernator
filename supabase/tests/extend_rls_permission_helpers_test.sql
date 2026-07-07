-- pgTAP tests for extend_rls_permission_helpers migration.
-- Run with: npx supabase test db
--
-- Covers the helpers introduced in
-- 20260522000001_extend_rls_permission_helpers.sql:
--   current_user_player_character_ids
--   current_user_active_player_character_id
--   current_user_manages_nation
--   current_user_manages_settlement
--   current_user_has_world_access
--   nation_visible_to_current_user
-- Plus the read RLS on nations and nation_relationships, which gates every
-- nation behind nation_visible_to_current_user: super admin, world admin,
-- a living player_character in the nation itself, or (since #1086) the
-- nation having met the nation of the caller's active player_character via
-- nation_discoveries. There is no more "world access" fallback arm.
begin;

select
  plan (33);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- Users:
--   71...01 explicit world admin (also a normal user)
--   71...02 world admin (explicit world_admins row)
--   71...03 outsider (no access to the world)
--   71...04 super admin
--   71...05 nation manager (player character governs nation A)
--   71...06 settlement manager (player character governs settlement A1)
--   71...07 plain player_character holder (lives in settlement A1)
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
    '71000000-0000-0000-0000-000000000001',
    'helpers-owner@example.com',
    'x',
    now(),
    '{"username":"helpers_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-0000-0000-000000000002',
    'helpers-admin@example.com',
    'x',
    now(),
    '{"username":"helpers_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-0000-0000-000000000003',
    'helpers-outsider@example.com',
    'x',
    now(),
    '{"username":"helpers_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-0000-0000-000000000004',
    'helpers-super@example.com',
    'x',
    now(),
    '{"username":"helpers_super"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-0000-0000-000000000005',
    'helpers-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"helpers_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-0000-0000-000000000006',
    'helpers-settlement-mgr@example.com',
    'x',
    now(),
    '{"username":"helpers_settlement_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-0000-0000-000000000007',
    'helpers-pc@example.com',
    'x',
    now(),
    '{"username":"helpers_pc"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = '71000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    '72000000-0000-0000-0000-000000000001',
    'Helpers Private World',
    'private',
    'active'
  ),
  (
    '72000000-0000-0000-0000-000000000002',
    'Helpers Other World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001'
  ),
  (
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000002'
  );

-- Four nations in world 1 (plus C in the other world). Nation A has met
-- Nation D (nation_discoveries row below); Nation B has met neither A nor D,
-- so it stays the "unmet" nation exercised by the nation_visible_to_current_user
-- and read-RLS assertions below.
insert into
  public.nations (id, world_id, name)
values
  (
    '73000000-0000-0000-0000-00000000000a',
    '72000000-0000-0000-0000-000000000001',
    'Nation A'
  ),
  (
    '73000000-0000-0000-0000-00000000000b',
    '72000000-0000-0000-0000-000000000001',
    'Nation B (unmet)'
  ),
  (
    '73000000-0000-0000-0000-00000000000c',
    '72000000-0000-0000-0000-000000000002',
    'Nation C'
  ),
  (
    '73000000-0000-0000-0000-00000000000d',
    '72000000-0000-0000-0000-000000000001',
    'Nation D'
  );

-- A and D have met; B has met neither.
insert into
  public.nation_discoveries (
    world_id,
    nation_a_id,
    nation_b_id,
    met_at_turn_number
  )
values
  (
    '72000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-00000000000a',
    '73000000-0000-0000-0000-00000000000d',
    1
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '74000000-0000-0000-0000-0000000000a1',
    '73000000-0000-0000-0000-00000000000a',
    'Settlement A1'
  ),
  (
    '74000000-0000-0000-0000-0000000000b1',
    '73000000-0000-0000-0000-00000000000b',
    'Settlement B1'
  );

-- Player_character citizens linked to manager and PC users. Roles are
-- inserted via privileged role so the column grants on citizens do not
-- restrict the test fixture.
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
    '75000000-0000-0000-0000-000000000005',
    '72000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-0000000000a1',
    'player_character',
    'Nation Manager PC',
    'alive',
    '71000000-0000-0000-0000-000000000005',
    'nation_manager',
    '73000000-0000-0000-0000-00000000000a',
    null
  ),
  (
    '75000000-0000-0000-0000-000000000006',
    '72000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-0000000000a1',
    'player_character',
    'Settlement Manager PC',
    'alive',
    '71000000-0000-0000-0000-000000000006',
    'settlement_manager',
    null,
    '74000000-0000-0000-0000-0000000000a1'
  ),
  (
    '75000000-0000-0000-0000-000000000007',
    '72000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-0000000000a1',
    'player_character',
    'Plain PC',
    'alive',
    '71000000-0000-0000-0000-000000000007',
    'none',
    null,
    null
  );

-- A<->D relationship: both sides visible to a PC holder living in A (they
-- have met). B<->D relationship: B has met neither A nor D, so this row
-- stays invisible to anyone without a privileged path into B.
insert into
  public.nation_relationships (id, from_nation_id, to_nation_id, current_stance)
values
  (
    '76000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-00000000000a',
    '73000000-0000-0000-0000-00000000000d',
    'neutral'
  ),
  (
    '76000000-0000-0000-0000-000000000002',
    '73000000-0000-0000-0000-00000000000b',
    '73000000-0000-0000-0000-00000000000d',
    'neutral'
  );

insert into
  public.user_active_player_characters (user_id, world_id, citizen_id)
values
  (
    '71000000-0000-0000-0000-000000000007',
    '72000000-0000-0000-0000-000000000001',
    '75000000-0000-0000-0000-000000000007'
  );

-- ===========================================================================
-- current_user_player_character_ids
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.current_user_player_character_ids ('72000000-0000-0000-0000-000000000001')
    ),
    1,
    'PC holder sees exactly their own player_character id in the world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.current_user_player_character_ids ('72000000-0000-0000-0000-000000000001') id
      where
        id = '75000000-0000-0000-0000-000000000007'
    ),
    'PC holder current_user_player_character_ids returns their citizen id'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.current_user_player_character_ids ('72000000-0000-0000-0000-000000000002')
    ),
    0,
    'PC holder gets empty set in a world where they hold no character'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.current_user_player_character_ids ('72000000-0000-0000-0000-000000000001')
    ),
    0,
    'outsider gets empty set from current_user_player_character_ids'
  );

reset role;

-- ===========================================================================
-- current_user_active_player_character_id
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  is (
    public.current_user_active_player_character_id ('72000000-0000-0000-0000-000000000001'),
    '75000000-0000-0000-0000-000000000007'::uuid,
    'active player character id matches the stored selection'
  );

select
  is (
    public.current_user_active_player_character_id ('72000000-0000-0000-0000-000000000002'),
    null::uuid,
    'active player character id is null in a world with no stored selection'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    public.current_user_active_player_character_id ('72000000-0000-0000-0000-000000000001'),
    null::uuid,
    'outsider has no active player character id'
  );

reset role;

-- ===========================================================================
-- current_user_manages_nation
-- ===========================================================================
-- super admin
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    public.current_user_manages_nation ('73000000-0000-0000-0000-00000000000a'),
    true,
    'super admin manages every nation'
  );

reset role;

-- world admin
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    public.current_user_manages_nation ('73000000-0000-0000-0000-00000000000a'),
    true,
    'world admin manages nations in their world'
  );

select
  is (
    public.current_user_manages_nation ('73000000-0000-0000-0000-00000000000c'),
    false,
    'world admin does not manage nations in worlds they do not administer'
  );

reset role;

-- nation manager PC holder
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  is (
    public.current_user_manages_nation ('73000000-0000-0000-0000-00000000000a'),
    true,
    'nation manager PC holder manages the nation they govern'
  );

select
  is (
    public.current_user_manages_nation ('73000000-0000-0000-0000-00000000000b'),
    false,
    'nation manager PC holder does not manage other nations'
  );

reset role;

-- plain PC holder
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  is (
    public.current_user_manages_nation ('73000000-0000-0000-0000-00000000000a'),
    false,
    'plain PC holder does not manage any nation'
  );

reset role;

-- ===========================================================================
-- current_user_manages_settlement
-- ===========================================================================
-- settlement manager
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  is (
    public.current_user_manages_settlement ('74000000-0000-0000-0000-0000000000a1'),
    true,
    'settlement manager PC holder manages their settlement'
  );

select
  is (
    public.current_user_manages_settlement ('74000000-0000-0000-0000-0000000000b1'),
    false,
    'settlement manager PC holder does not manage other settlements'
  );

reset role;

-- nation manager also manages settlements inside their nation
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  is (
    public.current_user_manages_settlement ('74000000-0000-0000-0000-0000000000a1'),
    true,
    'nation manager manages settlements inside their nation'
  );

reset role;

-- super admin
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    public.current_user_manages_settlement ('74000000-0000-0000-0000-0000000000b1'),
    true,
    'super admin manages every settlement'
  );

reset role;

-- plain PC holder
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  is (
    public.current_user_manages_settlement ('74000000-0000-0000-0000-0000000000a1'),
    false,
    'plain PC holder does not manage any settlement'
  );

reset role;

-- ===========================================================================
-- current_user_has_world_access
-- ===========================================================================
-- explicit world admin
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    public.current_user_has_world_access ('72000000-0000-0000-0000-000000000001'),
    true,
    'explicit world admin retains world access'
  );

reset role;

-- outsider has no access
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    public.current_user_has_world_access ('72000000-0000-0000-0000-000000000001'),
    false,
    'outsider with no PC and no admin role has no world access'
  );

reset role;

-- plain PC holder gains world access through the player-character path.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  is (
    public.current_user_has_world_access ('72000000-0000-0000-0000-000000000001'),
    true,
    'plain PC holder gets world access through the player-character path'
  );

reset role;

-- suspended PC holder loses world access
update public.users
set
  status = 'suspended'
where
  id = '71000000-0000-0000-0000-000000000007';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  is (
    public.current_user_has_world_access ('72000000-0000-0000-0000-000000000001'),
    false,
    'suspended PC holder loses world access through the player-character path'
  );

reset role;

update public.users
set
  status = 'active'
where
  id = '71000000-0000-0000-0000-000000000007';

-- ===========================================================================
-- nation_visible_to_current_user
-- ===========================================================================
-- super admin sees unmet nations
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    public.nation_visible_to_current_user ('73000000-0000-0000-0000-00000000000b'),
    true,
    'super admin sees unmet nations via nation_visible_to_current_user'
  );

reset role;

-- world admin sees unmet nations in their world
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    public.nation_visible_to_current_user ('73000000-0000-0000-0000-00000000000b'),
    true,
    'world admin sees unmet nations in their world'
  );

reset role;

-- PC holder whose settlement is in nation A sees nation A
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  is (
    public.nation_visible_to_current_user ('73000000-0000-0000-0000-00000000000a'),
    true,
    'PC holder sees the nation containing their player-character settlement'
  );

select
  is (
    public.nation_visible_to_current_user ('73000000-0000-0000-0000-00000000000d'),
    true,
    'PC holder sees a nation their own nation has met'
  );

select
  is (
    public.nation_visible_to_current_user ('73000000-0000-0000-0000-00000000000b'),
    false,
    'PC holder does not see a nation their own nation has not met'
  );

reset role;

-- ===========================================================================
-- Read RLS: unmet nation visibility through the SELECT policy
-- ===========================================================================
-- A plain player_character holder is not a world admin and their nation has
-- not met Nation B, so Nation B must remain invisible to them.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.nations
      where
        id = '73000000-0000-0000-0000-00000000000b'
    ),
    'plain PC holder cannot read a nation their nation has not met'
  );

select
  ok (
    exists (
      select
        1
      from
        public.nations
      where
        id = '73000000-0000-0000-0000-00000000000a'
    ),
    'plain PC holder reads their own nation'
  );

select
  ok (
    exists (
      select
        1
      from
        public.nations
      where
        id = '73000000-0000-0000-0000-00000000000d'
    ),
    'plain PC holder reads a nation their own nation has met'
  );

reset role;

-- World admin can read the unmet nation through nation_visible_to_current_user.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.nations
      where
        id = '73000000-0000-0000-0000-00000000000b'
    ),
    'world admin can read the unmet nation through the privileged path'
  );

reset role;

-- nation_relationships visibility requires BOTH participants to be visible:
-- the plain PC holder lives in Nation A, which has met Nation D, so the
-- A<->D relationship is visible. The B<->D relationship stays invisible
-- because Nation B has met neither A nor D, so it is not visible to the
-- plain PC holder.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.nation_relationships
      where
        id = '76000000-0000-0000-0000-000000000001'
    ),
    'plain PC holder sees the relationship between their own nation and a nation it has met'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.nation_relationships
      where
        id = '76000000-0000-0000-0000-000000000002'
    ),
    'plain PC holder cannot see a relationship where a participant nation has not been met'
  );

reset role;

select
  finish ();

rollback;
