-- pgTAP tests for local Epic 2 + Epic 3 seed topology.
-- Run with: npx supabase test db
begin;

-- Reset fixture rows to their seed state so tests are repeatable regardless of
-- local DB mutations (e.g. turns already advanced via the app, partnerships
-- dissolved, relationships re-stanced, active PC changed). All changes are
-- rolled back at the end of this transaction and do not affect the live DB.
update public.worlds
set
  current_turn_number = 0
where
  id = '00000000-0000-0000-0000-000000000101';

update public.settlements
set
  auto_ready_enabled = false,
  is_ready_current_turn = true,
  last_ready_at = '2026-05-03 12:00:00+00',
  ready_set_at = '2026-05-03 12:00:00+00',
  ready_set_by_citizen_id = null
where
  id = '00000000-0000-0000-0000-000000000301';

update public.settlements
set
  auto_ready_enabled = false,
  is_ready_current_turn = false,
  last_ready_at = null,
  ready_set_at = null,
  ready_set_by_citizen_id = null
where
  id = '00000000-0000-0000-0000-000000000302';

update public.settlements
set
  auto_ready_enabled = true,
  is_ready_current_turn = false,
  last_ready_at = null,
  ready_set_at = null,
  ready_set_by_citizen_id = null
where
  id = '00000000-0000-0000-0000-000000000303';

-- Citizen role wiring: a local mutation could have flipped role_type / scope.
update public.citizens
set
  role_type = 'settlement_manager',
  role_nation_id = null,
  role_settlement_id = '00000000-0000-0000-0000-000000000301',
  status = 'alive'
where
  id = '00000000-0000-0000-0000-000000000401';

update public.citizens
set
  role_type = 'nation_manager',
  role_nation_id = '00000000-0000-0000-0000-000000000201',
  role_settlement_id = null,
  status = 'alive'
where
  id = '00000000-0000-0000-0000-000000000402';

update public.citizens
set
  role_type = 'none',
  role_nation_id = null,
  role_settlement_id = null,
  status = 'alive'
where
  id = '00000000-0000-0000-0000-000000000403';

-- Partnerships: reset the active and dissolved seed rows to their canonical
-- shape so prior local mutations (a partnership dissolved through the UI,
-- ended_on_turn_number advanced, etc.) cannot make these assertions flap.
update public.partnerships
set
  citizen_a_id = '00000000-0000-0000-0000-000000000411',
  citizen_b_id = '00000000-0000-0000-0000-000000000412',
  status = 'active',
  formed_on_turn_number = 0,
  ended_on_turn_number = null,
  changed_by_user_id = null,
  change_reason = null
where
  id = '00000000-0000-0000-0000-000000000501';

update public.partnerships
set
  citizen_a_id = '00000000-0000-0000-0000-000000000413',
  citizen_b_id = '00000000-0000-0000-0000-000000000414',
  status = 'dissolved',
  formed_on_turn_number = 0,
  ended_on_turn_number = 0,
  changed_by_user_id = '00000000-0000-0000-0000-000000000001',
  change_reason = 'Seeded historical dissolution so the partnership history panel has more than one row.'
where
  id = '00000000-0000-0000-0000-000000000502';

-- Nation relationships: reset both bilateral rows, the unilateral hostile, and
-- the pending proposal. The session-local mirror skip keeps the reset writes
-- from spawning extra symmetric rows.
select
  set_config('app.skip_bilateral_mirror', 'true', true);

update public.nation_relationships
set
  current_stance = 'allied',
  pending_stance = null,
  pending_status = 'accepted',
  pending_changed_by_citizen_id = '00000000-0000-0000-0000-000000000402'
where
  from_nation_id = '00000000-0000-0000-0000-000000000201'
  and to_nation_id = '00000000-0000-0000-0000-000000000203';

update public.nation_relationships
set
  current_stance = 'allied',
  pending_stance = null,
  pending_status = null,
  pending_changed_by_citizen_id = null
where
  from_nation_id = '00000000-0000-0000-0000-000000000203'
  and to_nation_id = '00000000-0000-0000-0000-000000000201';

update public.nation_relationships
set
  current_stance = 'hostile',
  pending_stance = null,
  pending_status = null,
  pending_changed_by_citizen_id = null
where
  from_nation_id = '00000000-0000-0000-0000-000000000201'
  and to_nation_id = '00000000-0000-0000-0000-000000000202';

