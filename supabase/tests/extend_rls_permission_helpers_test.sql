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
-- Plus the read RLS rewiring on nations and nation_relationships, which
-- gates hidden nations behind nation_visible_to_current_user while admitting
-- non-hidden nations through current_user_has_world_access.
begin;

select
  plan (31);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- Users:
--   71...01 world owner (also a normal user)
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
    '71000000-0000-0000-0000-000000000002'
  );

-- Two nations: A (non-hidden) and B (hidden). Plus C in the other world. Plus
-- D (hidden) in world 1 so we have a same-world hidden/hidden pair for the
-- nation_relationships visibility test (cross-world inserts are now rejected).
insert into
  public.nations (id, world_id, name, is_hidden)
values
  (
    '73000000-0000-0000-0000-00000000000a',
    '72000000-0000-0000-0000-000000000001',
    'Nation A',
    false
  ),
  (
    '73000000-0000-0000-0000-00000000000b',
    '72000000-0000-0000-0000-000000000001',
    'Nation B (hidden)',
    true
  ),
  (
    '73000000-0000-0000-0000-00000000000c',
    '72000000-0000-0000-0000-000000000002',
    'Nation C',
    false
  ),
  (
    '73000000-0000-0000-0000-00000000000d',
    '72000000-0000-0000-0000-000000000001',
    'Nation D (hidden)',
    true
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

insert into
  public.nation_relationships (id, from_nation_id, to_nation_id, current_stance)
values
  (
    '76000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-00000000000a',
    '73000000-0000-0000-0000-00000000000b',
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
-- world owner: legacy path
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    public.current_user_has_world_access ('72000000-0000-0000-0000-000000000001'),
    true,
    'world owner retains world access (legacy path)'
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
-- super admin sees hidden nations
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    public.nation_visible_to_current_user ('73000000-0000-0000-0000-00000000000b'),
    true,
    'super admin sees hidden nations via nation_visible_to_current_user'
  );

reset role;

-- world admin sees hidden nations in their world
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    public.nation_visible_to_current_user ('73000000-0000-0000-0000-00000000000b'),
    true,
    'world admin sees hidden nations in their world'
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
    public.nation_visible_to_current_user ('73000000-0000-0000-0000-00000000000b'),
    false,
    'PC holder does not see hidden nations they do not inhabit'
  );

reset role;

-- ===========================================================================
-- Read RLS: hidden nation visibility through the SELECT policy
-- ===========================================================================
-- A plain player_character holder has world access through the PC path but
-- is not a world admin and does not live in the hidden nation, so the
-- hidden nation must remain invisible to them.
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
    'plain PC holder cannot read a hidden nation they do not inhabit'
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
    'plain PC holder reads non-hidden nations through current_user_has_world_access'
  );

reset role;

-- World admin can read the hidden nation through nation_visible_to_current_user.
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
    'world admin can read the hidden nation through the privileged path'
  );

reset role;

-- nation_relationships visibility piggybacks on nation visibility: the
-- plain PC holder lives in Nation A, so they see the A<->B relationship via
-- the visible-from-nation path but not the B<->C relationship, where
-- neither participant is visible to them (B is hidden; C is in a world they
-- have no access to).
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
    'plain PC holder sees the relationship rooted on the visible Nation A'
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
    'plain PC holder cannot see relationship between hidden Nation B and hidden Nation D'
  );

reset role;

select
  finish ();

rollback;
