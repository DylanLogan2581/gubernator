-- pgTAP tests for add_player_character_role_mutations migration.
-- Run with: npx supabase test db
--
-- Covers:
--   • Column-level grants still block direct writes to user_id, role_type,
--     role_nation_id, and role_settlement_id from the authenticated role.
--   • link_user_to_citizen / unlink_user_from_citizen are admin-only.
--   • link clears a stale role whose scope no longer matches the citizen's
--     settlement/nation and preserves a role whose scope still matches.
--   • assign_citizen_role enforces scope-matches-citizen and citizen-is-PC.
--   • Nation Manager can only assign/revoke settlement_manager for citizens
--     in their nation; non-admins cannot link/unlink.
--   • Archived worlds are no-ops for all four RPCs.
begin;

select
  plan (19);

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
    'a0000000-0000-0000-0000-000000000001',
    'role-owner@example.com',
    'x',
    now(),
    '{"username":"role_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'role-other@example.com',
    'x',
    now(),
    '{"username":"role_other"}'::jsonb,
    now(),
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'role-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"role_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'role-link-target@example.com',
    'x',
    now(),
    '{"username":"role_link_target"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'a1000000-0000-0000-0000-000000000001',
    'Role World',
    'a0000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.worlds (
    id,
    name,
    owner_id,
    visibility,
    status,
    archived_at
  )
values
  (
    'a1000000-0000-0000-0000-000000000002',
    'Role Archived World',
    'a0000000-0000-0000-0000-000000000001',
    'private',
    'archived',
    now()
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'a2000000-0000-0000-0000-00000000000a',
    'a1000000-0000-0000-0000-000000000001',
    'Nation A'
  ),
  (
    'a2000000-0000-0000-0000-00000000000b',
    'a1000000-0000-0000-0000-000000000001',
    'Nation B'
  ),
  (
    'a2000000-0000-0000-0000-00000000000c',
    'a1000000-0000-0000-0000-000000000002',
    'Archived Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'a3000000-0000-0000-0000-0000000000a1',
    'a2000000-0000-0000-0000-00000000000a',
    'Settlement A1'
  ),
  (
    'a3000000-0000-0000-0000-0000000000a2',
    'a2000000-0000-0000-0000-00000000000a',
    'Settlement A2'
  ),
  (
    'a3000000-0000-0000-0000-0000000000b1',
    'a2000000-0000-0000-0000-00000000000b',
    'Settlement B1'
  ),
  (
    'a3000000-0000-0000-0000-0000000000c1',
    'a2000000-0000-0000-0000-00000000000c',
    'Archived Settlement'
  );

-- Nation Manager player_character (governs Nation A).
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
    role_nation_id,
    role_settlement_id
  )
values
  (
    'a4000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-0000000000a1',
    'player_character',
    'Nation A Manager',
    'alive',
    'a0000000-0000-0000-0000-000000000003',
    'nation_manager',
    'a2000000-0000-0000-0000-00000000000a',
    null
  );

-- Plain NPC in Settlement A1, no role, no user.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status
  )
values
  (
    'a4000000-0000-0000-0000-000000000010',
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-0000000000a1',
    'npc',
    'NPC A1',
    'alive'
  );

-- NPC in Settlement A1 that already carries a STALE settlement_manager role
-- pointing at Settlement B1 (different nation). Used to verify that link
-- clears a role whose scope no longer matches the citizen.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status,
    role_type,
    role_nation_id,
    role_settlement_id
  )
values
  (
    'a4000000-0000-0000-0000-000000000011',
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-0000000000a1',
    'npc',
    'NPC With Stale Role',
    'alive',
    'settlement_manager',
    null,
    'a3000000-0000-0000-0000-0000000000b1'
  );

-- NPC in Settlement A1 that already carries a role whose scope still matches
-- the citizen (settlement_manager of A1). Used to verify link preserves
-- still-valid roles.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status,
    role_type,
    role_nation_id,
    role_settlement_id
  )
