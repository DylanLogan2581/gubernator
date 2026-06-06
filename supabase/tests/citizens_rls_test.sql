-- pgTAP tests for public.citizens RLS, column-level grants, and constraints.
-- Run with: npx supabase test db
--
-- The Nation Manager and Settlement Manager player_characters in these
-- fixtures live in a separate world (World C) from the nation/settlement they
-- govern (World A). This isolates the Nation/Settlement Manager visibility
-- helpers from the broader PC-holder visibility rule, so the
-- "denied outside" assertions actually exercise the manager scoping rather
-- than being shadowed by user_has_player_character_in_world.
begin;

select
  plan (55);

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
    'c1000000-0000-0000-0000-000000000001',
    'citizens-owner@example.com',
    'x',
    now(),
    '{"username":"citizens_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'citizens-admin@example.com',
    'x',
    now(),
    '{"username":"citizens_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'citizens-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"citizens_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000004',
    'citizens-settlement-mgr@example.com',
    'x',
    now(),
    '{"username":"citizens_settlement_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000005',
    'citizens-pc-holder@example.com',
    'x',
    now(),
    '{"username":"citizens_pc_holder"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000006',
    'citizens-unrelated@example.com',
    'x',
    now(),
    '{"username":"citizens_unrelated"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000007',
    'citizens-superadmin@example.com',
    'x',
    now(),
    '{"username":"citizens_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000008',
    'citizens-pc-other@example.com',
    'x',
    now(),
    '{"username":"citizens_pc_other"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'c1000000-0000-0000-0000-000000000007';

-- World A: subject world. Managers govern within this world.
-- World B: a separate world used to verify cross-world denial.
-- World C: holds the manager users' player characters so the manager
--          visibility paths can be exercised without also satisfying
--          user_has_player_character_in_world for World A.
insert into
  public.worlds (id, name, visibility, status)
values
  (
    -- World A is public so the citizens RLS subquery against settlements
    -- (which uses has_world_access) can succeed for the Nation Manager and
    -- Settlement Manager users whose PCs live in another world. The citizens
    -- policy has no public-world visibility arm of its own, so this does not
    -- broaden citizen visibility for unrelated users.
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'public',
    'active'
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    'Citizens World B',
    'private',
    'active'
  ),
  (
    'c2000000-0000-0000-0000-000000000003',
    'Citizens World C',
    'public',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'c3000000-0000-0000-0000-00000000000a',
    'c2000000-0000-0000-0000-000000000001',
    'Nation A'
  ),
  (
    'c3000000-0000-0000-0000-00000000000b',
    'c2000000-0000-0000-0000-000000000001',
    'Nation B'
  ),
  (
    'c3000000-0000-0000-0000-00000000000d',
    'c2000000-0000-0000-0000-000000000003',
    'Nation C (host of manager PCs)'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'c4000000-0000-0000-0000-0000000000a1',
    'c3000000-0000-0000-0000-00000000000a',
    'Settlement A1'
  ),
  (
    'c4000000-0000-0000-0000-0000000000a2',
    'c3000000-0000-0000-0000-00000000000a',
    'Settlement A2'
  ),
  (
    'c4000000-0000-0000-0000-0000000000b1',
    'c3000000-0000-0000-0000-00000000000b',
    'Settlement B1'
  ),
  (
    'c4000000-0000-0000-0000-0000000000d1',
    'c3000000-0000-0000-0000-00000000000d',
    'Settlement C1'
  );

-- Nation Manager's PC lives in World C but governs Nation A in World A.
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
    role_nation_id
  )
values
  (
    'c5000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000003',
    'c4000000-0000-0000-0000-0000000000d1',
    'player_character',
    'Nation A Manager (lives in World C)',
    'alive',
    'c1000000-0000-0000-0000-000000000003',
    'nation_manager',
    'c3000000-0000-0000-0000-00000000000a'
  );

-- Settlement Manager's PC lives in World C but governs Settlement A1 in World A.
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
    role_settlement_id
  )
values
  (
    'c5000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000003',
    'c4000000-0000-0000-0000-0000000000d1',
    'player_character',
    'Settlement A1 Manager (lives in World C)',
    'alive',
    'c1000000-0000-0000-0000-000000000004',
    'settlement_manager',
    'c4000000-0000-0000-0000-0000000000a1'
  );

-- Plain PC holder in World A (no role).
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id
  )