update public.nation_relationships
set
  current_stance = 'neutral',
  pending_stance = 'non_aggression_pact',
  pending_status = 'proposed',
  pending_changed_by_citizen_id = '00000000-0000-0000-0000-000000000414'
where
  from_nation_id = '00000000-0000-0000-0000-000000000202'
  and to_nation_id = '00000000-0000-0000-0000-000000000203';

select
  set_config('app.skip_bilateral_mirror', 'false', true);

-- Active player character resume mapping reset.
update public.user_active_player_characters
set
  citizen_id = '00000000-0000-0000-0000-000000000401'
where
  user_id = '00000000-0000-0000-0000-000000000002'
  and world_id = '00000000-0000-0000-0000-000000000101';

update public.user_active_player_characters
set
  citizen_id = '00000000-0000-0000-0000-000000000402'
where
  user_id = '00000000-0000-0000-0000-000000000003'
  and world_id = '00000000-0000-0000-0000-000000000101';

select
  plan (40);

-- ===========================================================================
-- Existing Epic 2 assertions: world calendar, nation, settlement readiness.
-- ===========================================================================
select
  ok (
    exists (
      select
        1
      from
        public.worlds
      where
        id = '00000000-0000-0000-0000-000000000101'
        and public.is_valid_calendar_config (calendar_config_json)
    ),
    'local seed includes a valid world calendar config'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.nations
      where
        id = '00000000-0000-0000-0000-000000000201'
        and world_id = '00000000-0000-0000-0000-000000000101'
    ),
    1,
    'local seed includes the canonical nation under Verdant Reach'
  );

select
  cmp_ok (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
    ),
    '>=',
    3,
    'local seed includes the canonical settlements under the seeded nation'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
        and auto_ready_enabled = false
        and is_ready_current_turn = true
    ),
    1,
    'local seed includes a manually ready settlement'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
        and auto_ready_enabled = false
        and is_ready_current_turn = false
    ),
    1,
    'local seed includes a not-ready settlement'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
        and auto_ready_enabled = true
        and is_ready_current_turn = false
    ),
    1,
    'local seed includes an auto-ready settlement'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
        and (
          auto_ready_enabled
          or is_ready_current_turn
        )
    ),
    2,
    'local seed supports readiness summary ready counts'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
        and not (
          auto_ready_enabled
          or is_ready_current_turn
        )
    ),
    1,
    'local seed supports readiness summary not-ready counts'
  );

-- ===========================================================================
-- Epic 3 assertions: citizens, partnerships, relationships, active PCs.
-- ===========================================================================
-- World 101 — full topology.
select
  cmp_ok (
    (
      select
        count(*)::integer
      from
        public.citizens
      where
        world_id = '00000000-0000-0000-0000-000000000101'
    ),
    '>=',
    11,
    'world 101 seeds the canonical citizens plus the bulk expansion'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizens
      where
        world_id = '00000000-0000-0000-0000-000000000101'
        and citizen_type = 'player_character'
    ),
    3,
    'world 101 seeds exactly three player characters'
  );

select
  cmp_ok (
    (
      select
        count(*)::integer
      from
        public.citizens
      where
        world_id = '00000000-0000-0000-0000-000000000101'
        and citizen_type = 'npc'
    ),
    '>=',
    8,
    'world 101 seeds at least the canonical NPC roster'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizens
      where
        world_id = '00000000-0000-0000-0000-000000000101'
        and status = 'dead'
        and death_cause is not null
    ),
    1,
    'world 101 seeds a deceased NPC with a populated death_cause'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizens
      where
        id = '00000000-0000-0000-0000-000000000423'
        and parent_a_citizen_id = '00000000-0000-0000-0000-000000000421'
        and parent_b_citizen_id = '00000000-0000-0000-0000-000000000422'
    ),
    1,
    'world 101 seeds the NPC family child with both parent links populated'
  );

select
  ok (
    public.citizens_have_close_kinship (
      '00000000-0000-0000-0000-000000000421',
      '00000000-0000-0000-0000-000000000423',
      2
    ),
    'seeded NPC family parent/child pair is detected as close kin'
  );