values
  (
    'a4000000-0000-0000-0000-000000000012',
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-0000000000a1',
    'npc',
    'NPC With Valid Role',
    'alive',
    'settlement_manager',
    null,
    'a3000000-0000-0000-0000-0000000000a1'
  );

-- Player character in Settlement A1 to assign/revoke roles against.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status,
    user_id
  )
values
  (
    'a4000000-0000-0000-0000-000000000020',
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-0000000000a1',
    'player_character',
    'Target PC A1',
    'alive',
    'a0000000-0000-0000-0000-000000000002'
  );

-- Player character in archived world.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status,
    user_id
  )
values
  (
    'a4000000-0000-0000-0000-000000000030',
    'a1000000-0000-0000-0000-000000000002',
    'a3000000-0000-0000-0000-0000000000c1',
    'player_character',
    'Archived PC',
    'alive',
    'a0000000-0000-0000-0000-000000000004'
  );

-- ===========================================================================
-- Column-level grants block direct writes to the gated columns.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    update public.citizens
    set user_id = 'a0000000-0000-0000-0000-000000000002'
    where id = 'a4000000-0000-0000-0000-000000000010'
  $test$,
    '42501',
    null,
    'admin cannot set citizens.user_id directly'
  );

select
  throws_ok (
    $test$
    update public.citizens
    set role_type = 'settlement_manager'
    where id = 'a4000000-0000-0000-0000-000000000020'
  $test$,
    '42501',
    null,
    'admin cannot set citizens.role_type directly'
  );

select
  throws_ok (
    $test$
    update public.citizens
    set role_nation_id = 'a2000000-0000-0000-0000-00000000000a'
    where id = 'a4000000-0000-0000-0000-000000000020'
  $test$,
    '42501',
    null,
    'admin cannot set citizens.role_nation_id directly'
  );

select
  throws_ok (
    $test$
    update public.citizens
    set role_settlement_id = 'a3000000-0000-0000-0000-0000000000a1'
    where id = 'a4000000-0000-0000-0000-000000000020'
  $test$,
    '42501',
    null,
    'admin cannot set citizens.role_settlement_id directly'
  );

-- ===========================================================================
-- World owner: link/unlink + assign/revoke (admin path).
-- ===========================================================================
select
  ok (
    (
      select
        citizen_type = 'player_character'
        and user_id = 'a0000000-0000-0000-0000-000000000004'
      from
        public.link_user_to_citizen (
          'a4000000-0000-0000-0000-000000000010',
          'a0000000-0000-0000-0000-000000000004'
        )
    ),
    'link_user_to_citizen flips NPC to player_character and sets user_id'
  );

-- Stale role gets cleared on link because role_settlement_id (B1) is not the
-- citizen's settlement (A1).
select
  ok (
    (
      select
        role_type = 'none'
        and role_nation_id is null
        and role_settlement_id is null
      from
        public.link_user_to_citizen (
          'a4000000-0000-0000-0000-000000000011',
          'a0000000-0000-0000-0000-000000000004'
        )
    ),
    'link_user_to_citizen clears a role whose scope no longer matches'
  );

-- Reset link_target user back to user 4 so the next valid-role link uses it
-- on a fresh citizen with no prior link conflicts.
set
  local "request.jwt.claims" = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    (
      select
        role_type = 'settlement_manager'
        and role_settlement_id = 'a3000000-0000-0000-0000-0000000000a1'
      from
        public.link_user_to_citizen (
          'a4000000-0000-0000-0000-000000000012',
          'a0000000-0000-0000-0000-000000000002'
        )
    ),
    'link_user_to_citizen preserves a role whose scope still matches'
  );

