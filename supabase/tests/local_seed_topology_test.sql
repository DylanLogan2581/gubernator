-- pgTAP tests for the local Aldermoor seed topology.
-- Run with: npx supabase test db
--
-- The seed is a deterministic data dump of a single world (Aldermoor, world
-- 101) that was advanced 32 turns through the real end-turn simulation, so
-- these tests assert the static seeded state directly. All work runs inside a
-- transaction that is rolled back, so nothing here affects the live DB.
begin;

select
  plan (63);

-- ---------------------------------------------------------------------------
-- World
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        name
      from
        public.worlds
      where
        id = '00000000-0000-0000-0000-000000000101'
    ),
    'Aldermoor',
    'World 101 is Aldermoor'
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
    32,
    'Aldermoor is 32 turns in'
  );

select
  ok (
    (
      select
        public.is_valid_calendar_config (calendar_config_json)
      from
        public.worlds
      where
        id = '00000000-0000-0000-0000-000000000101'
    ),
    'Aldermoor has a valid calendar config'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.worlds
    ),
    1,
    'Exactly one seeded world'
  );

-- ---------------------------------------------------------------------------
-- Nations
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::int
      from
        public.nations
      where
        world_id = '00000000-0000-0000-0000-000000000101'
    ),
    3,
    'Three nations under Aldermoor'
  );

select
  is (
    (
      select
        name
      from
        public.nations
      where
        id = '00000000-0000-0000-0000-000000000201'
    ),
    'Kingdom of Brammel',
    'Nation 201 is the Kingdom of Brammel'
  );

select
  is (
    (
      select
        name
      from
        public.nations
      where
        id = '00000000-0000-0000-0000-000000000202'
    ),
    'Saltmarsh League of Caldhaven',
    'Nation 202 is the Saltmarsh League of Caldhaven'
  );

select
  is (
    (
      select
        name
      from
        public.nations
      where
        id = '00000000-0000-0000-0000-000000000203'
    ),
    'Highland Clans of Carrowmoor',
    'Nation 203 is the Highland Clans of Carrowmoor'
  );

-- ---------------------------------------------------------------------------
-- Settlements + readiness matrix
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::int
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = '00000000-0000-0000-0000-000000000101'
    ),
    6,
    'Six settlements across Aldermoor'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
    ),
    3,
    'Brammel holds three settlements'
  );

select
  is (
    (
      select
        name
      from
        public.settlements
      where
        id = '00000000-0000-0000-0000-000000000301'
    ),
    'Aldercross',
    'Settlement 301 is Aldercross'
  );

select
  ok (
    (
      select
        auto_ready_enabled = false
        and is_ready_current_turn = true
      from
        public.settlements
      where
        id = '00000000-0000-0000-0000-000000000301'
    ),
    'Aldercross is manually marked ready'
  );

select
  ok (
    (
      select
        auto_ready_enabled = true
        and is_ready_current_turn = true
      from
        public.settlements
      where
        id = '00000000-0000-0000-0000-000000000303'
    ),
    'Bramhollow is auto-ready'
  );

select
  ok (
    (
      select
        is_ready_current_turn = false
      from
        public.settlements
      where
        id = '00000000-0000-0000-0000-000000000302'
    ),
    'Wendlin is not ready this turn'
  );

-- ---------------------------------------------------------------------------
-- Namesets (NPC names are drawn from these)
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::int
      from
        public.namesets
      where
        world_id = '00000000-0000-0000-0000-000000000101'
    ),
    3,
    'Three culture namesets'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.namesets
      where
        world_id = '00000000-0000-0000-0000-000000000101'
        and is_default
    ),
    1,
    'Exactly one default nameset'
  );

select
  is (
    (
      select
        nameset_id
      from
        public.nations
      where
        id = '00000000-0000-0000-0000-000000000202'
    ),
    '00000000-0000-0000-0000-000000000702'::uuid,
    'Caldhaven is wired to the Saltmarsh Coast nameset'
  );

