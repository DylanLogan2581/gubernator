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

-- Epic 5 fixture resets: restore citizen assignments and world 101 trade routes
-- to their seeded state so prior local mutations cannot flap these assertions.
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    job_id,
    construction_project_id,
    deposit_instance_id,
    managed_population_instance_id,
    trade_route_id,
    trade_route_end,
    assigned_on_turn_number
  )
values
  (
    '00000000-0000-0000-0000-000000000411',
    'standard_job',
    '00000000-0000-0000-0005-000000000101',
    null,
    null,
    null,
    null,
    null,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000421',
    'trade_route',
    null,
    null,
    null,
    null,
    '00000000-0000-0000-000e-000000000101',
    'origin',
    0
  ),
  (
    '00000000-0000-0000-0000-000000000414',
    'construction_project',
    null,
    '00000000-0000-0000-000b-000000000004',
    null,
    null,
    null,
    null,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000412',
    'husbandry',
    null,
    null,
    null,
    '00000000-0000-0000-000d-000000000002',
    null,
    null,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000413',
    'deposit',
    null,
    null,
    '00000000-0000-0000-000c-000000000003',
    null,
    null,
    null,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000415',
    'culling',
    null,
    null,
    null,
    '00000000-0000-0000-000d-000000000005',
    null,
    null,
    0
  )
on conflict (citizen_id) do update
set
  assignment_type = excluded.assignment_type,
  job_id = excluded.job_id,
  construction_project_id = excluded.construction_project_id,
  deposit_instance_id = excluded.deposit_instance_id,
  managed_population_instance_id = excluded.managed_population_instance_id,
  trade_route_id = excluded.trade_route_id,
  trade_route_end = excluded.trade_route_end,
  assigned_on_turn_number = excluded.assigned_on_turn_number,
  updated_at = now();

update public.trade_routes
set
  status = 'active',
  origin_approval_status = 'approved',
  destination_approval_status = 'approved',
  origin_approved_by_citizen_id = '00000000-0000-0000-0000-000000000411',
  destination_approved_by_citizen_id = '00000000-0000-0000-0000-000000000414',
  updated_at = now()
where
  id = '00000000-0000-0000-000e-000000000101';

update public.trade_routes
set
  status = 'proposed',
  origin_approval_status = 'pending',
  destination_approval_status = 'pending',
  origin_approved_by_citizen_id = null,
  destination_approved_by_citizen_id = null,
  updated_at = now()
where
  id = '00000000-0000-0000-000e-000000000102';

select
  plan (70);

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
-- Epic 2 turn-advancement assertions removed: the legacy
-- advance_world_turn_if_current RPC was dropped in §C35 (migration
-- 20260603000010). Turn advancement and readiness reset are now covered by
-- apply_turn_transition_advance_world_turn_test.sql.
-- ===========================================================================
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

-- ===========================================================================
-- Epic 4 settings pack assertions: every seeded world receives the same
-- canonical pack of non-system resources, jobs covering every job_type,
-- deposit types, managed population types, and building blueprints with at
-- least one populated tier each. Per-world counts use ≥ N so the pack can
-- grow without forcing this test to keep step.
-- ===========================================================================
select
  cmp_ok (
    (
      select
        min(c)::integer
      from
        (
          select
            count(*) filter (
              where
                not is_system_resource
            ) as c
          from
            public.resources
          where
            world_id in (
              '00000000-0000-0000-0000-000000000101',
              '00000000-0000-0000-0000-000000000102',
              '00000000-0000-0000-0000-000000000103',
              '00000000-0000-0000-0000-000000000104',
              '00000000-0000-0000-0000-000000000105'
            )
          group by
            world_id
        ) as per_world
    ),
    '>=',
    8,
    'every seeded world has at least eight non-system resources'
  );

