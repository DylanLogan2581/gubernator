-- pgTAP tests for public.nation_turn_readiness / public.nation_readiness_votes
-- and public.cast_nation_readiness_vote: one scenario per readiness mode
-- (ruler_only, settlement_managers_unanimous, office_majority,
-- office_unanimous), voter eligibility / caller-authority guards, and RLS.
-- Run with: npx supabase test db
begin;

select
  plan (11);

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
    '91000000-0000-0000-0000-000000000001',
    'readiness-admin@example.com',
    'x',
    now(),
    '{"username":"readiness_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    'readiness-ruler@example.com',
    'x',
    now(),
    '{"username":"readiness_ruler"}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000003',
    'readiness-sm1@example.com',
    'x',
    now(),
    '{"username":"readiness_sm1"}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000004',
    'readiness-rogue@example.com',
    'x',
    now(),
    '{"username":"readiness_rogue"}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000005',
    'readiness-outsider@example.com',
    'x',
    now(),
    '{"username":"readiness_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status)
values
  (
    '92000000-0000-0000-0000-000000000001',
    'Readiness World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name, government_type)
values
  (
    '93000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    'Ruler Nation',
    'monarchy'
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000001',
    'Confederation Nation',
    'confederation'
  ),
  (
    '93000000-0000-0000-0000-000000000003',
    '92000000-0000-0000-0000-000000000001',
    'Republic Nation',
    'republic'
  ),
  (
    '93000000-0000-0000-0000-000000000004',
    '92000000-0000-0000-0000-000000000001',
    'Tribal Nation',
    'tribal_council'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '94000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000002',
    'Confederation Settlement 1'
  ),
  (
    '94000000-0000-0000-0000-000000000002',
    '93000000-0000-0000-0000-000000000002',
    'Confederation Settlement 2'
  );

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
    '95000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    null,
    'player_character',
    'Ruler',
    'alive',
    '91000000-0000-0000-0000-000000000002',
    'nation_manager',
    '93000000-0000-0000-0000-000000000001',
    null
  ),
  (
    '95000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000001',
    'player_character',
    'Settlement Manager One',
    'alive',
    '91000000-0000-0000-0000-000000000003',
    'settlement_manager',
    null,
    '94000000-0000-0000-0000-000000000001'
  ),
  (
    '95000000-0000-0000-0000-000000000003',
    '92000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000002',
    'npc',
    'Settlement Manager Two',
    'alive',
    null,
    'settlement_manager',
    null,
    '94000000-0000-0000-0000-000000000002'
  ),
  (
    '95000000-0000-0000-0000-000000000004',
    '92000000-0000-0000-0000-000000000001',
    null,
    'player_character',
    'Rogue',
    'alive',
    '91000000-0000-0000-0000-000000000004',
    'none',
    null,
    null
  );

insert into
  public.user_active_player_characters (user_id, world_id, citizen_id)
values
  (
    '91000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000001'
  ),
  (
    '91000000-0000-0000-0000-000000000003',
    '92000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000002'
  ),
  (
    '91000000-0000-0000-0000-000000000004',
    '92000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000004'
  );

-- ===========================================================================
-- ruler_only (monarchy): ruler's own vote drives is_ready. Re-casting
-- updates the existing vote row rather than inserting a second one.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.cast_nation_readiness_vote (
    '93000000-0000-0000-0000-000000000001'::uuid,
    '95000000-0000-0000-0000-000000000001'::uuid,
    true
  );

reset role;