values
  (
    'c5000000-0000-0000-0000-000000000003',
    'c2000000-0000-0000-0000-000000000001',
    'c4000000-0000-0000-0000-0000000000a2',
    'player_character',
    'World A PC Holder',
    'alive',
    'c1000000-0000-0000-0000-000000000005'
  );

-- Second PC in World A, owned by a different user than the PC holder.
-- Used by the cross-citizen update tests to verify that a PC cannot edit
-- another player character's row even when they can see it.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id
  )
values
  (
    'c5000000-0000-0000-0000-000000000004',
    'c2000000-0000-0000-0000-000000000001',
    'c4000000-0000-0000-0000-0000000000a2',
    'player_character',
    'World A PC Other',
    'alive',
    'c1000000-0000-0000-0000-000000000008'
  );

-- NPCs across the World A nations/settlements to drive visibility checks.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status
  )
values
  (
    'c5000000-0000-0000-0000-000000000010',
    'c2000000-0000-0000-0000-000000000001',
    'c4000000-0000-0000-0000-0000000000a1',
    'npc',
    'NPC in A1',
    'alive'
  ),
  (
    'c5000000-0000-0000-0000-000000000011',
    'c2000000-0000-0000-0000-000000000001',
    'c4000000-0000-0000-0000-0000000000a2',
    'npc',
    'NPC in A2',
    'alive'
  ),
  (
    'c5000000-0000-0000-0000-000000000012',
    'c2000000-0000-0000-0000-000000000001',
    'c4000000-0000-0000-0000-0000000000b1',
    'npc',
    'NPC in B1',
    'alive'
  ),
  (
    'c5000000-0000-0000-0000-000000000020',
    'c2000000-0000-0000-0000-000000000002',
    null,
    'npc',
    'NPC in World B',
    'alive'
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
        public.citizens
    ),
    0,
    'anon cannot read citizens'
  );

reset role;

-- ===========================================================================
-- UNRELATED AUTHENTICATED USER: no read access into another user's world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizens
      where
        world_id = 'c2000000-0000-0000-0000-000000000001'
    ),
    0,
    'unrelated authenticated user cannot read citizens in another user''s world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: full read access within administered world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizens
      where
        world_id = 'c2000000-0000-0000-0000-000000000001'
    ),
    5,
    'world admin can read every citizen in administered world'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizens
      where
        world_id = 'c2000000-0000-0000-0000-000000000002'
    ),
    0,
    'world admin cannot read citizens outside administered world'
  );

-- Column-level SELECT restriction: flavor columns are not readable via
-- direct table SELECT even for world admins. Admins must use the
-- get_citizen_admin_details RPC.
select
  throws_ok (
    $test$
    select
      personality_text
    from
      public.citizens
    where
      id = 'c5000000-0000-0000-0000-000000000010'
    $test$,
    '42501',
    null,
    'world admin cannot select personality_text directly from the table API'
  );

select
  throws_ok (
    $test$
    select
      npc_secret_contradiction
    from
      public.citizens
    where
      id = 'c5000000-0000-0000-0000-000000000010'
    $test$,
    '42501',
    null,
    'world admin cannot select npc_secret_contradiction directly from the table API'
  );

-- Getter RPC: world admin can retrieve flavor columns for any citizen in the
-- administered world.
select
  lives_ok (
    $test$
    select
      *
    from
      public.get_citizen_admin_details ('c5000000-0000-0000-0000-000000000010')
    $test$,
    'world admin can call get_citizen_admin_details for a citizen in their world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: getter RPC works across worlds
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  lives_ok (
    $test$
    select
      *
    from
      public.get_citizen_admin_details ('c5000000-0000-0000-0000-000000000020')
    $test$,
    'super admin can call get_citizen_admin_details for a citizen in any world'
  );

reset role;

-- ===========================================================================
-- NATION MANAGER: visibility restricted to settlements within the managed
-- nation. Manager's PC is in World C; visibility into World A comes solely
-- from the Nation Manager helper.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.citizens
      where
        id = 'c5000000-0000-0000-0000-000000000010'
    ),
    'nation manager cannot read NPC in a settlement within their nation'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.citizens
      where
        id = 'c5000000-0000-0000-0000-000000000011'
    ),
    'nation manager cannot read NPC in another settlement within their nation'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.citizens
      where
        id = 'c5000000-0000-0000-0000-000000000012'
    ),
    'nation manager cannot read NPC in a settlement outside their nation'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.citizens
      where
        id = 'c5000000-0000-0000-0000-000000000020'
    ),
    'nation manager cannot read NPC in another world'
  );

