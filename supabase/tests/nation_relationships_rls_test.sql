-- pgTAP tests for public.nation_relationships RLS, mutation rules, and
-- constraints. Run with: npx supabase test db
--
-- Read visibility chains through nations: a relationship row is visible when
-- either participating nation is visible to the caller. Hidden nations stay
-- private to super admins, world admins of the nation's world, and users
-- whose player_character settlement belongs to the nation, so a relationship
-- between two hidden nations is invisible to a caller with only the
-- non-hidden + world-access path. A mixed pair (one hidden, one visible) is
-- visible via the non-hidden participant.
--
-- Writes via the table API are scoped to the originating side: super admin,
-- world admin of the from_nation's world, and the Nation Manager whose
-- player_character governs from_nation. A Nation Manager of nation X cannot
-- write a row whose from_nation_id is nation Y.
--
-- Constraints exercised:
--   • nation_relationships_distinct_nations_check: self-pair is rejected.
--   • nation_relationships_pending_stance_check: pending_stance is restricted
--     to the bilateral stances 'allied' and 'non_aggression_pact'.
begin;

select
  plan (22);

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
    'f1000000-0000-0000-0000-000000000001',
    'nationrels-owner@example.com',
    'x',
    now(),
    '{"username":"nationrels_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'nationrels-admin@example.com',
    'x',
    now(),
    '{"username":"nationrels_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000003',
    'nationrels-mgr-a@example.com',
    'x',
    now(),
    '{"username":"nationrels_mgr_a"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000004',
    'nationrels-mgr-b@example.com',
    'x',
    now(),
    '{"username":"nationrels_mgr_b"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000005',
    'nationrels-pc-holder@example.com',
    'x',
    now(),
    '{"username":"nationrels_pc_holder"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000006',
    'nationrels-outsider@example.com',
    'x',
    now(),
    '{"username":"nationrels_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000007',
    'nationrels-superadmin@example.com',
    'x',
    now(),
    '{"username":"nationrels_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'f1000000-0000-0000-0000-000000000007';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'Nation Relationships World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000002'
  );

-- Nation A and Nation B are visible to any world-access caller. Nation C and
-- Nation D are hidden, so they stay private to super admins, the world admin,
-- and any user whose player_character settlement belongs to that nation.
insert into
  public.nations (id, world_id, name, is_hidden)
values
  (
    'f3000000-0000-0000-0000-00000000000a',
    'f2000000-0000-0000-0000-000000000001',
    'Nation A',
    false
  ),
  (
    'f3000000-0000-0000-0000-00000000000b',
    'f2000000-0000-0000-0000-000000000001',
    'Nation B',
    false
  ),
  (
    'f3000000-0000-0000-0000-00000000000c',
    'f2000000-0000-0000-0000-000000000001',
    'Nation C (hidden)',
    true
  ),
  (
    'f3000000-0000-0000-0000-00000000000d',
    'f2000000-0000-0000-0000-000000000001',
    'Nation D (hidden)',
    true
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f4000000-0000-0000-0000-0000000000a1',
    'f3000000-0000-0000-0000-00000000000a',
    'Settlement A1'
  ),
  (
    'f4000000-0000-0000-0000-0000000000b1',
    'f3000000-0000-0000-0000-00000000000b',
    'Settlement B1'
  );

-- Nation A manager: PC sits in Settlement A1 with role_type=nation_manager
-- targeting Nation A. This satisfies both is_nation_manager_of(A) and
-- nation_visible_to_current_user(A) so the manager can read and write rows
-- whose from_nation_id is Nation A.
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
    'f5000000-0000-0000-0000-0000000000a1',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-0000000000a1',
    'player_character',
    'Nation A Manager PC',
    'alive',
    'f1000000-0000-0000-0000-000000000003',
    'nation_manager',
    'f3000000-0000-0000-0000-00000000000a'
  ),
  (
    'f5000000-0000-0000-0000-0000000000b1',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-0000000000b1',
    'player_character',
    'Nation B Manager PC',
    'alive',
    'f1000000-0000-0000-0000-000000000004',
    'nation_manager',
    'f3000000-0000-0000-0000-00000000000b'
  );

-- Plain PC holder: lives in Settlement A1 with no role. Sees Nations A and B
-- via the non-hidden + world-access arm but cannot see Nations C or D.
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
    'f5000000-0000-0000-0000-0000000000a2',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-0000000000a1',
    'player_character',
    'Plain PC Holder',
    'alive',
    'f1000000-0000-0000-0000-000000000005'
  );

