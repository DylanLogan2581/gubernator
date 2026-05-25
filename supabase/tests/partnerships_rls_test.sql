-- pgTAP tests for public.partnerships RLS, admin-only writes, and constraints.
-- Run with: npx supabase test db
--
-- Partnership read visibility mirrors citizens read visibility: a partnership
-- row is visible to a caller if either participant citizen is visible. To
-- exercise the "either participant" arm of the policy, the fixtures include a
-- cross-world partnership row whose participants live in different worlds, so
-- that a World A admin sees it only via citizen_b and a World B admin sees it
-- only via citizen_a.
--
-- Writes via the table API are admin-only: super admin or world admin of the
-- world containing the partnership's citizen_a_id. The dedicated mutation
-- RPCs (create_partnership, dissolve_partnership, ...) are covered separately.
--
-- Constraints exercised:
--   • partnerships_distinct_citizens_check: a self-pair is rejected.
--   • partnerships_unique_active_citizen_a_idx /
--     partnerships_unique_active_citizen_b_idx: at most one active partnership
--     row per citizen on each side.
--   • partnerships_ended_on_turn_number_check: ended_on_turn_number is null
--     iff status = 'active'.
begin;

select
  plan (23);

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
    'partnerships-world-a-owner@example.com',
    'x',
    now(),
    '{"username":"partnerships_world_a_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'partnerships-unrelated@example.com',
    'x',
    now(),
    '{"username":"partnerships_unrelated"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'partnerships-pc-holder@example.com',
    'x',
    now(),
    '{"username":"partnerships_pc_holder"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'partnerships-superadmin@example.com',
    'x',
    now(),
    '{"username":"partnerships_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000005',
    'partnerships-world-b-owner@example.com',
    'x',
    now(),
    '{"username":"partnerships_world_b_owner"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Partnerships World A',
    'e1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'Partnerships World B',
    'e1000000-0000-0000-0000-000000000005',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-00000000000a',
    'e2000000-0000-0000-0000-000000000001',
    'Partnerships Nation A'
  ),
  (
    'e3000000-0000-0000-0000-00000000000b',
    'e2000000-0000-0000-0000-000000000002',
    'Partnerships Nation B'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-0000000000a1',
    'e3000000-0000-0000-0000-00000000000a',
    'Partnerships Settlement A1'
  ),
  (
    'e4000000-0000-0000-0000-0000000000b1',
    'e3000000-0000-0000-0000-00000000000b',
    'Partnerships Settlement B1'
  );

-- NPCs in World A used as partnership participants.
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
    'e5000000-0000-0000-0000-0000000000a1',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-0000000000a1',
    'npc',
    'NPC A1',
    'alive'
  ),
  (
    'e5000000-0000-0000-0000-0000000000a2',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-0000000000a1',
    'npc',
    'NPC A2',
    'alive'
  ),
  (
    'e5000000-0000-0000-0000-0000000000a3',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-0000000000a1',
    'npc',
    'NPC A3 (cross-world partner side A)',
    'alive'
  ),
  (
    'e5000000-0000-0000-0000-0000000000a5',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-0000000000a1',
    'npc',
    'NPC A5 (admin insert participant)',
    'alive'
  ),
  (
    'e5000000-0000-0000-0000-0000000000a6',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-0000000000a1',
    'npc',
    'NPC A6 (admin insert participant)',
    'alive'
  ),
  (
    'e5000000-0000-0000-0000-0000000000a7',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-0000000000a1',
    'npc',
    'NPC A7 (unique-active probe)',
    'alive'
  ),
  (
    'e5000000-0000-0000-0000-0000000000a8',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-0000000000a1',
    'npc',
    'NPC A8 (unique-active probe)',
    'alive'
  );

-- PC holder citizen in World A grants the PC holder user broad read visibility
-- via user_has_player_character_in_world.
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
    'e5000000-0000-0000-0000-0000000000a4',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-0000000000a1',
    'player_character',
    'PC Holder in World A',
    'alive',
    'e1000000-0000-0000-0000-000000000003'
  );

-- NPCs in World B used as partnership participants.
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
    'e5000000-0000-0000-0000-0000000000b1',
    'e2000000-0000-0000-0000-000000000002',
    'e4000000-0000-0000-0000-0000000000b1',
    'npc',
    'NPC B1',
    'alive'
  ),
  (
    'e5000000-0000-0000-0000-0000000000b2',
    'e2000000-0000-0000-0000-000000000002',
    'e4000000-0000-0000-0000-0000000000b1',
    'npc',
    'NPC B2',
    'alive'
  ),
  (
    'e5000000-0000-0000-0000-0000000000b3',
    'e2000000-0000-0000-0000-000000000002',
    'e4000000-0000-0000-0000-0000000000b1',
    'npc',
    'NPC B3 (cross-world partner side B)',
    'alive'
  );