select
  is (
    (
      select
        count(distinct world_id)::integer
      from
        public.job_definitions
      where
        world_id in (
          '00000000-0000-0000-0000-000000000101',
          '00000000-0000-0000-0000-000000000102',
          '00000000-0000-0000-0000-000000000103',
          '00000000-0000-0000-0000-000000000104',
          '00000000-0000-0000-0000-000000000105'
        )
        and world_id in (
          select
            world_id
          from
            public.job_definitions
          where
            job_type = 'standard'
          intersect
          select
            world_id
          from
            public.job_definitions
          where
            job_type = 'construction'
          intersect
          select
            world_id
          from
            public.job_definitions
          where
            job_type = 'deposit'
          intersect
          select
            world_id
          from
            public.job_definitions
          where
            job_type = 'husbandry'
          intersect
          select
            world_id
          from
            public.job_definitions
          where
            job_type = 'culling'
          intersect
          select
            world_id
          from
            public.job_definitions
          where
            job_type = 'trader'
        )
    ),
    5,
    'every seeded world has at least one job of every job_type'
  );

select
  cmp_ok (
    (
      select
        min(c)::integer
      from
        (
          select
            count(*) as c
          from
            public.building_blueprints
          where
            world_id in (
              '00000000-0000-0000-0000-000000000101',
              '00000000-0000-0000-0000-000000000102',
              '00000000-0000-0000-0000-000000000103',
              '00000000-0000-0000-0000-000000000104',
              '00000000-0000-0000-0000-000000000105'
            )
          group by
            world_id
        ) as per_world
    ),
    '>=',
    4,
    'every seeded world has at least four building blueprints'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.building_blueprints bb
      where
        bb.world_id in (
          '00000000-0000-0000-0000-000000000101',
          '00000000-0000-0000-0000-000000000102',
          '00000000-0000-0000-0000-000000000103',
          '00000000-0000-0000-0000-000000000104',
          '00000000-0000-0000-0000-000000000105'
        )
        and not exists (
          select
            1
          from
            public.building_blueprint_tiers bbt
          where
            bbt.building_blueprint_id = bb.id
        )
    ),
    0,
    'every seeded blueprint has at least one populated tier'
  );

select
  cmp_ok (
    (
      select
        min(c)::integer
      from
        (
          select
            count(*) as c
          from
            public.deposit_types
          where
            world_id in (
              '00000000-0000-0000-0000-000000000101',
              '00000000-0000-0000-0000-000000000102',
              '00000000-0000-0000-0000-000000000103',
              '00000000-0000-0000-0000-000000000104',
              '00000000-0000-0000-0000-000000000105'
            )
          group by
            world_id
        ) as per_world
    ),
    '>=',
    3,
    'every seeded world has at least three deposit types'
  );

select
  cmp_ok (
    (
      select
        min(c)::integer
      from
        (
          select
            count(*) as c
          from
            public.managed_population_types
          where
            world_id in (
              '00000000-0000-0000-0000-000000000101',
              '00000000-0000-0000-0000-000000000102',
              '00000000-0000-0000-0000-000000000103',
              '00000000-0000-0000-0000-000000000104',
              '00000000-0000-0000-0000-000000000105'
            )
          group by
            world_id
        ) as per_world
    ),
    '>=',
    3,
    'every seeded world has at least three managed population types'
  );

-- ===========================================================================
-- NPC flavor pool expansion: every seeded world's npc_flavor_config_json
-- carries the expanded pools required by the Epic 4 settings seed.
-- ===========================================================================
select
  cmp_ok (
    (
      select
        min(
          jsonb_array_length(npc_flavor_config_json -> 'traits')
        )::integer
      from
        public.worlds
      where
        id in (
          '00000000-0000-0000-0000-000000000101',
          '00000000-0000-0000-0000-000000000102',
          '00000000-0000-0000-0000-000000000103',
          '00000000-0000-0000-0000-000000000104',
          '00000000-0000-0000-0000-000000000105'
        )
    ),
    '>=',
    15,
    'every seeded world has at least 15 NPC flavor traits'
  );

select
  cmp_ok (
    (
      select
        min(
          jsonb_array_length(npc_flavor_config_json -> 'contradictions')
        )::integer
      from
        public.worlds
      where
        id in (
          '00000000-0000-0000-0000-000000000101',
          '00000000-0000-0000-0000-000000000102',
          '00000000-0000-0000-0000-000000000103',
          '00000000-0000-0000-0000-000000000104',
          '00000000-0000-0000-0000-000000000105'
        )
    ),
    '>=',
    8,
    'every seeded world has at least 8 NPC flavor contradictions'
  );