select
  is (
    (
      select
        is_ready
      from
        public.nation_turn_readiness
      where
        nation_id = '93000000-0000-0000-0000-000000000001'
    ),
    true,
    'ruler_only: ruler voting true marks the nation ready'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.cast_nation_readiness_vote (
    '93000000-0000-0000-0000-000000000001'::uuid,
    '95000000-0000-0000-0000-000000000001'::uuid,
    false
  );

reset role;

select
  is (
    (
      select
        is_ready
      from
        public.nation_turn_readiness
      where
        nation_id = '93000000-0000-0000-0000-000000000001'
    ),
    false,
    'ruler_only: ruler voting false marks the nation not ready'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_readiness_votes
      where
        nation_id = '93000000-0000-0000-0000-000000000001'
        and voter_citizen_id = '95000000-0000-0000-0000-000000000001'
    ),
    1,
    'ruler_only: re-casting a vote updates the row instead of inserting a second one'
  );

-- ===========================================================================
-- Authority guards: only the citizen's own active-PC user (or an admin) may
-- cast on its behalf; only an eligible voter may be voted as.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.cast_nation_readiness_vote(
      '93000000-0000-0000-0000-000000000001'::uuid,
      '95000000-0000-0000-0000-000000000001'::uuid,
      true
    )
  $test$,
    '42501',
    null,
    'a user cannot cast a vote as a citizen that is not their own active PC'
  );

select
  throws_ok (
    $test$
    select public.cast_nation_readiness_vote(
      '93000000-0000-0000-0000-000000000001'::uuid,
      '95000000-0000-0000-0000-000000000004'::uuid,
      true
    )
  $test$,
    '42501',
    'This citizen is not an eligible voter for this nation.',
    'a non-eligible citizen (not the ruler) is rejected in ruler_only mode'
  );

reset role;

-- ===========================================================================
-- settlement_managers_unanimous (confederation): ready only once every
-- settlement manager has voted true.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  public.cast_nation_readiness_vote (
    '93000000-0000-0000-0000-000000000002'::uuid,
    '95000000-0000-0000-0000-000000000002'::uuid,
    true
  );

reset role;

select
  is (
    (
      select
        is_ready
      from
        public.nation_turn_readiness
      where
        nation_id = '93000000-0000-0000-0000-000000000002'
    ),
    false,
    'settlement_managers_unanimous: one of two managers voting true is not yet ready'
  );

-- Admin casts on behalf of the NPC settlement manager of settlement 2.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  public.cast_nation_readiness_vote (
    '93000000-0000-0000-0000-000000000002'::uuid,
    '95000000-0000-0000-0000-000000000003'::uuid,
    true
  );

reset role;

select
  is (
    (
      select
        is_ready
      from
        public.nation_turn_readiness
      where
        nation_id = '93000000-0000-0000-0000-000000000002'
    ),
    true,
    'settlement_managers_unanimous: admin voting on behalf of the NPC manager completes unanimity'
  );

-- ===========================================================================
-- office_majority (republic) / office_unanimous (tribal_council): no offices
-- schema yet, so no citizen is an eligible voter and every cast is rejected.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.cast_nation_readiness_vote(
      '93000000-0000-0000-0000-000000000003'::uuid,
      '95000000-0000-0000-0000-000000000001'::uuid,
      true
    )
  $test$,
    '42501',
    'This citizen is not an eligible voter for this nation.',
    'office_majority (republic): no eligible voters exist until the offices schema lands'
  );

select
  throws_ok (
    $test$
    select public.cast_nation_readiness_vote(
      '93000000-0000-0000-0000-000000000004'::uuid,
      '95000000-0000-0000-0000-000000000001'::uuid,
      true
    )
  $test$,
    '42501',
    'This citizen is not an eligible voter for this nation.',
    'office_unanimous (tribal_council): no eligible voters exist until the offices schema lands'
  );

reset role;

-- ===========================================================================
-- RLS: SELECT is available to world members, denied to outsiders.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_turn_readiness
      where
        nation_id = '93000000-0000-0000-0000-000000000001'
    ),
    1,
    'a world member can select nation_turn_readiness rows'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_turn_readiness
      where
        nation_id = '93000000-0000-0000-0000-000000000001'
    ),
    0,
    'an outsider with no world access cannot select nation_turn_readiness rows'
  );

reset role;

select
  *
from
  finish ();

rollback;
