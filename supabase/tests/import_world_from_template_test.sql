-- pgTAP tests for public.import_world_from_template.
-- Covers: version mismatch, auth guard, round-trip entity counts,
--         and atomicity (poisoned fixture leaves zero partial rows).
-- Run with: npx supabase test db
begin;

select
  plan (12);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges:
--   171xxxxx = users
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
    '17100000-0000-0000-0000-000000000001',
    'it-superadmin@example.com',
    'x',
    now(),
    '{"username":"it_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    '17100000-0000-0000-0000-000000000002',
    'it-user@example.com',
    'x',
    now(),
    '{"username":"it_user"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = '17100000-0000-0000-0000-000000000001';

-- Store the full test template in a temp table to avoid repeating the literal.
create temp table it_template_store (label text primary key, tmpl jsonb);

insert into
  it_template_store (label, tmpl)
values
  (
    'full',
    $tmpl${
      "template_version": 1,
      "meta": {
        "name": "IT Source",
        "slug": "it-source",
        "exported_at": "2026-01-01T00:00:00.000Z"
      },
      "calendar": {
        "dateFormatTemplate": "Y{year}",
        "months": [{"dayCount": 30, "index": 0, "name": "Jan"}],
        "startingDayOfMonth": 1,
        "startingMonthIndex": 0,
        "startingWeekdayOffset": 0,
        "startingYear": 1,
        "weekdays": [{"index": 0, "name": "Mon"}]
      },
      "population_rules": {
        "fertility_chance": 0.1,
        "food_consumption_per_citizen": 1.0,
        "homelessness_decline_rate": 0.05,
        "incest_prevention_depth": 3,
        "maximum_fertility_age_turns": null,
        "minimum_partnership_age_turns": 18,
        "mourning_period_turns": 4,
        "partnership_seek_chance": 0.3,
        "starvation_severity_multiplier": 1.5,
        "water_consumption_per_citizen": 1.0
      },
      "npc_flavor": {
        "contradictions": [], "flaws": [], "goals": [], "traits": []
      },
      "naming_config": {
        "convention": "none",
        "female_given_names": [],
        "male_given_names": [],
        "surnames": []
      },
      "namesets": [
        {
          "name": "Default",
          "is_default": true,
          "config": {
            "convention": "pool",
            "female_given_names": ["Alice"],
            "male_given_names": ["Bob"],
            "surnames": []
          }
        }
      ],
      "resources": [
        {
          "name": "Food", "slug": "food",
          "base_stockpile_cap": 1000, "decay_rate": 0.05,
          "is_system_resource": true
        },
        {
          "name": "Fresh Water", "slug": "fresh-water",
          "base_stockpile_cap": 800, "decay_rate": 0.0,
          "is_system_resource": true
        },
        {
          "name": "Wood", "slug": "wood",
          "base_stockpile_cap": 500, "decay_rate": 0.0,
          "is_system_resource": false
        }
      ],
      "jobs": [
        {
          "name": "Farmer", "slug": "farmer",
          "job_type": "standard",
          "base_capacity": 20,
          "trader_capacity_per_worker": null,
          "inputs": [],
          "outputs": [{"resource_slug": "food", "amount_per_worker": 2.0}]
        },
        {
          "name": "Woodcutter", "slug": "woodcutter",
          "job_type": "standard",
          "base_capacity": 10,
          "trader_capacity_per_worker": null,
          "inputs": [],
          "outputs": [{"resource_slug": "wood", "amount_per_worker": 1.5}]
        }
      ],
      "blueprints": [
        {
          "name": "Granary", "slug": "granary",
          "description": "Stores food",
          "max_instances_per_settlement": 2,
          "grace_period_turns": 3,
          "tiers": [
            {
              "tier_number": 1,
              "worker_turns_required": 10,
              "construction_costs": [{"resource_slug": "wood", "amount": 5}],
              "upkeep_costs": [],
              "effects": [
                {"type": "resource_storage_increase", "resource_slug": "food", "amount": 200}
              ]
            }
          ]
        }
      ],
      "deposit_types": [
        {
          "name": "Forest", "slug": "forest",
          "job_slug": "woodcutter",
          "output_units_per_worker": 1.5,
          "worker_inputs": []
        }
      ],
      "managed_population_types": [
        {
          "name": "Chicken", "slug": "chicken",
          "husbandry_job_slug": "farmer",
          "culling_job_slug": "woodcutter",
          "husbandry_workers_per_n_animals": 10,
          "growth_rate": 0.05,
          "maintenance_rules": [
            {"resource_slug": "food", "amount_per_n_animals": 0.1}
          ],
          "culling_outputs": [
            {"resource_slug": "food", "amount_per_n_animals": 2.0}
          ],
          "regular_outputs": []
        }
      ]
    }$tmpl$
  ),
  (
    'poisoned',
    $tmpl${
      "template_version": 1,
      "meta": {
        "name": "IT Poisoned",
        "slug": "it-poisoned",
        "exported_at": "2026-01-01T00:00:00.000Z"
      },
      "calendar": {
        "dateFormatTemplate": "Y{year}",
        "months": [{"dayCount": 30, "index": 0, "name": "Jan"}],
        "startingDayOfMonth": 1,
        "startingMonthIndex": 0,
        "startingWeekdayOffset": 0,
        "startingYear": 1,
        "weekdays": [{"index": 0, "name": "Mon"}]
      },
      "population_rules": {
        "fertility_chance": 0.1,
        "food_consumption_per_citizen": 1.0,
        "homelessness_decline_rate": 0.05,
        "incest_prevention_depth": 3,
        "maximum_fertility_age_turns": null,
        "minimum_partnership_age_turns": 18,
        "mourning_period_turns": 4,
        "partnership_seek_chance": 0.3,
        "starvation_severity_multiplier": 1.5,
        "water_consumption_per_citizen": 1.0
      },
      "npc_flavor": {"contradictions":[],"flaws":[],"goals":[],"traits":[]},
      "naming_config": {"convention":"none","female_given_names":[],"male_given_names":[],"surnames":[]},
      "namesets": [],
      "resources": [
        {"name":"Food","slug":"food","base_stockpile_cap":1000,"decay_rate":0.05,"is_system_resource":true}
      ],
      "jobs": [
        {
          "name": "Farmer", "slug": "farmer",
          "job_type": "standard",
          "base_capacity": 20,
          "trader_capacity_per_worker": null,
          "inputs": [{"resource_slug": "nonexistent-resource", "amount_per_worker": 1}],
          "outputs": []
        }
      ],
      "blueprints": [],
      "deposit_types": [],
      "managed_population_types": []
    }$tmpl$
  );