select
  cmp_ok (
    (
      select
        min(
          jsonb_array_length(npc_flavor_config_json -> 'goals')
        )::integer
      from
        public.worlds
      where
        id in (
          '00000000-0000-0000-0000-000000000101',
          '00000000-0000-0000-0000-000000000102',
          '00000000-0000-0000-0000-000000000103',
          '00000000-0000-0000-0000-000000000104',
          '00000000-0000-0000-0000-000000000105'
        )
    ),
    '>=',
    10,
    'every seeded world has at least 10 NPC flavor goals'
  );

select
  cmp_ok (
    (
      select
        min(
          jsonb_array_length(npc_flavor_config_json -> 'flaws')
        )::integer
      from
        public.worlds
      where
        id in (
          '00000000-0000-0000-0000-000000000101',
          '00000000-0000-0000-0000-000000000102',
          '00000000-0000-0000-0000-000000000103',
          '00000000-0000-0000-0000-000000000104',
          '00000000-0000-0000-0000-000000000105'
        )
    ),
    '>=',
    10,
    'every seeded world has at least 10 NPC flavor flaws'
  );

-- ===========================================================================
-- Epic 5 assertions: buildings, construction projects, deposits, managed
-- populations, stockpiles, trade routes, and citizen assignments.
-- All assertions target the five canonical settlements in Verdant Reach
-- (world 101) and the cross-world trade route coverage.
-- ===========================================================================
-- Citizen 415 seeded at Stonehold Keep (settlement 305).
select
  ok (
    exists (
      select
        1
      from
        public.citizens
      where
        id = '00000000-0000-0000-0000-000000000415'
        and settlement_id = '00000000-0000-0000-0000-000000000305'
        and world_id = '00000000-0000-0000-0000-000000000101'
        and citizen_type = 'npc'
    ),
    'Epic 5 seeds citizen 415 (Davin Stonehill) at Stonehold Keep'
  );

-- At least 1 active building per canonical settlement.
select
  cmp_ok (
    (
      select
        count(*)::integer
      from
        public.settlement_buildings
      where
        settlement_id = '00000000-0000-0000-0000-000000000301'
        and state = 'active'
    ),
    '>=',
    1,
    'Hearthwatch has at least 1 active seeded building'
  );

select
  is (
    (
      select
        count(distinct settlement_id)::integer
      from
        public.settlement_buildings
      where
        settlement_id in (
          '00000000-0000-0000-0000-000000000301',
          '00000000-0000-0000-0000-000000000302',
          '00000000-0000-0000-0000-000000000303',
          '00000000-0000-0000-0000-000000000304',
          '00000000-0000-0000-0000-000000000305'
        )
        and state = 'active'
    ),
    5,
    'all 5 canonical settlements each have at least 1 active building'
  );

-- Buildings cover all 3 effect types for Hearthwatch (3 distinct blueprints).
select
  is (
    (
      select
        count(distinct building_blueprint_id)::integer
      from
        public.settlement_buildings
      where
        settlement_id = '00000000-0000-0000-0000-000000000301'
        and state = 'active'
    ),
    3,
    'Hearthwatch buildings cover 3 distinct blueprints (job_capacity, storage, population_cap)'
  );

-- At least 1 in-progress construction project per canonical settlement.
select
  is (
    (
      select
        count(distinct settlement_id)::integer
      from
        public.construction_projects
      where
        settlement_id in (
          '00000000-0000-0000-0000-000000000301',
          '00000000-0000-0000-0000-000000000302',
          '00000000-0000-0000-0000-000000000303',
          '00000000-0000-0000-0000-000000000304',
          '00000000-0000-0000-0000-000000000305'
        )
        and status = 'in_progress'
    ),
    5,
    'each of the 5 canonical settlements has at least 1 in_progress construction project'
  );

select
  ok (
    exists (
      select
        1
      from
        public.construction_projects
      where
        id = '00000000-0000-0000-000b-000000000001'
        and settlement_id = '00000000-0000-0000-0000-000000000301'
        and status = 'in_progress'
    ),
    'Hearthwatch in-progress construction project is seeded with expected id'
  );

-- At least 1 active deposit instance per canonical settlement.
select
  is (
    (
      select
        count(distinct settlement_id)::integer
      from
        public.deposit_instances
      where
        settlement_id in (
          '00000000-0000-0000-0000-000000000301',
          '00000000-0000-0000-0000-000000000302',
          '00000000-0000-0000-0000-000000000303',
          '00000000-0000-0000-0000-000000000304',
          '00000000-0000-0000-0000-000000000305'
        )
        and status = 'active'
    ),
    5,
    'each of the 5 canonical settlements has at least 1 active deposit instance'
  );