-- Seed relationships covering visible/visible, hidden/hidden, and mixed pairs
-- so each visibility arm can be exercised independently.
insert into
  public.nation_relationships (id, from_nation_id, to_nation_id, current_stance)
values
  (
    'f6000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-00000000000a',
    'f3000000-0000-0000-0000-00000000000b',
    'friendly'
  ),
  (
    'f6000000-0000-0000-0000-000000000002',
    'f3000000-0000-0000-0000-00000000000c',
    'f3000000-0000-0000-0000-00000000000d',
    'hostile'
  ),
  (
    'f6000000-0000-0000-0000-000000000003',
    'f3000000-0000-0000-0000-00000000000a',
    'f3000000-0000-0000-0000-00000000000c',
    'neutral'
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
        public.nation_relationships
    ),
    0,
    'anon cannot read nation_relationships'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: no world access at all → cannot read any relationship.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_relationships
    ),
    0,
    'unrelated authenticated user cannot read any nation_relationships'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit world admin sees every relationship, including the
-- hidden/hidden pair that the manager and plain PC holder cannot see.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.nation_relationships
      where
        id = 'f6000000-0000-0000-0000-000000000001'
    ),
    'world admin can read the visible/visible relationship'
  );

select
  ok (
    exists (
      select
        1
      from
        public.nation_relationships
      where
        id = 'f6000000-0000-0000-0000-000000000002'
    ),
    'world admin can read the hidden/hidden relationship'
  );

reset role;

-- ===========================================================================
-- PLAIN PC HOLDER: PC lives in Settlement A1 (non-hidden nation). They have
-- world access, so the non-hidden + world-access arm admits any relationship
-- whose pair includes a non-hidden nation. The hidden/hidden pair stays
-- invisible because neither participant qualifies on that arm and they hold
-- no privileged path into Nations C or D.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.nation_relationships
      where
        id = 'f6000000-0000-0000-0000-000000000001'
    ),
    'plain PC holder reads the visible/visible relationship'
  );

select
  ok (
    exists (
      select
        1
      from
        public.nation_relationships
      where
        id = 'f6000000-0000-0000-0000-000000000003'
    ),
    'plain PC holder reads a mixed pair via the visible participant'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.nation_relationships
      where
        id = 'f6000000-0000-0000-0000-000000000002'
    ),
    'plain PC holder cannot read a hidden/hidden relationship'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: sees every relationship regardless of hidden flags.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_relationships
      where
        id in (
          'f6000000-0000-0000-0000-000000000001',
          'f6000000-0000-0000-0000-000000000002',
          'f6000000-0000-0000-0000-000000000003'
        )
    ),
    3,
    'super admin can read every nation_relationships row'
  );

reset role;

-- ===========================================================================
-- NATION A MANAGER WRITES: may write rows whose from_nation_id is Nation A
-- (the side their PC governs). Attempts where from_nation_id is Nation B are
-- denied: insert violates the WITH CHECK (42501), and update/delete on the
-- existing Nation B-originated row find no rows because the USING clause
-- filters them out.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.nation_relationships (
      id, from_nation_id, to_nation_id
    ) values (
      'f6000000-0000-0000-0000-0000000000a1',
      'f3000000-0000-0000-0000-00000000000a',
      'f3000000-0000-0000-0000-00000000000b'
    )
    on conflict (from_nation_id, to_nation_id) do nothing
  $test$,
    'nation A manager can insert a relationship originating from Nation A'
  );

select
  throws_ok (
    $test$
    insert into public.nation_relationships (
      from_nation_id, to_nation_id
    ) values (
      'f3000000-0000-0000-0000-00000000000b',
      'f3000000-0000-0000-0000-00000000000a'
    )
  $test$,
    '42501',
    null,
    'nation A manager cannot insert a relationship originating from Nation B'
  );

select
  lives_ok (
    $test$
    update public.nation_relationships
    set current_stance = 'friendly'
    where id = 'f6000000-0000-0000-0000-000000000001'
  $test$,
    'nation A manager can update a relationship originating from Nation A'
  );

-- Seed a Nation B-originated row so the manager's update/delete attempts have
-- something to target. This insert runs as the table owner (RLS bypassed).
reset role;

insert into
  public.nation_relationships (id, from_nation_id, to_nation_id, current_stance)