-- Nation manager can still see player_character rows in their managed nation.
select
  ok (
    exists (
      select
        1
      from
        public.citizens
      where
        id = 'c5000000-0000-0000-0000-000000000003'
    ),
    'nation manager can read PC in a settlement within their nation'
  );

-- Getter RPC must be denied for non-admin callers.
select
  throws_ok (
    $test$
    select
      *
    from
      public.get_citizen_admin_details ('c5000000-0000-0000-0000-000000000010')
    $test$,
    '42501',
    null,
    'nation manager cannot call get_citizen_admin_details'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: visibility restricted to citizens in the managed
-- settlement. Manager's PC is in World C, so the PC-holder rule does not
-- broaden visibility into World A.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.citizens
      where
        id = 'c5000000-0000-0000-0000-000000000010'
    ),
    'settlement manager cannot read NPC in their settlement'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.citizens
      where
        id = 'c5000000-0000-0000-0000-000000000011'
    ),
    'settlement manager cannot read NPC in a sibling settlement of the same nation'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.citizens
      where
        id = 'c5000000-0000-0000-0000-000000000012'
    ),
    'settlement manager cannot read NPC in a settlement outside their nation'
  );

-- Getter RPC must be denied for settlement managers.
select
  throws_ok (
    $test$
    select
      *
    from
      public.get_citizen_admin_details ('c5000000-0000-0000-0000-000000000010')
    $test$,
    '42501',
    null,
    'settlement manager cannot call get_citizen_admin_details'
  );

reset role;

-- ===========================================================================
-- PC HOLDER: can read any citizen in a world they hold a player character in,
-- but not in worlds they do not.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizens
      where
        world_id = 'c2000000-0000-0000-0000-000000000001'
    ),
    2,
    'PC holder can read only player_character citizens in their world (NPCs hidden)'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.citizens
      where
        id = 'c5000000-0000-0000-0000-000000000010'
    ),
    'PC holder cannot read NPC rows in their world'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.citizens
      where
        id = 'c5000000-0000-0000-0000-000000000020'
    ),
    'PC holder cannot read citizens in another world where they hold no PC'
  );

-- Getter RPC must be denied for PC holders.
select
  throws_ok (
    $test$
    select
      *
    from
      public.get_citizen_admin_details ('c5000000-0000-0000-0000-000000000010')
    $test$,
    '42501',
    null,
    'PC holder cannot call get_citizen_admin_details'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: cross-world visibility
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizens
      where
        world_id in (
          'c2000000-0000-0000-0000-000000000001',
          'c2000000-0000-0000-0000-000000000002',
          'c2000000-0000-0000-0000-000000000003'
        )
    ),
    8,
    'super admin can read citizens across worlds'
  );

reset role;

-- ===========================================================================
-- COLUMN-LEVEL GRANTS: gated columns are unreachable through the table API
-- even for the world admin path.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    update public.citizens
    set user_id = 'c1000000-0000-0000-0000-000000000005'
    where id = 'c5000000-0000-0000-0000-000000000010'
  $test$,
    '42501',
    null,
    'world admin cannot set citizens.user_id directly via the table API'
  );

select
  throws_ok (
    $test$
    update public.citizens
    set role_type = 'settlement_manager'
    where id = 'c5000000-0000-0000-0000-000000000003'
  $test$,
    '42501',
    null,
    'world admin cannot set citizens.role_type directly via the table API'
  );

select
  throws_ok (
    $test$
    update public.citizens
    set role_nation_id = 'c3000000-0000-0000-0000-00000000000a'
    where id = 'c5000000-0000-0000-0000-000000000003'
  $test$,
    '42501',
    null,
    'world admin cannot set citizens.role_nation_id directly via the table API'
  );

select
  throws_ok (
    $test$
    update public.citizens
    set role_settlement_id = 'c4000000-0000-0000-0000-0000000000a1'
    where id = 'c5000000-0000-0000-0000-000000000003'
  $test$,
    '42501',
    null,
    'world admin cannot set citizens.role_settlement_id directly via the table API'
  );

reset role;