-- Worlds 102 and 103 expanded topology — assert the canonical NPC still
-- exists and the world has at least one citizen, allowing the bulk expansion
-- to add more without flapping these tests.
select
  ok (
    exists (
      select
        1
      from
        public.citizens
      where
        id = '00000000-0000-0000-0000-000000000451'
        and world_id = '00000000-0000-0000-0000-000000000102'
    ),
    'world 102 still seeds the canonical Vellan Pace NPC'
  );

select
  ok (
    exists (
      select
        1
      from
        public.citizens
      where
        id = '00000000-0000-0000-0000-000000000461'
        and world_id = '00000000-0000-0000-0000-000000000103'
    ),
    'world 103 still seeds the canonical Ivor Greyfell NPC'
  );

select
  ok (
    (
      select
        npc_flavor_config_json <> public.default_npc_flavor_config ()
      from
        public.worlds
      where
        id = '00000000-0000-0000-0000-000000000102'
    ),
    'world 102 overrides the default NPC flavor pool config'
  );

select
  is (
    (
      select
        incest_prevention_depth
      from
        public.worlds
      where
        id = '00000000-0000-0000-0000-000000000103'
    ),
    1,
    'world 103 overrides incest_prevention_depth away from the default of 4'
  );

-- world_admins co-admin row distinct from the owner.
select
  ok (
    exists (
      select
        1
      from
        public.world_admins
      where
        world_id = '00000000-0000-0000-0000-000000000101'
        and user_id = '00000000-0000-0000-0000-000000000002'
    ),
    'world 101 has the aria_hearthwatch co-admin row in world_admins'
  );

-- ---------------------------------------------------------------------------
-- Manager role wiring exercised through is_settlement_manager_of /
-- is_nation_manager_of. The helpers read auth.uid(), so each block sets the
-- authenticated role + JWT claims before evaluating.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    public.is_settlement_manager_of ('00000000-0000-0000-0000-000000000301'),
    'aria_hearthwatch PC is settlement_manager of Hearthwatch'
  );

select
  ok (
    not public.is_nation_manager_of ('00000000-0000-0000-0000-000000000201'),
    'aria_hearthwatch PC is not nation_manager of Ashvale'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    public.is_nation_manager_of ('00000000-0000-0000-0000-000000000201'),
    'halden_reyne PC is nation_manager of Ashvale'
  );

select
  ok (
    not public.is_settlement_manager_of ('00000000-0000-0000-0000-000000000301'),
    'halden_reyne PC is not settlement_manager of Hearthwatch'
  );

reset role;

-- ---------------------------------------------------------------------------
-- Active player character resume mapping.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        citizen_id
      from
        public.user_active_player_characters
      where
        user_id = '00000000-0000-0000-0000-000000000002'
        and world_id = '00000000-0000-0000-0000-000000000101'
    ),
    '00000000-0000-0000-0000-000000000401'::uuid,
    'active PC for aria_hearthwatch resolves to the Hearthwatch PC'
  );

select
  is (
    (
      select
        citizen_id
      from
        public.user_active_player_characters
      where
        user_id = '00000000-0000-0000-0000-000000000003'
        and world_id = '00000000-0000-0000-0000-000000000101'
    ),
    '00000000-0000-0000-0000-000000000402'::uuid,
    'active PC for halden_reyne resolves to the Mistfall PC'
  );

-- ---------------------------------------------------------------------------
-- Partnerships: active row shape + dissolved row shape with audit fields.
-- ---------------------------------------------------------------------------
select
  ok (
    exists (
      select
        1
      from
        public.partnerships
      where
        id = '00000000-0000-0000-0000-000000000501'
        and citizen_a_id = '00000000-0000-0000-0000-000000000411'
        and citizen_b_id = '00000000-0000-0000-0000-000000000412'
        and status = 'active'
        and ended_on_turn_number is null
    ),
    'seeded active partnership has expected citizens, active status, and null ended_on_turn_number'
  );

select
  ok (
    exists (
      select
        1
      from
        public.partnerships
      where
        id = '00000000-0000-0000-0000-000000000502'
        and status = 'dissolved'
        and ended_on_turn_number is not null
        and changed_by_user_id is not null
        and change_reason is not null
        and char_length(btrim(change_reason)) > 0
    ),
    'seeded dissolved partnership has terminal status and populated audit columns'
  );