select
  ok (
    (
      select
        jsonb_array_length(config_json -> 'surnames') >= 10
      from
        public.namesets
      where
        id = '00000000-0000-0000-0000-000000000701'
    ),
    'The Aldermoor Vale nameset carries a populated surname pool'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.citizens
      where
        world_id = '00000000-0000-0000-0000-000000000101'
        and citizen_type = 'npc'
        and nameset_id is not null
    ) >= 200,
    'At least 200 NPCs are tied to a nameset'
  );

-- ---------------------------------------------------------------------------
-- Citizens
-- ---------------------------------------------------------------------------
select
  ok (
    (
      select
        count(*)
      from
        public.citizens
      where
        world_id = '00000000-0000-0000-0000-000000000101'
    ) >= 280,
    'Aldermoor has a large citizen population (>= 280)'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.citizens
      where
        world_id = '00000000-0000-0000-0000-000000000101'
        and citizen_type = 'player_character'
    ),
    3,
    'Exactly three player characters'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.citizens
      where
        world_id = '00000000-0000-0000-0000-000000000101'
        and citizen_type = 'npc'
    ) >= 250,
    'At least 250 NPCs'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.citizens
      where
        world_id = '00000000-0000-0000-0000-000000000101'
        and status = 'dead'
        and death_cause_category is not null
    ) >= 10,
    'At least ten dead citizens with a recorded death cause'
  );

select
  ok (
    (
      select
        status = 'dead'
        and death_cause is not null
        and death_cause_category = 'unknown'
      from
        public.citizens
      where
        id = '00000000-0000-0000-0000-000000000431'
    ),
    'The founder Wynflaed Quill (431) is dead with a recorded cause'
  );

select
  ok (
    (
      select
        count(distinct death_cause_category)
      from
        public.citizens
      where
        status = 'dead'
    ) >= 2,
    'Deaths span more than one cause category (starvation / homeless / unknown)'
  );

-- ---------------------------------------------------------------------------
-- Player characters: role wiring + user links
-- ---------------------------------------------------------------------------
select
  ok (
    (
      select
        role_type = 'settlement_manager'
        and role_settlement_id = '00000000-0000-0000-0000-000000000301'
        and user_id = '00000000-0000-0000-0000-000000000002'
      from
        public.citizens
      where
        id = '00000000-0000-0000-0000-000000000401'
    ),
    'PC 401 manages Aldercross for user 002'
  );

select
  ok (
    (
      select
        role_type = 'nation_manager'
        and role_nation_id = '00000000-0000-0000-0000-000000000201'
        and user_id = '00000000-0000-0000-0000-000000000003'
      from
        public.citizens
      where
        id = '00000000-0000-0000-0000-000000000402'
    ),
    'PC 402 manages the Kingdom of Brammel for user 003'
  );

select
  ok (
    (
      select
        role_type = 'none'
        and user_id = '00000000-0000-0000-0000-000000000001'
      from
        public.citizens
      where
        id = '00000000-0000-0000-0000-000000000403'
    ),
    'PC 403 is the unportfolioed super-admin character'
  );

-- ---------------------------------------------------------------------------
-- Economy catalogue
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::int
      from
        public.resources
      where
        world_id = '00000000-0000-0000-0000-000000000101'
    ),
    15,
    'Fifteen resources defined'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.resources
      where
        world_id = '00000000-0000-0000-0000-000000000101'
        and is_system_resource
    ),
    2,
    'Two system resources (Food, Fresh Water)'
  );

select
  ok (
    (
      select
        count(*) = 2
      from
        public.resources
      where
        world_id = '00000000-0000-0000-0000-000000000101'
        and slug in ('food', 'fresh-water')
        and is_system_resource
    ),
    'Food and Fresh Water are the system resources'
  );

