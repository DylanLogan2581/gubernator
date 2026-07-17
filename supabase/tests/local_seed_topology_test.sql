-- pgTAP tests for the local Bovold Seed World topology.
-- Run with: npx supabase test db
--
-- The seed is a deterministic data dump of a single Akaviri world (Bovold Seed
-- World) that was advanced 32 turns through the real end-turn simulation, so
-- these tests assert the static seeded state directly. Everything resolves by
-- name/role rather than by UUID (the builder generates deterministic real
-- UUIDs). All work runs inside a transaction that is rolled back.
begin;

select
  plan (86);

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
        name = 'Bovold Seed World'
    ),
    'Bovold Seed World',
    'The seeded world is named Bovold Seed World'
  );

select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        name = 'Bovold Seed World'
    ),
    32,
    'The world sits at turn 32 after the simulated history'
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

select
  ok (
    (
      select
        public.is_valid_calendar_config (calendar_config_json)
      from
        public.worlds
      where
        name = 'Bovold Seed World'
    ),
    'The world has a valid calendar config'
  );

-- ---------------------------------------------------------------------------
-- Nations (4) — the neutral human city plus three Akaviri beast-nations
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::int
      from
        public.nations
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    4,
    'Four nations'
  );

select
  ok (
    (
      select
        exists (
          select
            1
          from
            public.nations
          where
            name = 'Free City of Bovold'
        )
    ),
    'Free City of Bovold exists'
  );

select
  ok (
    (
      select
        exists (
          select
            1
          from
            public.nations
          where
            name = 'Tsaesciland Empire'
        )
    ),
    'Tsaesciland Empire exists'
  );

select
  ok (
    (
      select
        exists (
          select
            1
          from
            public.nations
          where
            name = 'Thousand Monkey Islands'
        )
    ),
    'Thousand Monkey Islands exists'
  );

select
  ok (
    (
      select
        exists (
          select
            1
          from
            public.nations
          where
            name = 'Ka''Po''Tun Confederacy'
        )
    ),
    'Ka''Po''Tun Confederacy exists'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.nations
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and primary_culture_id is not null
    ),
    4,
    'Every nation is wired to a primary culture'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.nations
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and state_religion_id is not null
    ),
    4,
    'Every nation is wired to a state religion'
  );

-- ---------------------------------------------------------------------------
-- Settlements (36)
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
        n.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    36,
    '36 settlements across the four nations'
  );

select
  ok (
    (
      select
        not auto_ready_enabled
        and is_ready_current_turn
      from
        public.settlements
      where
        name = 'City of Bovold'
    ),
    'City of Bovold is manually ready this turn'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.settlements
      where
        nation_id = (
          select
            id
          from
            public.nations
          where
            name = 'Tsaesciland Empire'
        )
    ),
    9,
    'Tsaesciland Empire holds 9 settlements'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.settlements
      where
        nation_id = (
          select
            id
          from
            public.nations
          where
            name = 'Thousand Monkey Islands'
        )
    ),
    18,
    'The Thousand Monkey Islands hold 18 settlements'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.settlements
      where
        nation_id = (
          select
            id
          from
            public.nations
          where
            name = 'Ka''Po''Tun Confederacy'
        )
    ),
    8,
    'The Ka''Po''Tun Confederacy holds 8 settlements'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.settlements
      where
        nation_id = (
          select
            id
          from
            public.nations
          where
            name = 'Free City of Bovold'
        )
    ),
    1,
    'The Free City of Bovold is a single city'
  );