-- ---------------------------------------------------------------------------
-- Nation relationships: bilateral mirror, unilateral hostile, and pending
-- proposal.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_relationships
      where
        current_stance = 'allied'
        and (
          (
            from_nation_id = '00000000-0000-0000-0000-000000000201'
            and to_nation_id = '00000000-0000-0000-0000-000000000203'
          )
          or (
            from_nation_id = '00000000-0000-0000-0000-000000000203'
            and to_nation_id = '00000000-0000-0000-0000-000000000201'
          )
        )
    ),
    2,
    'seeded bilateral allied pair has both directional rows present'
  );

select
  is (
    (
      select
        count(distinct current_stance)::integer
      from
        public.nation_relationships
      where
        (
          from_nation_id = '00000000-0000-0000-0000-000000000201'
          and to_nation_id = '00000000-0000-0000-0000-000000000203'
        )
        or (
          from_nation_id = '00000000-0000-0000-0000-000000000203'
          and to_nation_id = '00000000-0000-0000-0000-000000000201'
        )
    ),
    1,
    'seeded bilateral allied pair has a single shared current_stance value'
  );

select
  ok (
    exists (
      select
        1
      from
        public.nation_relationships
      where
        from_nation_id = '00000000-0000-0000-0000-000000000201'
        and to_nation_id = '00000000-0000-0000-0000-000000000203'
        and current_stance = 'allied'
        and pending_status = 'accepted'
        and pending_changed_by_citizen_id is not null
    ),
    'proposer row of the bilateral allied pair carries pending_status=accepted and a proposer citizen'
  );

select
  ok (
    exists (
      select
        1
      from
        public.nation_relationships
      where
        from_nation_id = '00000000-0000-0000-0000-000000000201'
        and to_nation_id = '00000000-0000-0000-0000-000000000202'
        and current_stance = 'hostile'
        and pending_stance is null
        and pending_status is null
    ),
    'seeded unilateral hostile row Ashvale -> Tideholm has hostile stance and no pending proposal'
  );

select
  ok (
    exists (
      select
        1
      from
        public.nation_relationships
      where
        from_nation_id = '00000000-0000-0000-0000-000000000202'
        and to_nation_id = '00000000-0000-0000-0000-000000000203'
        and current_stance = 'neutral'
        and pending_stance = 'non_aggression_pact'
        and pending_status = 'proposed'
    ),
    'seeded pending non_aggression_pact proposal Tideholm -> Stoneridge is in proposed state'
  );

-- ===========================================================================
-- Existing Epic 2 turn-advancement assertions.
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.advance_world_turn_if_current (
          '00000000-0000-0000-0000-000000000101',
          0,
          '00000000-0000-0000-0000-000000000001'
        )
    ),
    1,
    'seeded world can be advanced through the privileged RPC by its admin'
  );

select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = '00000000-0000-0000-0000-000000000101'
    ),
    1,
    'seeded world advances exactly one turn'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
        and auto_ready_enabled = false
        and is_ready_current_turn = false
        and ready_set_at is null
    ),
    2,
    'end-turn reset clears manual readiness for seeded settlements'
  );

select
  ok (
    exists (
      select
        1
      from
        public.settlements
      where
        id = '00000000-0000-0000-0000-000000000301'
        and is_ready_current_turn = false
        and ready_set_at is null
        and last_ready_at = '2026-05-03 12:00:00+00'::timestamptz
    ),
    'end-turn reset preserves seeded manual readiness history'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
        and auto_ready_enabled = true
        and is_ready_current_turn = true
        and ready_set_at is null
    ),
    1,
    'end-turn reset reapplies auto-readiness for seeded settlements'
  );

-- ===========================================================================
-- Epic 4 resource seeding assertions: every seeded world must have Food and
-- Fresh Water seeded as system resources by the worlds_seed_system_resources
-- trigger that fires on each world INSERT.
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.resources
      where
        world_id = '00000000-0000-0000-0000-000000000101'
        and is_system_resource = true
    ),
    2,
    'world 101 has exactly two system resources (Food and Fresh Water)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.resources
      where
        world_id = '00000000-0000-0000-0000-000000000102'
        and is_system_resource = true
    ),
    2,
    'world 102 has exactly two system resources (Food and Fresh Water)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.resources
      where
        world_id = '00000000-0000-0000-0000-000000000103'
        and is_system_resource = true
    ),
    2,
    'world 103 has exactly two system resources (Food and Fresh Water)'
  );

select
  *
from
  finish ();

rollback;