-- World A active partnership.
insert into
  public.partnerships (
    id,
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number
  )
values
  (
    'e6000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-0000000000a1',
    'e5000000-0000-0000-0000-0000000000a2',
    'active',
    1
  );

-- World B active partnership.
insert into
  public.partnerships (
    id,
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number
  )
values
  (
    'e6000000-0000-0000-0000-000000000002',
    'e5000000-0000-0000-0000-0000000000b1',
    'e5000000-0000-0000-0000-0000000000b2',
    'active',
    1
  );

-- Cross-world partnership: citizen_a in World B, citizen_b in World A. World A
-- callers can only see this row via the citizen_b arm of the visibility check;
-- World B callers see it only via the citizen_a arm.
insert into
  public.partnerships (
    id,
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number
  )
values
  (
    'e6000000-0000-0000-0000-000000000003',
    'e5000000-0000-0000-0000-0000000000b3',
    'e5000000-0000-0000-0000-0000000000a3',
    'active',
    1
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
        public.partnerships
    ),
    0,
    'anon cannot read partnerships'
  );

reset role;

-- ===========================================================================
-- UNRELATED AUTHENTICATED USER: no read access into worlds they have no
-- citizen visibility in.
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
        public.partnerships
    ),
    0,
    'unrelated authenticated user cannot read any partnership'
  );

reset role;

-- ===========================================================================
-- WORLD A ADMIN (owner): sees partnerships whose citizen_a or citizen_b is in
-- World A. PA1 is fully in World A; PCross is visible via citizen_b in A.
-- The pure World B partnership PB1 stays hidden.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.partnerships
      where
        id = 'e6000000-0000-0000-0000-000000000001'
    ),
    'world A admin can read a partnership fully within their world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.partnerships
      where
        id = 'e6000000-0000-0000-0000-000000000003'
    ),
    'world A admin can read a cross-world partnership via the visible citizen_b participant'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.partnerships
      where
        id = 'e6000000-0000-0000-0000-000000000002'
    ),
    'world A admin cannot read a partnership entirely outside their world'
  );

reset role;

-- ===========================================================================
-- WORLD B ADMIN (owner): symmetric view from the other side. Sees PB1 (fully
-- in B) and PCross (via citizen_a in B), but not PA1.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.partnerships
      where
        id = 'e6000000-0000-0000-0000-000000000002'
    ),
    'world B admin can read a partnership fully within their world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.partnerships
      where
        id = 'e6000000-0000-0000-0000-000000000003'
    ),
    'world B admin can read a cross-world partnership via the visible citizen_a participant'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.partnerships
      where
        id = 'e6000000-0000-0000-0000-000000000001'
    ),
    'world B admin cannot read a partnership entirely outside their world'
  );

reset role;

-- ===========================================================================
-- PC HOLDER: holds a PC in World A and inherits citizen read visibility into
-- that world via user_has_player_character_in_world. Sees PA1 (both
-- participants in A) and PCross (citizen_b in A), not PB1.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.partnerships
      where
        id = 'e6000000-0000-0000-0000-000000000001'
    ),
    'PC holder reads a partnership in their world (mirrors citizen visibility)'
  );

select
  ok (
    exists (
      select
        1
      from
        public.partnerships
      where
        id = 'e6000000-0000-0000-0000-000000000003'
    ),
    'PC holder reads a cross-world partnership via the citizen participant they can see'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.partnerships
      where
        id = 'e6000000-0000-0000-0000-000000000002'
    ),
    'PC holder cannot read a partnership in a world where they hold no PC'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: cross-world visibility.
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
        public.partnerships
      where
        id in (
          'e6000000-0000-0000-0000-000000000001',
          'e6000000-0000-0000-0000-000000000002',
          'e6000000-0000-0000-0000-000000000003'
        )
    ),
    3,
    'super admin can read partnerships across worlds'
  );

reset role;

-- ===========================================================================
-- WRITES: non-admin authenticated users are denied via the table API.
-- An insert attempt fails the with-check; update/delete attempts on rows
-- the caller cannot see affect zero rows (the using clause filters them out).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.partnerships (
      citizen_a_id, citizen_b_id, formed_on_turn_number
    ) values (
      'e5000000-0000-0000-0000-0000000000a5',
      'e5000000-0000-0000-0000-0000000000a6',
      1
    )
  $test$,
    '42501',
    null,
    'non-admin authenticated user cannot insert partnerships'
  );