select
  is (
    (
      select
        count(distinct job_type)::int
      from
        public.job_definitions
      where
        world_id = '00000000-0000-0000-0000-000000000101'
    ),
    6,
    'Jobs cover all six job types'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.job_definitions
      where
        world_id = '00000000-0000-0000-0000-000000000101'
    ) >= 15,
    'At least fifteen job definitions'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.job_definitions j
      where
        j.world_id = '00000000-0000-0000-0000-000000000101'
        and j.slug in ('field-hand', 'water-bearer')
        and j.job_type = 'standard'
    ) = 2,
    'Dedicated food and water producing jobs exist'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.deposit_types
      where
        world_id = '00000000-0000-0000-0000-000000000101'
    ),
    5,
    'Five deposit types'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.managed_population_types
      where
        world_id = '00000000-0000-0000-0000-000000000101'
    ),
    3,
    'Three managed population types'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.building_blueprints
      where
        world_id = '00000000-0000-0000-0000-000000000101'
    ) >= 6,
    'At least six building blueprints'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.building_blueprint_tiers t
        join public.building_blueprints b on b.id = t.building_blueprint_id
      where
        b.world_id = '00000000-0000-0000-0000-000000000101'
    ) >= 7,
    'Every blueprint has at least one tier (>= 7 tiers total)'
  );

-- ---------------------------------------------------------------------------
-- Self-sufficiency layer: every settlement is built up, mined, herded, stocked
-- and staffed.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::int
      from
        (
          select
            s.id
          from
            public.settlements s
            join public.nations n on n.id = s.nation_id
          where
            n.world_id = '00000000-0000-0000-0000-000000000101'
            and exists (
              select
                1
              from
                public.settlement_buildings b
              where
                b.settlement_id = s.id
                and b.state = 'active'
            )
        ) x
    ),
    6,
    'All six settlements have active buildings'
  );

select
  is (
    (
      select
        count(*)::int
      from
        (
          select
            s.id
          from
            public.settlements s
            join public.nations n on n.id = s.nation_id
          where
            n.world_id = '00000000-0000-0000-0000-000000000101'
            and exists (
              select
                1
              from
                public.deposit_instances d
              where
                d.settlement_id = s.id
                and d.status = 'active'
            )
        ) x
    ),
    6,
    'All six settlements have an active resource deposit'
  );

select
  is (
    (
      select
        count(*)::int
      from
        (
          select
            s.id
          from
            public.settlements s
            join public.nations n on n.id = s.nation_id
          where
            n.world_id = '00000000-0000-0000-0000-000000000101'
            and exists (
              select
                1
              from
                public.managed_population_instances m
              where
                m.settlement_id = s.id
                and m.status = 'active'
            )
        ) x
    ),
    6,
    'All six settlements have an active managed population'
  );

select
  is (
    (
      select
        count(*)::int
      from
        (
          select
            s.id
          from
            public.settlements s
            join public.nations n on n.id = s.nation_id
          where
            n.world_id = '00000000-0000-0000-0000-000000000101'
            and (
              select
                quantity
              from
                public.settlement_resource_stockpiles sp
                join public.resources r on r.id = sp.resource_id
              where
                sp.settlement_id = s.id
                and r.slug = 'food'
            ) > 0
            and (
              select
                quantity
              from
                public.settlement_resource_stockpiles sp
                join public.resources r on r.id = sp.resource_id
              where
                sp.settlement_id = s.id
                and r.slug = 'fresh-water'
            ) > 0
        ) x
    ),
    6,
    'Every settlement holds Food and Fresh Water stockpiles'
  );

select
  is (
    (
      select
        count(distinct assignment_type)::int
      from
        public.citizen_assignments a
        join public.citizens c on c.id = a.citizen_id
      where
        c.world_id = '00000000-0000-0000-0000-000000000101'
    ),
    6,
    'Citizen assignments cover all six assignment types'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.citizen_assignments a
        join public.citizens c on c.id = a.citizen_id
      where
        c.world_id = '00000000-0000-0000-0000-000000000101'
    ) >= 120,
    'Settlements are heavily staffed (>= 120 assignments)'
  );