-- ---------------------------------------------------------------------------
-- Cultures & religions
-- ---------------------------------------------------------------------------
select
  ok (
    (
      select
        count(*)
      from
        public.cultures
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 4,
    'At least four cultures'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.religions
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 4,
    'At least four religions'
  );

select
  ok (
    (
      select
        exists (
          select
            1
          from
            public.cultures
          where
            name = 'Tsaesci Serpent-Court'
        )
    ),
    'The Tsaesci Serpent-Court culture is seeded with lore'
  );

select
  ok (
    (
      select
        exists (
          select
            1
          from
            public.religions
          where
            name = 'The Ouroboros Communion'
        )
    ),
    'The Ouroboros Communion religion is seeded with lore'
  );

select
  ok (
    (
      select
        origins is not null
        and taboos is not null
        and funerary_customs is not null
      from
        public.cultures
      where
        name = 'Tsaesci Serpent-Court'
    ),
    'Cultures carry filled lore fields'
  );

-- ---------------------------------------------------------------------------
-- Citizens & player characters
-- ---------------------------------------------------------------------------
select
  ok (
    (
      select
        count(*)
      from
        public.citizens
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and status = 'alive'
    ) >= 3000,
    'At least 3000 living citizens'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.citizens
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and citizen_type = 'player_character'
    ),
    4,
    'Exactly four player characters'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.citizens c
        join public.settlements s on s.id = c.settlement_id
      where
        c.citizen_type = 'player_character'
        and s.name = 'City of Bovold'
    ),
    4,
    'All four player characters live in the City of Bovold'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.citizens
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and status = 'dead'
        and death_cause_category is not null
    ) >= 100,
    'At least 100 dead citizens carry a recorded cause of death'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.citizens
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and culture_id is not null
    ) >= 3000,
    'Citizens inherited a culture'
  );

-- ---------------------------------------------------------------------------
-- Player-character role wiring
-- ---------------------------------------------------------------------------
select
  ok (
    (
      select
        role_type = 'settlement_manager'
        and role_settlement_id = (
          select
            id
          from
            public.settlements
          where
            name = 'City of Bovold'
        )
      from
        public.citizens
      where
        user_id = '00000000-0000-0000-0000-000000000002'
        and world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    'User 002 plays the settlement manager of the City of Bovold'
  );

select
  ok (
    (
      select
        role_type = 'nation_manager'
        and role_nation_id = (
          select
            id
          from
            public.nations
          where
            name = 'Free City of Bovold'
        )
      from
        public.citizens
      where
        user_id = '00000000-0000-0000-0000-000000000003'
        and world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    'User 003 plays the nation manager of the Free City of Bovold'
  );

-- ---------------------------------------------------------------------------
-- Government: offices & bodies
-- ---------------------------------------------------------------------------
select
  ok (
    (
      select
        count(*)
      from
        public.office_types
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and nation_id is not null
    ) >= 9,
    'At least nine nation-defined office types'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.nation_offices
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 8,
    'Offices are filled across the nations'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.government_bodies
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    4,
    'One government body per nation'
  );

select
  ok (
    (
      select
        count(distinct coalesce(o.nation_id, s.nation_id))
      from
        public.nation_offices o
        left join public.settlements s on s.id = o.settlement_id
      where
        o.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) = 4,
    'All four nations retain at least one office-holder'
  );

-- ---------------------------------------------------------------------------
-- Law & decrees
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::int
      from
        public.law_documents
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    4,
    'One law document (charter) per nation'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.law_articles a
        join public.law_documents d on d.id = a.document_id
      where
        d.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 8,
    'Charters carry articles'
  );

select
  ok (
    (
      select
        exists (
          select
            1
          from
            public.law_document_versions v
            join public.law_documents d on d.id = v.document_id
          where
            d.world_id = (
              select
                id
              from
                public.worlds
              where
                name = 'Bovold Seed World'
            )
        )
    ),
    'At least one enacted charter version snapshot'
  );

select
  ok (
    (
      select
        exists (
          select
            1
          from
            public.law_amendments a
            join public.law_documents d on d.id = a.document_id
          where
            d.world_id = (
              select
                id
              from
                public.worlds
              where
                name = 'Bovold Seed World'
            )
            and a.status = 'passed'
        )
    ),
    'A passed law amendment exists'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.law_amendment_votes v
        join public.law_amendments a on a.id = v.amendment_id
        join public.law_documents d on d.id = a.document_id
      where
        d.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 3,
    'The passed amendment was voted on'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.decrees
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 4,
    'At least four issued decrees'
  );

-- ---------------------------------------------------------------------------
-- Military
-- ---------------------------------------------------------------------------
select
  ok (
    (
      select
        count(*)
      from
        public.unit_types
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 4,
    'At least four unit types'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.armies
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    4,
    'One army per nation'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.unit_soldiers
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) > 0,
    'Armies are manned by real citizen-soldiers'
  );

select
  ok (
    (
      select
        count(distinct nation_id)
      from
        public.armies
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) = 4,
    'Every nation fields an army'
  );

-- ---------------------------------------------------------------------------
-- Education
-- ---------------------------------------------------------------------------
select
  ok (
    (
      select
        count(*)
      from
        public.education_levels
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 4,
    'A world education ladder of at least four ranks'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.citizens
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and education_level_id is not null
    ) > 0,
    'Some citizens carry an education level'
  );

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
select
  ok (
    (
      select
        count(*)
      from
        public.events
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 4,
    'At least four seeded events'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.event_groups
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 4,
    'Events are organised into groups'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.event_effects e
        join public.events ev on ev.id = e.event_id
      where
        ev.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 4,
    'Events carry structured effects'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.citizen_memories
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 1,
    'The Long Feast left citizen memories'
  );

-- ---------------------------------------------------------------------------
-- Economy self-sufficiency
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
        n.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and not exists (
          select
            1
          from
            public.settlement_resource_stockpiles sp
            join public.resources r on r.id = sp.resource_id
          where
            sp.settlement_id = s.id
            and r.slug = 'food'
            and sp.quantity > 0
        )
    ),
    0,
    'Every settlement holds a positive food stockpile'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and not exists (
          select
            1
          from
            public.settlement_resource_stockpiles sp
            join public.resources r on r.id = sp.resource_id
          where
            sp.settlement_id = s.id
            and r.slug = 'fresh-water'
            and sp.quantity > 0
        )
    ),
    0,
    'Every settlement holds a positive fresh-water stockpile'
  );