-- ===========================================================================
-- CONSTRAINTS: shape checks fire regardless of caller path. These inserts
-- run as the migration owner so column-level grants do not mask the
-- check_violation / foreign_key_violation under test.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.citizens (
      world_id, citizen_type, name, user_id
    ) values (
      'c2000000-0000-0000-0000-000000000001',
      'npc',
      'NPC With User',
      'c1000000-0000-0000-0000-000000000005'
    )
  $test$,
    '23514',
    null,
    'NPC citizens cannot have user_id'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (
      world_id, citizen_type, name
    ) values (
      'c2000000-0000-0000-0000-000000000001',
      'player_character',
      'PC Without User'
    )
  $test$,
    '23514',
    null,
    'player_character citizens require user_id'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (
      world_id, citizen_type, name, role_type
    ) values (
      'c2000000-0000-0000-0000-000000000001',
      'npc',
      'Bad Role Scope NM',
      'nation_manager'
    )
  $test$,
    '23514',
    null,
    'role_type=nation_manager requires role_nation_id'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (
      world_id, citizen_type, name, role_type, role_nation_id, role_settlement_id
    ) values (
      'c2000000-0000-0000-0000-000000000001',
      'npc',
      'Bad Role Scope NM with Settlement',
      'nation_manager',
      'c3000000-0000-0000-0000-00000000000a',
      'c4000000-0000-0000-0000-0000000000a1'
    )
  $test$,
    '23514',
    null,
    'role_type=nation_manager rejects a populated role_settlement_id'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (
      world_id, citizen_type, name, role_type
    ) values (
      'c2000000-0000-0000-0000-000000000001',
      'npc',
      'Bad Role Scope SM',
      'settlement_manager'
    )
  $test$,
    '23514',
    null,
    'role_type=settlement_manager requires role_settlement_id'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (
      world_id, citizen_type, name, role_type, role_nation_id
    ) values (
      'c2000000-0000-0000-0000-000000000001',
      'npc',
      'Bad Role Scope None With Nation',
      'none',
      'c3000000-0000-0000-0000-00000000000a'
    )
  $test$,
    '23514',
    null,
    'role_type=none rejects any role scope columns'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (
      world_id, citizen_type, name, parent_a_citizen_id
    ) values (
      'c2000000-0000-0000-0000-000000000001',
      'npc',
      'NPC With Bogus Parent',
      '00000000-0000-0000-0000-0000000000ff'
    )
  $test$,
    '23503',
    null,
    'parent_a_citizen_id must reference an existing citizen'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (
      world_id, citizen_type, name, parent_a_citizen_id
    ) values (
      'c2000000-0000-0000-0000-000000000001',
      'npc',
      'Child With Cross-World Parent A',
      'c5000000-0000-0000-0000-000000000020'
    )
  $test$,
    '23503',
    null,
    'parent_a_citizen_id must belong to the same world as the child citizen'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (
      world_id, citizen_type, name, parent_b_citizen_id
    ) values (
      'c2000000-0000-0000-0000-000000000001',
      'npc',
      'Child With Cross-World Parent B',
      'c5000000-0000-0000-0000-000000000020'
    )
  $test$,
    '23503',
    null,
    'parent_b_citizen_id must belong to the same world as the child citizen'
  );

-- ===========================================================================
-- PC SELF-EDIT: player_character may only change the safe column subset.
-- Protected columns (settlement_id, parent_a/b_citizen_id, status,
-- born_on_turn_number, death_cause) must be rejected with 42501 when a PC
-- attempts to change them directly via the table API.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  throws_ok (
    $test$
    update public.citizens
    set settlement_id = 'c4000000-0000-0000-0000-0000000000a1'
    where id = 'c5000000-0000-0000-0000-000000000003'
  $test$,
    '42501',
    null,
    'PC cannot change their own settlement_id via the table API'
  );

select
  throws_ok (
    $test$
    update public.citizens
    set parent_a_citizen_id = 'c5000000-0000-0000-0000-000000000010'
    where id = 'c5000000-0000-0000-0000-000000000003'
  $test$,
    '42501',
    null,
    'PC cannot change their own parent_a_citizen_id via the table API'
  );

select
  throws_ok (
    $test$
    update public.citizens
    set parent_b_citizen_id = 'c5000000-0000-0000-0000-000000000010'
    where id = 'c5000000-0000-0000-0000-000000000003'
  $test$,
    '42501',
    null,
    'PC cannot change their own parent_b_citizen_id via the table API'
  );

select
  throws_ok (
    $test$
    update public.citizens
    set status = 'dead'
    where id = 'c5000000-0000-0000-0000-000000000003'
  $test$,
    '42501',
    null,
    'PC cannot self-mark status=dead via the table API'
  );