-- ---------------------------------------------------------------------------
-- Multi-turn history (what the reporting / turn-history views read)
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::int
      from
        public.turn_transitions
      where
        world_id = '00000000-0000-0000-0000-000000000101'
        and status = 'completed'
    ),
    32,
    'Thirty-two completed turn transitions'
  );

select
  is (
    (
      select
        count(distinct settlement_id)::int
      from
        public.settlement_turn_snapshots sts
        join public.settlements s on s.id = sts.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = '00000000-0000-0000-0000-000000000101'
    ),
    6,
    'Every settlement has population snapshots'
  );

select
  ok (
    (
      select
        max(turn_number) - min(turn_number)
      from
        public.settlement_turn_snapshots sts
        join public.settlements s on s.id = sts.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = '00000000-0000-0000-0000-000000000101'
    ) >= 30,
    'Population snapshots span at least 30 turns'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.settlement_turn_resource_snapshots r
        join public.settlements s on s.id = r.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = '00000000-0000-0000-0000-000000000101'
    ) >= 1000,
    'Resource snapshots accumulate across the run (>= 1000 rows)'
  );

select
  ok (
    (
      select
        sum(birth_count)
      from
        public.settlement_turn_snapshots sts
        join public.settlements s on s.id = sts.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = '00000000-0000-0000-0000-000000000101'
    ) > 0,
    'Births occurred over the run'
  );

select
  ok (
    (
      select
        sum(death_count)
      from
        public.settlement_turn_snapshots sts
        join public.settlements s on s.id = sts.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = '00000000-0000-0000-0000-000000000101'
    ) > 0,
    'Deaths occurred over the run'
  );

select
  ok (
    (
      select
        max(population_total) <> min(population_total)
      from
        public.settlement_turn_snapshots sts
        join public.settlements s on s.id = sts.settlement_id
      where
        s.id = '00000000-0000-0000-0000-000000000301'
    ),
    'Aldercross population varies turn to turn'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.turn_log_entries
      where
        world_id = '00000000-0000-0000-0000-000000000101'
    ) >= 500,
    'The turn log is richly populated'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.notifications
    ) >= 100,
    'Notifications accumulated across the run'
  );

-- ---------------------------------------------------------------------------
-- Permissions / RLS helper wiring
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::int
      from
        public.world_admins
      where
        world_id = '00000000-0000-0000-0000-000000000101'
    ),
    3,
    'All three seeded users administer Aldermoor'
  );

select
  ok (
    (
      select
        is_super_admin
      from
        public.users
      where
        id = '00000000-0000-0000-0000-000000000001'
    ),
    'User 001 is the super admin'
  );

set
  local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    public.is_settlement_manager_of ('00000000-0000-0000-0000-000000000301'),
    'User 002 is recognised as settlement manager of Aldercross'
  );

select
  ok (
    not public.is_nation_manager_of ('00000000-0000-0000-0000-000000000201'),
    'User 002 is not a nation manager of Brammel'
  );

set
  local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    public.is_nation_manager_of ('00000000-0000-0000-0000-000000000201'),
    'User 003 is recognised as nation manager of Brammel'
  );

set
  local "request.jwt.claims" = '{}';

-- ---------------------------------------------------------------------------
-- Diplomacy + trade
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::int
      from
        public.nation_relationships
      where
        world_id = '00000000-0000-0000-0000-000000000101'
        and current_stance = 'allied'
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
    'Brammel and Carrowmoor are bilaterally allied'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.trade_routes t
        join public.settlements s on s.id = t.origin_settlement_id
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = '00000000-0000-0000-0000-000000000101'
        and t.status = 'active'
    ) >= 2,
    'At least two active trade routes'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.trade_routes t
        join public.settlements s on s.id = t.origin_settlement_id
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = '00000000-0000-0000-0000-000000000101'
        and t.status = 'proposed'
    ) >= 1,
    'At least one trade route is still under proposal'
  );

-- ---------------------------------------------------------------------------
-- Active player-character resume mappings
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
    'User 002 resumes as PC 401'
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
    'User 003 resumes as PC 402'
  );

select
  *
from
  finish ();

rollback;