-- Each deposit instance has at least 1 resource.
select
  cmp_ok (
    (
      select
        count(*)::integer
      from
        public.deposit_instance_resources
      where
        deposit_instance_id in (
          '00000000-0000-0000-000c-000000000001',
          '00000000-0000-0000-000c-000000000002',
          '00000000-0000-0000-000c-000000000003',
          '00000000-0000-0000-000c-000000000004',
          '00000000-0000-0000-000c-000000000005'
        )
    ),
    '>=',
    5,
    'each seeded deposit instance has at least 1 resource entry'
  );

-- At least 1 active managed population instance per canonical settlement.
select
  is (
    (
      select
        count(distinct settlement_id)::integer
      from
        public.managed_population_instances
      where
        settlement_id in (
          '00000000-0000-0000-0000-000000000301',
          '00000000-0000-0000-0000-000000000302',
          '00000000-0000-0000-0000-000000000303',
          '00000000-0000-0000-0000-000000000304',
          '00000000-0000-0000-0000-000000000305'
        )
        and status = 'active'
    ),
    5,
    'each of the 5 canonical settlements has at least 1 active managed population instance'
  );

-- Stockpiles: Food > 0 at Hearthwatch.
select
  cmp_ok (
    (
      select
        srs.quantity::numeric
      from
        public.settlement_resource_stockpiles srs
        join public.resources r on r.id = srs.resource_id
      where
        srs.settlement_id = '00000000-0000-0000-0000-000000000301'
        and r.slug = 'food'
        and r.is_system_resource = true
    ),
    '>',
    0::numeric,
    'Hearthwatch Food stockpile is non-zero'
  );

-- Stockpiles: Fresh Water > 0 at Hearthwatch.
select
  cmp_ok (
    (
      select
        srs.quantity::numeric
      from
        public.settlement_resource_stockpiles srs
        join public.resources r on r.id = srs.resource_id
      where
        srs.settlement_id = '00000000-0000-0000-0000-000000000301'
        and r.slug = 'fresh-water'
        and r.is_system_resource = true
    ),
    '>',
    0::numeric,
    'Hearthwatch Fresh Water stockpile is non-zero'
  );

-- Stockpiles: at least 3 non-system resources > 0 at Hearthwatch.
select
  cmp_ok (
    (
      select
        count(*)::integer
      from
        public.settlement_resource_stockpiles srs
        join public.resources r on r.id = srs.resource_id
      where
        srs.settlement_id = '00000000-0000-0000-0000-000000000301'
        and r.is_system_resource = false
        and srs.quantity > 0
    ),
    '>=',
    3,
    'Hearthwatch has at least 3 non-system resources with non-zero stockpile'
  );

-- Trade routes: active cross-nation route in world 101 (301 → 304).
select
  ok (
    exists (
      select
        1
      from
        public.trade_routes
      where
        id = '00000000-0000-0000-000e-000000000101'
        and origin_settlement_id = '00000000-0000-0000-0000-000000000301'
        and destination_settlement_id = '00000000-0000-0000-0000-000000000304'
        and status = 'active'
        and origin_approval_status = 'approved'
        and destination_approval_status = 'approved'
    ),
    'world 101 active trade route (Hearthwatch → Tidewatch) is seeded with status=active and both approvals'
  );

-- Trade routes: pending route in world 101 (303 → 305).
select
  ok (
    exists (
      select
        1
      from
        public.trade_routes
      where
        id = '00000000-0000-0000-000e-000000000102'
        and origin_settlement_id = '00000000-0000-0000-0000-000000000303'
        and destination_settlement_id = '00000000-0000-0000-0000-000000000305'
        and status = 'proposed'
        and origin_approval_status = 'pending'
        and destination_approval_status = 'pending'
    ),
    'world 101 pending trade route (Sunmere Hold → Stonehold Keep) is seeded with status=proposed'
  );

-- At least 5 active trade routes across all seeded worlds.
select
  cmp_ok (
    (
      select
        count(*)::integer
      from
        public.trade_routes
      where
        status = 'active'
    ),
    '>=',
    5,
    'at least 5 active trade routes are seeded across all worlds'
  );

