-- pgTAP tests for #1076: apply_turn_transition clears nation readiness votes
-- and computed readiness for the departing turn, reports the counts, and
-- nation_readiness_summary() correctly exempts nations with no settlements.
-- Run with: npx supabase test db
--
-- UUID prefix map (all d6-prefixed ranges, unique to this file):
--   d6100000 = users        d6200000 = worlds
--   d6300000 = nations      d6400000 = settlements
--   d6500000 = citizens     d6600000 = turn_transitions
begin;

select
  plan (8);

-- ---------------------------------------------------------------------------
-- Fixtures: one world with a ready monarchy nation (has a settlement + a
-- ruler who voted true) and an empty monarchy nation (no settlements, no
-- ruler) that must never block or appear "ready".
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
    'd6100000-0000-0000-0000-000000000001',
    'gtaonr-ruler@example.com',
    'x',
    now(),
    '{"username":"gtaonr_ruler"}'::jsonb,
    now(),
    now()
  ),
  (
    'd6100000-0000-0000-0000-000000000002',
    'gtaonr-superadmin@example.com',
    'x',
    now(),
    '{"username":"gtaonr_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'd6100000-0000-0000-0000-000000000002';

insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'd6200000-0000-0000-0000-000000000001',
    'GTAONR World',
    6,
    'active'
  );

insert into
  public.nations (id, world_id, name, government_type)
values
  (
    'd6300000-0000-0000-0000-000000000001',
    'd6200000-0000-0000-0000-000000000001',
    'GTAONR Ready Monarchy',
    'monarchy'
  ),
  (
    'd6300000-0000-0000-0000-000000000002',
    'd6200000-0000-0000-0000-000000000001',
    'GTAONR Empty Monarchy',
    'monarchy'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd6400000-0000-0000-0000-000000000001',
    'd6300000-0000-0000-0000-000000000001',
    'GTAONR Settlement'
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
    role_nation_id
  )
values
  (
    'd6500000-0000-0000-0000-000000000001',
    'd6200000-0000-0000-0000-000000000001',
    'd6400000-0000-0000-0000-000000000001',
    'player_character',
    'GTAONR Ruler Citizen',
    'alive',
    'd6100000-0000-0000-0000-000000000001',
    'nation_manager',
    'd6300000-0000-0000-0000-000000000001'
  );

insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status
  )
values
  (
    'd6600000-0000-0000-0000-000000000001',
    'd6200000-0000-0000-0000-000000000001',
    6,
    7,
    'd6100000-0000-0000-0000-000000000001',
    'running'
  );

-- Ruler votes the ready nation ready for the current turn (6).
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d6100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  public.cast_nation_readiness_vote (
    'd6300000-0000-0000-0000-000000000001',
    'd6500000-0000-0000-0000-000000000001',
    true
  );

reset role;

-- ===========================================================================
-- Pre-advance: nation_readiness_summary reports readiness and exempt status
-- (as an authenticated super admin, since it checks current_user_has_world_access)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d6100000-0000-0000-0000-000000000002","role":"authenticated"}';

-- Test 1: ready nation reports is_ready=true, 1/1 votes, has_settlements=true
select
  is (
    (
      select
        row (
          is_ready,
          eligible_voter_count,
          true_vote_count,
          has_settlements
        )
      from
        public.nation_readiness_summary ('d6200000-0000-0000-0000-000000000001')
      where
        nation_id = 'd6300000-0000-0000-0000-000000000001'
    ),
    row (true, 1, 1, true),
    'ready nation reports is_ready, 1/1 eligible voters, has_settlements=true'
  );

-- Test 2: empty nation reports has_settlements=false and is never "ready"
select
  is (
    (
      select
        row (is_ready, eligible_voter_count, has_settlements)
      from
        public.nation_readiness_summary ('d6200000-0000-0000-0000-000000000001')
      where
        nation_id = 'd6300000-0000-0000-0000-000000000002'
    ),
    row (false, 0, false),
    'empty nation (no settlements, no ruler) reports has_settlements=false, 0 eligible voters'
  );

-- Test 3: readiness rows exist before the turn advances
select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_turn_readiness
      where
        nation_id = 'd6300000-0000-0000-0000-000000000001'
        and turn_number = 6
    ),
    1,
    'nation_turn_readiness row exists for turn 6 before advance'
  );

reset role;

-- ===========================================================================
-- Advance the turn via apply_turn_transition (service_role, as the edge
-- function does).
-- ===========================================================================
set
  local role service_role;

-- Test 4: patchCounts reports the nation readiness reset/clear counts
select
  is (
    (
      select
        row (
          result -> 'patchCounts' ->> 'nationReadinessReset',
          result -> 'patchCounts' ->> 'nationReadinessVotesCleared'
        )
      from
        (
          select
            public.apply_turn_transition (
              'd6200000-0000-0000-0000-000000000001',
              6,
              '{}'::jsonb,
              'd6600000-0000-0000-0000-000000000001'::uuid
            ) as result
        ) as
      call
    ),
    row ('1'::text, '1'::text),
    'patchCounts reports 1 nation readiness row and 1 vote row cleared'
  );

reset role;

-- Test 5: nation_turn_readiness row for the departed turn (6) is gone
select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_turn_readiness
      where
        nation_id = 'd6300000-0000-0000-0000-000000000001'
        and turn_number = 6
    ),
    0,
    'nation_turn_readiness row for turn 6 is cleared after advance'
  );

-- Test 6: nation_readiness_votes row for the departed turn (6) is gone
select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_readiness_votes
      where
        nation_id = 'd6300000-0000-0000-0000-000000000001'
        and turn_number = 6
    ),
    0,
    'nation_readiness_votes row for turn 6 is cleared after advance'
  );

-- Test 7: world advanced to turn 7
select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = 'd6200000-0000-0000-0000-000000000001'
    ),
    7,
    'world current_turn_number advances to 7'
  );

-- Test 8: nation_readiness_summary now reports the (previously ready) nation
-- as unready for the new turn (no votes cast yet) — next turn starts unready.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d6100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        is_ready
      from
        public.nation_readiness_summary ('d6200000-0000-0000-0000-000000000001')
      where
        nation_id = 'd6300000-0000-0000-0000-000000000001'
    ),
    false,
    'nation starts turn 7 unready with no readiness row carried over'
  );

reset role;

rollback;