with
  affected as (
    update public.partnerships
    set
      change_reason = 'should not stick'
    where
      id = 'e6000000-0000-0000-0000-000000000001'
    returning
      1
  )
select
  is (
    (
      select
        count(*)::integer
      from
        affected
    ),
    0,
    'non-admin authenticated update on a non-visible partnership affects zero rows'
  );

with
  affected as (
    delete from public.partnerships
    where
      id = 'e6000000-0000-0000-0000-000000000001'
    returning
      1
  )
select
  is (
    (
      select
        count(*)::integer
      from
        affected
    ),
    0,
    'non-admin authenticated delete on a non-visible partnership affects zero rows'
  );

reset role;

-- ===========================================================================
-- WRITES: world admin (world A owner) can insert, update, and delete a
-- partnership in their world via the table API.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.partnerships (
      id, citizen_a_id, citizen_b_id, formed_on_turn_number
    ) values (
      'e6000000-0000-0000-0000-0000000000a5',
      'e5000000-0000-0000-0000-0000000000a5',
      'e5000000-0000-0000-0000-0000000000a6',
      2
    )
  $test$,
    'world admin can insert a partnership between citizens in their world'
  );

select
  lives_ok (
    $test$
    update public.partnerships
    set change_reason = 'admin clarification'
    where id = 'e6000000-0000-0000-0000-000000000001'
  $test$,
    'world admin can update a partnership in their world'
  );

select
  lives_ok (
    $test$
    delete from public.partnerships
    where id = 'e6000000-0000-0000-0000-0000000000a5'
  $test$,
    'world admin can delete a partnership in their world'
  );

reset role;

-- ===========================================================================
-- CONSTRAINTS: shape checks fire regardless of caller path. These inserts run
-- as the migration owner so they exercise table-level constraints rather than
-- RLS.
-- ===========================================================================
-- partnerships_distinct_citizens_check
select
  throws_ok (
    $test$
    insert into public.partnerships (
      citizen_a_id, citizen_b_id, formed_on_turn_number
    ) values (
      'e5000000-0000-0000-0000-0000000000a7',
      'e5000000-0000-0000-0000-0000000000a7',
      1
    )
  $test$,
    '23514',
    null,
    'self-pair partnership is rejected'
  );

-- partnerships_unique_active_citizen_a_idx: PA1 already pins A1 as
-- citizen_a_id with status='active'; a second active row reusing A1 there
-- collides on the partial unique index on citizen_a_id.
select
  throws_ok (
    $test$
    insert into public.partnerships (
      citizen_a_id, citizen_b_id, formed_on_turn_number
    ) values (
      'e5000000-0000-0000-0000-0000000000a1',
      'e5000000-0000-0000-0000-0000000000a7',
      2
    )
  $test$,
    '23505',
    null,
    'cannot create a second active partnership reusing the same citizen_a'
  );

-- partnerships_unique_active_citizen_b_idx: same idea on the b side, where A2
-- already occupies citizen_b_id in PA1.
select
  throws_ok (
    $test$
    insert into public.partnerships (
      citizen_a_id, citizen_b_id, formed_on_turn_number
    ) values (
      'e5000000-0000-0000-0000-0000000000a8',
      'e5000000-0000-0000-0000-0000000000a2',
      2
    )
  $test$,
    '23505',
    null,
    'cannot create a second active partnership reusing the same citizen_b'
  );

-- partnerships_ended_on_turn_number_check: status='active' rejects a non-null
-- ended_on_turn_number.
select
  throws_ok (
    $test$
    insert into public.partnerships (
      citizen_a_id, citizen_b_id, status, formed_on_turn_number, ended_on_turn_number
    ) values (
      'e5000000-0000-0000-0000-0000000000a7',
      'e5000000-0000-0000-0000-0000000000a8',
      'active',
      1,
      5
    )
  $test$,
    '23514',
    null,
    'active partnership must have null ended_on_turn_number'
  );

-- partnerships_ended_on_turn_number_check: terminal status requires
-- ended_on_turn_number to be set.
select
  throws_ok (
    $test$
    insert into public.partnerships (
      citizen_a_id, citizen_b_id, status, formed_on_turn_number, ended_on_turn_number
    ) values (
      'e5000000-0000-0000-0000-0000000000a7',
      'e5000000-0000-0000-0000-0000000000a8',
      'dissolved',
      1,
      null
    )
  $test$,
    '23514',
    null,
    'non-active partnership must have non-null ended_on_turn_number'
  );

select
  *
from
  finish ();

rollback;