select
  ok (
    (
      select
        count(distinct assignment_type)
      from
        public.citizen_assignments a
        join public.citizens c on c.id = a.citizen_id
      where
        c.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 6,
    'All six assignment types are staffed'
  );

-- ---------------------------------------------------------------------------
-- Turn history
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::int
      from
        public.turn_transitions
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    32,
    '32 completed turn transitions'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.settlement_turn_snapshots st
        join public.settlements s on s.id = st.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 500,
    'Per-settlement turn snapshots span the run'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.turn_log_entries
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 500,
    'The run produced a rich turn log'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.notifications
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 100,
    'The run produced player notifications'
  );

-- ---------------------------------------------------------------------------
-- Diplomacy & treaties
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::int
      from
        public.nation_relationships r
      where
        r.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and r.current_stance = 'at_war'
        and r.from_nation_id in (
          select
            id
          from
            public.nations
          where
            name in ('Tsaesciland Empire', 'Ka''Po''Tun Confederacy')
        )
        and r.to_nation_id in (
          select
            id
          from
            public.nations
          where
            name in ('Tsaesciland Empire', 'Ka''Po''Tun Confederacy')
        )
    ),
    2,
    'The serpents and the tiger-folk are at war (both directions)'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.nation_relationships r
      where
        r.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and r.current_stance = 'allied'
        and r.from_nation_id in (
          select
            id
          from
            public.nations
          where
            name in (
              'Ka''Po''Tun Confederacy',
              'Thousand Monkey Islands'
            )
        )
        and r.to_nation_id in (
          select
            id
          from
            public.nations
          where
            name in (
              'Ka''Po''Tun Confederacy',
              'Thousand Monkey Islands'
            )
        )
    ),
    2,
    'The tiger-folk and the monkey-isles are allied (both directions)'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.nation_relationships r
      where
        r.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and (
          r.from_nation_id = (
            select
              id
            from
              public.nations
            where
              name = 'Free City of Bovold'
          )
          or r.to_nation_id = (
            select
              id
            from
              public.nations
            where
              name = 'Free City of Bovold'
          )
        )
        and r.current_stance <> 'neutral'
    ),
    0,
    'The Free City of Bovold is neutral toward everyone'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.nation_treaties
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 3,
    'At least three treaties (the neutral trade hub)'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.nation_discoveries
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    6,
    'All four nations have discovered each other (6 pairs)'
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
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    1,
    'Exactly one dedicated world admin administers Bovold'
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
    public.is_settlement_manager_of (
      (
        select
          id
        from
          public.settlements
        where
          name = 'City of Bovold'
      )
    ),
    'User 002 is recognised as settlement manager of the City of Bovold'
  );

select
  ok (
    not public.is_nation_manager_of (
      (
        select
          id
        from
          public.nations
        where
          name = 'Free City of Bovold'
      )
    ),
    'User 002 is not a nation manager'
  );