values
  (
    'f6000000-0000-0000-0000-0000000000b1',
    'f3000000-0000-0000-0000-00000000000b',
    'f3000000-0000-0000-0000-00000000000a',
    'neutral'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';

with
  affected as (
    update public.nation_relationships
    set
      current_stance = 'hostile'
    where
      id = 'f6000000-0000-0000-0000-0000000000b1'
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
    'nation A manager cannot update a relationship originating from Nation B'
  );

with
  affected as (
    delete from public.nation_relationships
    where
      id = 'f6000000-0000-0000-0000-0000000000b1'
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
    'nation A manager cannot delete a relationship originating from Nation B'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN WRITES: may write either side of the relationship pair. Insert,
-- update, and delete all succeed for a row originating from Nation B (the
-- side the world admin does not personally govern via a manager PC).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.nation_relationships (
      id, from_nation_id, to_nation_id
    ) values (
      'f6000000-0000-0000-0000-0000000000b2',
      'f3000000-0000-0000-0000-00000000000b',
      'f3000000-0000-0000-0000-00000000000c'
    )
  $test$,
    'world admin can insert a relationship originating from Nation B'
  );

select
  lives_ok (
    $test$
    update public.nation_relationships
    set current_stance = 'at_war'
    where id = 'f6000000-0000-0000-0000-0000000000b1'
  $test$,
    'world admin can update a relationship originating from Nation B'
  );

select
  lives_ok (
    $test$
    delete from public.nation_relationships
    where id = 'f6000000-0000-0000-0000-0000000000b1'
  $test$,
    'world admin can delete a relationship originating from Nation B'
  );

reset role;

-- ===========================================================================
-- OUTSIDER WRITES: insert violates the WITH CHECK, regardless of which side
-- they target.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.nation_relationships (
      from_nation_id, to_nation_id
    ) values (
      'f3000000-0000-0000-0000-00000000000a',
      'f3000000-0000-0000-0000-00000000000b'
    )
  $test$,
    '42501',
    null,
    'unrelated authenticated user cannot insert nation_relationships'
  );

reset role;

-- ===========================================================================
-- CONSTRAINTS: table-level shape checks run as the migration owner so RLS
-- does not mask them.
-- ===========================================================================
-- cross-world constraint: nations from different worlds must be rejected.
-- Insert a second world and one nation in it so we have a foreign nation to
-- target.
insert into
  public.worlds (id, name, visibility, status)
values
  (
    'f2000000-0000-0000-0000-000000000002',
    'Other World',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name, is_hidden)
values
  (
    'f3000000-0000-0000-0000-00000000000e',
    'f2000000-0000-0000-0000-000000000002',
    'Foreign Nation',
    false
  );

select
  throws_ok (
    $test$
    insert into public.nation_relationships (
      from_nation_id, to_nation_id
    ) values (
      'f3000000-0000-0000-0000-00000000000a',
      'f3000000-0000-0000-0000-00000000000e'
    )
  $test$,
    '23503',
    null,
    'cross-world nation_relationships pair is rejected'
  );

-- nation_relationships_distinct_nations_check
select
  throws_ok (
    $test$
    insert into public.nation_relationships (
      from_nation_id, to_nation_id
    ) values (
      'f3000000-0000-0000-0000-00000000000a',
      'f3000000-0000-0000-0000-00000000000a'
    )
  $test$,
    '23514',
    null,
    'self-referential nation_relationships pair is rejected'
  );

-- nation_relationships_pending_stance_check: only 'allied' and
-- 'non_aggression_pact' are accepted; the unilateral stances are rejected.
select
  throws_ok (
    $test$
    insert into public.nation_relationships (
      from_nation_id, to_nation_id, pending_stance, pending_status
    ) values (
      'f3000000-0000-0000-0000-00000000000c',
      'f3000000-0000-0000-0000-00000000000a',
      'friendly',
      'proposed'
    )
  $test$,
    '23514',
    null,
    'pending_stance rejects unilateral stance values'
  );

select
  lives_ok (
    $test$
    insert into public.nation_relationships (
      id, from_nation_id, to_nation_id, pending_stance, pending_status
    ) values (
      'f6000000-0000-0000-0000-0000000000c1',
      'f3000000-0000-0000-0000-00000000000c',
      'f3000000-0000-0000-0000-00000000000a',
      'allied',
      'proposed'
    )
  $test$,
    'pending_stance accepts the bilateral allied value'
  );

select
  lives_ok (
    $test$
    insert into public.nation_relationships (
      id, from_nation_id, to_nation_id, pending_stance, pending_status
    ) values (
      'f6000000-0000-0000-0000-0000000000d1',
      'f3000000-0000-0000-0000-00000000000d',
      'f3000000-0000-0000-0000-00000000000a',
      'non_aggression_pact',
      'proposed'
    )
  $test$,
    'pending_stance accepts the bilateral non_aggression_pact value'
  );

select
  *
from
  finish ();

rollback;