-- Grant the authenticated role read access to the temp table so it can be
-- referenced inside throws_ok() and is() assertions after role switch.
grant
select
  on it_template_store to authenticated;

-- ===========================================================================
-- 1. version mismatch → 22000 (not a stack trace)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"17100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $$
      select public.import_world_from_template (
        'IT Version Mismatch',
        'private',
        '{"template_version":2,"meta":{},"calendar":{},"population_rules":{},"npc_flavor":{},"naming_config":{},"namesets":[],"resources":[],"jobs":[],"blueprints":[],"deposit_types":[],"managed_population_types":[]}'::jsonb
      )
    $$,
    '22000',
    null,
    'version mismatch raises 22000'
  );

-- ===========================================================================
-- 2. non-superadmin → 42501
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"17100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $$
      select public.import_world_from_template (
        'IT Unauthorized',
        'private',
        '{"template_version":1}'::jsonb
      )
    $$,
    '42501',
    null,
    'non-superadmin raises 42501'
  );

-- ===========================================================================
-- 3–10. Successful round-trip (superadmin)
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"17100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        w.name
      from
        public.import_world_from_template (
          'IT Imported World',
          'private',
          (
            select
              tmpl
            from
              it_template_store
            where
              label = 'full'
          )
        ) as w
    ),
    'IT Imported World',
    'import_world_from_template returns world with the given name'
  );

-- Entity count checks — query against the newly created world.
select
  is (
    (
      select
        count(*)::int
      from
        public.resources r
      where
        r.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'IT Imported World'
        )
    ),
    3,
    '3 resources imported (2 system + 1 non-system from template)'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.job_definitions j
      where
        j.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'IT Imported World'
        )
    ),
    2,
    '2 jobs imported'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.building_blueprints b
      where
        b.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'IT Imported World'
        )
    ),
    1,
    '1 blueprint imported'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.building_blueprint_tiers t
      where
        t.building_blueprint_id in (
          select
            id
          from
            public.building_blueprints
          where
            world_id = (
              select
                id
              from
                public.worlds
              where
                name = 'IT Imported World'
            )
        )
    ),
    1,
    '1 blueprint tier imported'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.namesets n
      where
        n.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'IT Imported World'
        )
    ),
    1,
    '1 nameset imported'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.deposit_types dt
      where
        dt.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'IT Imported World'
        )
    ),
    1,
    '1 deposit type imported'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.managed_population_types m
      where
        m.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'IT Imported World'
        )
    ),
    1,
    '1 managed population type imported'
  );

-- ===========================================================================
-- 11. Poisoned fixture: dangling resource reference raises 22000
-- ===========================================================================
select
  throws_ok (
    $$
      select public.import_world_from_template (
        'IT Poisoned World',
        'private',
        (select tmpl from it_template_store where label = 'poisoned')
      )
    $$,
    '22000',
    null,
    'dangling resource ref in job inputs raises 22000'
  );

-- ===========================================================================
-- 12. After poisoned import failure, no partial rows left
-- ===========================================================================
select
  is (
    (
      select
        count(*)::int
      from
        public.worlds w
      where
        w.name = 'IT Poisoned World'
    ),
    0,
    'poisoned import rolls back entirely — zero partial world rows'
  );

reset role;

select
  *
from
  finish ();

rollback;
