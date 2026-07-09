-- pgTAP tests for public.nation_discoveries: canonical pair constraint,
-- RPC authority (set_nations_met / set_nations_unmet), the nations_have_met
-- helper's symmetry, and RLS (world admin sees all, members see rows
-- involving a nation where they hold a player character).
-- Run with: npx supabase test db
begin;

select
  plan (18);

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
    'a1000000-0000-0000-0000-000000000001',
    'discoveries-admin@example.com',
    'x',
    now(),
    '{"username":"discoveries_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'discoveries-pc-a@example.com',
    'x',
    now(),
    '{"username":"discoveries_pc_a"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'discoveries-pc-c@example.com',
    'x',
    now(),
    '{"username":"discoveries_pc_c"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'discoveries-outsider@example.com',
    'x',
    now(),
    '{"username":"discoveries_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, current_turn_number)
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'Discovery World',
    'private',
    'active',
    7
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'a3000000-0000-0000-0000-00000000000a',
    'a2000000-0000-0000-0000-000000000001',
    'Nation A'
  ),
  (
    'a3000000-0000-0000-0000-00000000000b',
    'a2000000-0000-0000-0000-000000000001',
    'Nation B'
  ),
  (
    'a3000000-0000-0000-0000-00000000000c',
    'a2000000-0000-0000-0000-000000000001',
    'Nation C'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'a4000000-0000-0000-0000-0000000000a1',
    'a3000000-0000-0000-0000-00000000000a',
    'Settlement A1'
  ),
  (
    'a4000000-0000-0000-0000-0000000000c1',
    'a3000000-0000-0000-0000-00000000000c',
    'Settlement C1'
  );

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
    'a5000000-0000-0000-0000-0000000000a1',
    'a2000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-0000000000a1',
    'player_character',
    'Nation A PC',
    'alive',
    'a1000000-0000-0000-0000-000000000002'
  ),
  (
    'a5000000-0000-0000-0000-0000000000c1',
    'a2000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-0000000000c1',
    'player_character',
    'Nation C PC',
    'alive',
    'a1000000-0000-0000-0000-000000000003'
  );

-- ===========================================================================
-- CONSTRAINTS: run as the migration owner so RLS does not mask them.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.nation_discoveries (
      world_id, nation_a_id, nation_b_id, met_at_turn_number
    ) values (
      'a2000000-0000-0000-0000-000000000001',
      'a3000000-0000-0000-0000-00000000000b',
      'a3000000-0000-0000-0000-00000000000a',
      1
    )
  $test$,
    '23514',
    null,
    'non-canonical pair (a > b) is rejected'
  );

select
  lives_ok (
    $test$
    insert into public.nation_discoveries (
      id, world_id, nation_a_id, nation_b_id, met_at_turn_number
    ) values (
      'a6000000-0000-0000-0000-000000000001',
      'a2000000-0000-0000-0000-000000000001',
      'a3000000-0000-0000-0000-00000000000a',
      'a3000000-0000-0000-0000-00000000000b',
      1
    )
  $test$,
    'canonical pair (a < b) is accepted'
  );

select
  throws_ok (
    $test$
    insert into public.nation_discoveries (
      world_id, nation_a_id, nation_b_id, met_at_turn_number
    ) values (
      'a2000000-0000-0000-0000-000000000001',
      'a3000000-0000-0000-0000-00000000000a',
      'a3000000-0000-0000-0000-00000000000b',
      2
    )
  $test$,
    '23505',
    null,
    'duplicate pair is rejected by the unique constraint'
  );

delete from public.nation_discoveries
where
  id = 'a6000000-0000-0000-0000-000000000001';

-- ===========================================================================
-- AUTHORITY: non-admin cannot call set_nations_met / set_nations_unmet.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_nations_met(
      'a3000000-0000-0000-0000-00000000000a',
      'a3000000-0000-0000-0000-00000000000b'
    )
  $test$,
    '42501',
    null,
    'non-admin cannot call set_nations_met'
  );

reset role;

insert into
  public.nation_discoveries (
    id,
    world_id,
    nation_a_id,
    nation_b_id,
    met_at_turn_number
  )