-- Trade routes span all 5 seeded worlds.
select
  is (
    (
      select
        count(distinct n.world_id)::integer
      from
        public.trade_routes tr
        join public.settlements s on s.id = tr.origin_settlement_id
        join public.nations n on n.id = s.nation_id
    ),
    5,
    'seeded trade routes span all 5 seeded worlds'
  );

-- Citizen assignments: 1 standard_job in world 101 (411 Mara Quill; 412 now husbandry, 413 now deposit).
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
        join public.citizens c on c.id = ca.citizen_id
      where
        c.world_id = '00000000-0000-0000-0000-000000000101'
        and ca.assignment_type = 'standard_job'
    ),
    1,
    'world 101 has exactly 1 standard_job citizen assignment'
  );

-- All 6 assignment_type values are present in world 101.
select
  is (
    (
      select
        count(distinct ca.assignment_type)::integer
      from
        public.citizen_assignments ca
        join public.citizens c on c.id = ca.citizen_id
      where
        c.world_id = '00000000-0000-0000-0000-000000000101'
    ),
    6,
    'world 101 citizen assignments cover all 6 assignment_type values'
  );

-- Trade route assignment for Tessen Marrow has trade_route_end='origin'.
select
  ok (
    exists (
      select
        1
      from
        public.citizen_assignments
      where
        citizen_id = '00000000-0000-0000-0000-000000000421'
        and assignment_type = 'trade_route'
        and trade_route_end = 'origin'
        and trade_route_id = '00000000-0000-0000-000e-000000000101'
    ),
    'Tessen Marrow (421) has a trade_route assignment with trade_route_end=origin for the active route'
  );

-- Construction project assignment for Pell.
select
  ok (
    exists (
      select
        1
      from
        public.citizen_assignments
      where
        citizen_id = '00000000-0000-0000-0000-000000000414'
        and assignment_type = 'construction_project'
        and construction_project_id = '00000000-0000-0000-000b-000000000004'
    ),
    'Pell (414) has a construction_project assignment to the Tidewatch smithy project'
  );

-- Husbandry assignment for Joren Bask.
select
  ok (
    exists (
      select
        1
      from
        public.citizen_assignments
      where
        citizen_id = '00000000-0000-0000-0000-000000000412'
        and assignment_type = 'husbandry'
        and managed_population_instance_id = '00000000-0000-0000-000d-000000000002'
    ),
    'Joren Bask (412) has a husbandry assignment to the Mistfall sheep flock'
  );

-- Deposit assignment for Sable Wren.
select
  ok (
    exists (
      select
        1
      from
        public.citizen_assignments
      where
        citizen_id = '00000000-0000-0000-0000-000000000413'
        and assignment_type = 'deposit'
        and deposit_instance_id = '00000000-0000-0000-000c-000000000003'
    ),
    'Sable Wren (413) has a deposit assignment to the Sunmere stone quarry'
  );

-- Culling assignment for Davin.
select
  ok (
    exists (
      select
        1
      from
        public.citizen_assignments
      where
        citizen_id = '00000000-0000-0000-0000-000000000415'
        and assignment_type = 'culling'
        and managed_population_instance_id = '00000000-0000-0000-000d-000000000005'
    ),
    'Davin (415) has a culling assignment to the Stonehold pig drove'
  );

-- Managed population at Stonehold has configured_cull_quantity > 0.
select
  cmp_ok (
    (
      select
        configured_cull_quantity::numeric
      from
        public.managed_population_instances
      where
        id = '00000000-0000-0000-000d-000000000005'
    ),
    '>',
    0::numeric,
    'Stonehold pig drove has configured_cull_quantity > 0 (supports culling assignment)'
  );

-- Managed population at Mistfall is active sheep herd.
select
  ok (
    exists (
      select
        1
      from
        public.managed_population_instances
      where
        id = '00000000-0000-0000-000d-000000000002'
        and settlement_id = '00000000-0000-0000-0000-000000000302'
        and managed_population_type_id = '00000000-0000-0000-0009-000000000101'
        and status = 'active'
    ),
    'Mistfall managed population is an active sheep herd (pop_type offset 1)'
  );

select
  *
from
  finish ();

rollback;