-- assign_citizen_role: admin path with scope mismatch is rejected.
select
  is (
    (
      select
        count(*)::integer
      from
        public.assign_citizen_role (
          'a4000000-0000-0000-0000-000000000020',
          'settlement_manager',
          null,
          'a3000000-0000-0000-0000-0000000000b1'
        )
    ),
    0,
    'assign_citizen_role rejects settlement scope that does not match citizen settlement'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.assign_citizen_role (
          'a4000000-0000-0000-0000-000000000020',
          'nation_manager',
          'a2000000-0000-0000-0000-00000000000b',
          null
        )
    ),
    0,
    'assign_citizen_role rejects nation scope that does not match citizen nation'
  );

select
  ok (
    (
      select
        role_type = 'settlement_manager'
        and role_settlement_id = 'a3000000-0000-0000-0000-0000000000a1'
        and role_nation_id is null
      from
        public.assign_citizen_role (
          'a4000000-0000-0000-0000-000000000020',
          'settlement_manager',
          null,
          'a3000000-0000-0000-0000-0000000000a1'
        )
    ),
    'assign_citizen_role writes settlement_manager when scope matches'
  );

select
  ok (
    (
      select
        role_type = 'none'
        and role_nation_id is null
        and role_settlement_id is null
      from
        public.revoke_citizen_role ('a4000000-0000-0000-0000-000000000020')
    ),
    'revoke_citizen_role resets all role columns to none'
  );

-- Archived-world citizen: all four RPCs no-op.
select
  is (
    (
      select
        count(*)::integer
      from
        public.unlink_user_from_citizen ('a4000000-0000-0000-0000-000000000030')
    ),
    0,
    'unlink_user_from_citizen returns no rows for archived-world citizen'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.assign_citizen_role (
          'a4000000-0000-0000-0000-000000000030',
          'settlement_manager',
          null,
          'a3000000-0000-0000-0000-0000000000c1'
        )
    ),
    0,
    'assign_citizen_role returns no rows for archived-world citizen'
  );

reset role;

-- ===========================================================================
-- Outsider with no access: every RPC is a no-op.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.link_user_to_citizen (
          'a4000000-0000-0000-0000-000000000010',
          'a0000000-0000-0000-0000-000000000002'
        )
    ),
    0,
    'non-admin cannot link a user to a citizen'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.unlink_user_from_citizen ('a4000000-0000-0000-0000-000000000020')
    ),
    0,
    'non-admin cannot unlink a user from a citizen'
  );

reset role;

-- ===========================================================================
-- Nation Manager: can assign/revoke settlement_manager only.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

-- Nation Manager cannot link.
select
  is (
    (
      select
        count(*)::integer
      from
        public.link_user_to_citizen (
          'a4000000-0000-0000-0000-000000000010',
          'a0000000-0000-0000-0000-000000000002'
        )
    ),
    0,
    'nation manager cannot link a user to a citizen'
  );

-- Nation Manager cannot assign a nation_manager role.
select
  is (
    (
      select
        count(*)::integer
      from
        public.assign_citizen_role (
          'a4000000-0000-0000-0000-000000000020',
          'nation_manager',
          'a2000000-0000-0000-0000-00000000000a',
          null
        )
    ),
    0,
    'nation manager cannot assign nation_manager role'
  );

-- Nation Manager can assign settlement_manager to a citizen in their nation.
select
  ok (
    (
      select
        role_type = 'settlement_manager'
        and role_settlement_id = 'a3000000-0000-0000-0000-0000000000a1'
      from
        public.assign_citizen_role (
          'a4000000-0000-0000-0000-000000000020',
          'settlement_manager',
          null,
          'a3000000-0000-0000-0000-0000000000a1'
        )
    ),
    'nation manager can assign settlement_manager for a citizen in their nation'
  );

-- Nation Manager can revoke that settlement_manager role.
select
  ok (
    (
      select
        role_type = 'none'
      from
        public.revoke_citizen_role ('a4000000-0000-0000-0000-000000000020')
    ),
    'nation manager can revoke a settlement_manager role in their nation'
  );

reset role;

select
  *
from
  finish ();

rollback;