select
  throws_ok (
    $test$
    update public.citizens
    set born_on_turn_number = 1
    where id = 'c5000000-0000-0000-0000-000000000003'
  $test$,
    '42501',
    null,
    'PC cannot change their own born_on_turn_number via the table API'
  );

select
  throws_ok (
    $test$
    update public.citizens
    set death_cause = 'poisoned'
    where id = 'c5000000-0000-0000-0000-000000000003'
  $test$,
    '42501',
    null,
    'PC cannot set their own death_cause via the table API'
  );

select
  lives_ok (
    $test$
    update public.citizens
    set name = 'Renamed PC'
    where id = 'c5000000-0000-0000-0000-000000000003'
  $test$,
    'PC can change their own name via the table API'
  );

select
  lives_ok (
    $test$
    update public.citizens
    set sex = 'female'
    where id = 'c5000000-0000-0000-0000-000000000003'
  $test$,
    'PC can change their own sex via the table API'
  );

select
  lives_ok (
    $test$
    update public.citizens
    set profile_photo_url = 'https://example.com/photo.png'
    where id = 'c5000000-0000-0000-0000-000000000003'
  $test$,
    'PC can change their own profile_photo_url via the table API'
  );

select
  lives_ok (
    $test$
    update public.citizens
    set personality_text = 'Brave and curious.'
    where id = 'c5000000-0000-0000-0000-000000000003'
  $test$,
    'PC can change their own personality_text via the table API'
  );

select
  lives_ok (
    $test$
    update public.citizens
    set skills_text = 'Archery, stealth.'
    where id = 'c5000000-0000-0000-0000-000000000003'
  $test$,
    'PC can change their own skills_text via the table API'
  );

reset role;

-- ===========================================================================
-- PC CROSS-CITIZEN EDIT: a player_character cannot update another citizen's
-- row at all. The citizens_update_self RLS policy restricts UPDATE to rows
-- where user_id = current_app_user_id(), so any attempt on a row owned by
-- a different user is silently filtered out (0 rows affected, no error).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  lives_ok (
    $test$
    do $$
    declare
      n integer;
    begin
      update public.citizens
      set settlement_id = 'c4000000-0000-0000-0000-0000000000a1'
      where id = 'c5000000-0000-0000-0000-000000000004';
      get diagnostics n = row_count;
      if n != 0 then
        raise exception 'expected 0 rows but % were updated', n;
      end if;
    end;
    $$
    $test$,
    'PC cannot update a protected column on another PC''s row (RLS silently blocks)'
  );

select
  lives_ok (
    $test$
    do $$
    declare
      n integer;
    begin
      update public.citizens
      set name = 'Hacked Name'
      where id = 'c5000000-0000-0000-0000-000000000004';
      get diagnostics n = row_count;
      if n != 0 then
        raise exception 'expected 0 rows but % were updated', n;
      end if;
    end;
    $$
    $test$,
    'PC cannot update a safe column on another PC''s row (RLS silently blocks)'
  );

reset role;

-- ===========================================================================
-- ADMIN PROTECTED COLUMN UPDATE: world admin can still update protected
-- columns on any citizen in the world.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    update public.citizens
    set settlement_id = 'c4000000-0000-0000-0000-0000000000a2'
    where id = 'c5000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can update settlement_id on any citizen in the administered world'
  );

select
  lives_ok (
    $test$
    update public.citizens
    set parent_a_citizen_id = 'c5000000-0000-0000-0000-000000000011'
    where id = 'c5000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can update parent_a_citizen_id on any citizen in the administered world'
  );

select
  lives_ok (
    $test$
    update public.citizens
    set parent_b_citizen_id = 'c5000000-0000-0000-0000-000000000012'
    where id = 'c5000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can update parent_b_citizen_id on any citizen in the administered world'
  );

select
  lives_ok (
    $test$
    select * from public.mark_citizen_dead (
      'c5000000-0000-0000-0000-000000000010',
      'admin action'
    )
  $test$,
    'world admin can mark a citizen dead via the mark_citizen_dead RPC'
  );

select
  lives_ok (
    $test$
    update public.citizens
    set born_on_turn_number = 5
    where id = 'c5000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can update born_on_turn_number on any citizen in the administered world'
  );

select
  lives_ok (
    $test$
    update public.citizens
    set death_cause = 'battle'
    where id = 'c5000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can update death_cause on any citizen in the administered world'
  );

reset role;

select
  *
from
  finish ();

rollback;