values
  (
    'a6000000-0000-0000-0000-000000000002',
    'a2000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-00000000000a',
    'a3000000-0000-0000-0000-00000000000b',
    3
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_nations_unmet(
      'a3000000-0000-0000-0000-00000000000a',
      'a3000000-0000-0000-0000-00000000000b'
    )
  $test$,
    '42501',
    null,
    'non-admin cannot call set_nations_unmet'
  );

reset role;

delete from public.nation_discoveries
where
  id = 'a6000000-0000-0000-0000-000000000002';

-- ===========================================================================
-- AUTHORITY: world admin can call both RPCs; met_at_turn_number is recorded
-- from the world's current turn.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        met_at_turn_number
      from
        public.set_nations_met (
          'a3000000-0000-0000-0000-00000000000b',
          'a3000000-0000-0000-0000-00000000000a'
        )
    ),
    7,
    'world admin can call set_nations_met (args in either order) and turn number is recorded'
  );

select
  ok (
    exists (
      select
        1
      from
        public.nation_discoveries
      where
        nation_a_id = 'a3000000-0000-0000-0000-00000000000a'
        and nation_b_id = 'a3000000-0000-0000-0000-00000000000b'
    ),
    'set_nations_met persisted the canonical pair'
  );

select
  lives_ok (
    $test$
    select public.set_nations_unmet(
      'a3000000-0000-0000-0000-00000000000a',
      'a3000000-0000-0000-0000-00000000000b'
    )
  $test$,
    'world admin can call set_nations_unmet'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.nation_discoveries
      where
        nation_a_id = 'a3000000-0000-0000-0000-00000000000a'
        and nation_b_id = 'a3000000-0000-0000-0000-00000000000b'
    ),
    'set_nations_unmet removed the pair'
  );

reset role;

-- ===========================================================================
-- HELPER SYMMETRY: nations_have_met is order-independent and TRUE for the
-- same nation.
-- ===========================================================================
insert into
  public.nation_discoveries (
    id,
    world_id,
    nation_a_id,
    nation_b_id,
    met_at_turn_number
  )
values
  (
    'a6000000-0000-0000-0000-000000000003',
    'a2000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-00000000000a',
    'a3000000-0000-0000-0000-00000000000c',
    4
  );

select
  ok (
    public.nations_have_met (
      'a3000000-0000-0000-0000-00000000000a',
      'a3000000-0000-0000-0000-00000000000c'
    ),
    'nations_have_met is true for a stored pair'
  );

select
  ok (
    public.nations_have_met (
      'a3000000-0000-0000-0000-00000000000c',
      'a3000000-0000-0000-0000-00000000000a'
    ),
    'nations_have_met is symmetric regardless of argument order'
  );

select
  ok (
    public.nations_have_met (
      'a3000000-0000-0000-0000-00000000000a',
      'a3000000-0000-0000-0000-00000000000a'
    ),
    'nations_have_met is true for the same nation'
  );

select
  ok (
    not public.nations_have_met (
      'a3000000-0000-0000-0000-00000000000a',
      'a3000000-0000-0000-0000-00000000000b'
    ),
    'nations_have_met is false for a pair with no discovery row'
  );

-- ===========================================================================
-- #1143: nations_have_met / nation_world_id are SECURITY DEFINER oracle
-- helpers -- an authenticated caller with no access to Discovery World must
-- be denied, even for a real stored pair / real nation id.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  ok (
    not public.nations_have_met (
      'a3000000-0000-0000-0000-00000000000a',
      'a3000000-0000-0000-0000-00000000000c'
    ),
    'nations_have_met denies a caller with no world access, even for a stored pair'
  );

select
  ok (
    public.nation_world_id ('a3000000-0000-0000-0000-00000000000a') is null,
    'nation_world_id denies a caller with no world access to the nation''s world'
  );

reset role;

-- ===========================================================================
-- RLS: world admin sees every row; a PC holder sees rows involving their
-- nation but not unrelated pairs; an outsider sees nothing.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_discoveries
    ),
    1,
    'world admin sees every nation_discoveries row'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.nation_discoveries
      where
        id = 'a6000000-0000-0000-0000-000000000003'
    ),
    'PC holder in Nation A can read the A/C discovery row'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_discoveries
    ),
    0,
    'outsider with no PC in either nation reads no discovery rows'
  );

reset role;

select
  *
from
  finish ();

rollback;