set
  local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    public.is_nation_manager_of (
      (
        select
          id
        from
          public.nations
        where
          name = 'Free City of Bovold'
      )
    ),
    'User 003 is recognised as nation manager of the Free City of Bovold'
  );

set
  local "request.jwt.claims" = '{}';

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
        and world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    (
      select
        id
      from
        public.citizens
      where
        user_id = '00000000-0000-0000-0000-000000000002'
        and world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    'User 002 resumes as their City of Bovold steward'
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
        and world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    (
      select
        id
      from
        public.citizens
      where
        user_id = '00000000-0000-0000-0000-000000000003'
        and world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    'User 003 resumes as their Free City envoy'
  );

-- ---------------------------------------------------------------------------
-- Expanded economy catalogue, currencies, and Elder Scrolls calendar
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::int
      from
        public.resource_categories
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    10,
    'Ten resource categories'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.resources
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 80,
    'At least 80 resources'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.resources
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and category_id is null
    ),
    0,
    'Every resource is assigned to a category'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.job_definitions
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 40,
    'At least 40 job types'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.building_blueprints
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 50,
    'At least 50 building blueprints'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.deposit_types
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 12,
    'At least 12 deposit types'
  );

select
  ok (
    (
      select
        exists (
          select
            1
          from
            public.deposit_types
          where
            world_id = (
              select
                id
              from
                public.worlds
              where
                name = 'Bovold Seed World'
            )
            and slug = 'copper-vein'
        )
        and exists (
          select
            1
          from
            public.deposit_types
          where
            world_id = (
              select
                id
              from
                public.worlds
              where
                name = 'Bovold Seed World'
            )
            and slug = 'tin-vein'
        )
    ),
    'Copper and tin veins exist'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.managed_population_types
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    5,
    'Five managed-population types'
  );

select
  ok (
    (
      select
        exists (
          select
            1
          from
            public.managed_population_types
          where
            world_id = (
              select
                id
              from
                public.worlds
              where
                name = 'Bovold Seed World'
            )
            and slug = 'cow-herd'
        )
        and exists (
          select
            1
          from
            public.managed_population_types
          where
            world_id = (
              select
                id
              from
                public.worlds
              where
                name = 'Bovold Seed World'
            )
            and slug = 'chicken-flock'
        )
    ),
    'Cow herds and chicken flocks exist'
  );

select
  ok (
    (
      select
        exists (
          select
            1
          from
            public.job_definitions
          where
            world_id = (
              select
                id
              from
                public.worlds
              where
                name = 'Bovold Seed World'
            )
            and slug = 'bronzesmith'
        )
    ),
    'A bronzesmith job exists (copper + tin -> bronze)'
  );

select
  ok (
    (
      select
        icon
      from
        public.managed_population_types
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and slug = 'pig-herd'
    ) = 'game:pig',
    'The pig herd uses the pig icon'
  );

select
  ok (
    (
      select
        icon
      from
        public.managed_population_types
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and slug = 'bee-colony'
    ) = 'game:bee',
    'The bee colony uses the bee icon'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.education_levels
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and icon is null
    ),
    0,
    'Every education level has an icon'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.nation_currencies
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ),
    4,
    'Every nation has an established currency'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.law_amendments am
        join public.law_documents d on d.id = am.document_id
      where
        d.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
        and am.status = 'passed'
    ),
    4,
    'Every nation has a passed charter amendment'
  );

select
  ok (
    (
      select
        count(*)
      from
        public.unit_types
      where
        world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'Bovold Seed World'
        )
    ) >= 10,
    'At least ten unit types'
  );

select
  ok (
    (
      select
        min(cnt)
      from
        (
          select
            count(*) cnt
          from
            public.army_units u
            join public.armies a on a.id = u.army_id
          where
            a.world_id = (
              select
                id
              from
                public.worlds
              where
                name = 'Bovold Seed World'
            )
          group by
            a.id
        ) q
    ) >= 4,
    'Every nation''s army fields at least four units'
  );

select
  ok (
    (
      select
        (calendar_config_json -> 'months' -> 0 ->> 'name') = 'Morning Star'
      from
        public.worlds
      where
        name = 'Bovold Seed World'
    ),
    'The world uses the Elder Scrolls calendar'
  );

select
  *
from
  finish ();

rollback;
