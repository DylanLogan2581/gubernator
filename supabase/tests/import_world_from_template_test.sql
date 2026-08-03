-- pgTAP tests for public.import_world_from_template (template v2).
-- Covers: v1 rejection, auth guard, round-trip entity counts for every v2
--         registry (resource categories, education levels, cultures,
--         religions, unit types), icon/category/education-ref resolution,
--         the education tier-effect variant, unit-type composite building
--         requirement resolution, dangling-ref rejection for every new
--         name/slug ref, and atomicity (poisoned fixtures leave zero
--         partial rows).
-- Run with: npx supabase test db
begin;

select
  plan (25);

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

-- Store the full test templates in a temp table to avoid repeating literals.
create temp table it_template_store (label text primary key, tmpl jsonb);

insert into
  it_template_store (label, tmpl)
values
  (
    'full',
    $tmpl${
      "template_version": 2,
      "meta": {
        "name": "IT Source",
        "slug": "it-source",
        "exported_at": "2026-01-01T00:00:00.000Z"
      },
      "calendar": {
        "dateFormatTemplate": "Y{year}",
        "shortDateFormatTemplate": "{monthNumber}/{dayNumber}",
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
      "resource_categories": [
        {"name": "Foodstuffs", "icon": "wheat", "color": "#4caf50", "sort_order": 0}
      ],
      "education_levels": [
        {"name": "Basic", "description": null, "rank": 1, "natural_born_percent": 10},
        {"name": "Scholar", "description": null, "rank": 2, "natural_born_percent": 0}
      ],
      "cultures": [
        {"name": "Highlander", "description": null, "color": "#123456"}
      ],
      "religions": [
        {"name": "Sunworship", "description": null, "color": "#654321"}
      ],
      "resources": [
        {
          "name": "Food", "slug": "food",
          "base_stockpile_cap": 1000, "change_mode": "percent", "change_amount": -0.05,
          "is_system_resource": true, "icon": "wheat", "category": "Foodstuffs"
        },
        {
          "name": "Fresh Water", "slug": "fresh-water",
          "base_stockpile_cap": 800, "change_mode": "percent", "change_amount": 0.0,
          "is_system_resource": true, "icon": null, "category": null
        },
        {
          "name": "Wood", "slug": "wood",
          "base_stockpile_cap": 500, "change_mode": "percent", "change_amount": 0.0,
          "is_system_resource": false, "icon": null, "category": null
        }
      ],
      "jobs": [
        {
          "name": "Farmer", "slug": "farmer",
          "job_type": "standard",
          "base_capacity": 20,
          "trader_capacity_per_worker": null,
          "inputs": [],
          "outputs": [{"resource_slug": "food", "amount_per_worker": 2.0}],
          "icon": null,
          "required_education_level": "Basic"
        },
        {
          "name": "Woodcutter", "slug": "woodcutter",
          "job_type": "standard",
          "base_capacity": 10,
          "trader_capacity_per_worker": null,
          "inputs": [],
          "outputs": [{"resource_slug": "wood", "amount_per_worker": 1.5}],
          "icon": null,
          "required_education_level": null
        },
        {
          "name": "Tutor", "slug": "tutor",
          "job_type": "teacher",
          "base_capacity": 5,
          "trader_capacity_per_worker": null,
          "inputs": [],
          "outputs": [],
          "icon": null,
          "required_education_level": null
        }
      ],
      "blueprints": [
        {
          "name": "Granary", "slug": "granary",
          "description": "Stores food",
          "max_instances_per_settlement": 2,
          "grace_period_turns": 3,
          "icon": null,
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
        },
        {
          "name": "School", "slug": "school",
          "description": "Teaches citizens",
          "max_instances_per_settlement": 1,
          "grace_period_turns": 3,
          "icon": null,
          "tiers": [
            {
              "tier_number": 1,
              "worker_turns_required": 8,
              "construction_costs": [{"resource_slug": "wood", "amount": 10}],
              "upkeep_costs": [],
              "effects": [
                {
                  "type": "education",
                  "teacher_job_slug": "tutor",
                  "teacher_capacity": 2,
                  "students_per_teacher": 5,
                  "levels": [
                    {"from_level": null, "to_level": "Basic", "turns": 3},
                    {"from_level": "Basic", "to_level": "Scholar", "turns": 5}
                  ]
                }
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
          "worker_inputs": [],
          "icon": null
        }
      ],
      "managed_population_types": [
        {
          "name": "Chicken", "slug": "chicken",
          "husbandry_jobs": [{"job_slug": "farmer", "workers_per_n_animals": 10}],
          "culling_jobs": [{"job_slug": "woodcutter", "max_cull_per_worker": 10}],
          "growth_rate": 0.05,
          "maintenance_rules": [
            {"resource_slug": "food", "amount_per_n_animals": 0.1}
          ],
          "culling_outputs": [
            {"resource_slug": "food", "amount_per_n_animals": 2.0}
          ],
          "regular_outputs": [],
          "icon": null
        }
      ],
      "unit_types": [
        {
          "name": "Militia",
          "description": null,
          "soldiers_per_unit": 10,
          "required_education_level": "Basic",
          "required_building": {"blueprint_slug": "school", "tier_number": 1},
          "recruitment_costs": [{"resource_slug": "wood", "amount": 5}],
          "upkeep_costs": [{"resource_slug": "food", "amount": 1}],
          "desertion_rate": 0.05
        }
      ]
    }$tmpl$
  ),
  (
    'poisoned',
    $tmpl${
      "template_version": 2,
      "meta": {"name": "IT Poisoned", "slug": "it-poisoned", "exported_at": "2026-01-01T00:00:00.000Z"},
      "calendar": {
        "dateFormatTemplate": "Y{year}",
        "months": [{"dayCount": 30, "index": 0, "name": "Jan"}],
        "startingDayOfMonth": 1, "startingMonthIndex": 0, "startingWeekdayOffset": 0, "startingYear": 1,
        "weekdays": [{"index": 0, "name": "Mon"}]
      },
      "population_rules": {
        "fertility_chance": 0.1, "food_consumption_per_citizen": 1.0, "homelessness_decline_rate": 0.05,
        "incest_prevention_depth": 3, "maximum_fertility_age_turns": null, "minimum_partnership_age_turns": 18,
        "mourning_period_turns": 4, "partnership_seek_chance": 0.3, "starvation_severity_multiplier": 1.5,
        "water_consumption_per_citizen": 1.0
      },
      "npc_flavor": {"contradictions":[],"flaws":[],"goals":[],"traits":[]},
      "naming_config": {"convention":"none","female_given_names":[],"male_given_names":[],"surnames":[]},
      "namesets": [],
      "resource_categories": [],
      "education_levels": [],
      "cultures": [],
      "religions": [],
      "resources": [
        {"name":"Food","slug":"food","base_stockpile_cap":1000,"change_mode":"percent","change_amount":-0.05,"is_system_resource":true,"icon":null,"category":null}
      ],
      "jobs": [
        {
          "name": "Farmer", "slug": "farmer",
          "job_type": "standard",
          "base_capacity": 20,
          "trader_capacity_per_worker": null,
          "inputs": [{"resource_slug": "nonexistent-resource", "amount_per_worker": 1}],
          "outputs": [],
          "icon": null,
          "required_education_level": null
        }
      ],
      "blueprints": [],
      "deposit_types": [],
      "managed_population_types": [],
      "unit_types": []
    }$tmpl$
  ),
  (
    'poisoned_category',
    $tmpl${
      "template_version": 2,
      "meta": {"name": "IT Poisoned Category", "slug": "it-poisoned-category", "exported_at": "2026-01-01T00:00:00.000Z"},
      "calendar": {
        "dateFormatTemplate": "Y{year}",
        "months": [{"dayCount": 30, "index": 0, "name": "Jan"}],
        "startingDayOfMonth": 1, "startingMonthIndex": 0, "startingWeekdayOffset": 0, "startingYear": 1,
        "weekdays": [{"index": 0, "name": "Mon"}]
      },
      "population_rules": {
        "fertility_chance": 0.1, "food_consumption_per_citizen": 1.0, "homelessness_decline_rate": 0.05,
        "incest_prevention_depth": 3, "maximum_fertility_age_turns": null, "minimum_partnership_age_turns": 18,
        "mourning_period_turns": 4, "partnership_seek_chance": 0.3, "starvation_severity_multiplier": 1.5,
        "water_consumption_per_citizen": 1.0
      },
      "npc_flavor": {"contradictions":[],"flaws":[],"goals":[],"traits":[]},
      "naming_config": {"convention":"none","female_given_names":[],"male_given_names":[],"surnames":[]},
      "namesets": [],
      "resource_categories": [],
      "education_levels": [],
      "cultures": [],
      "religions": [],
      "resources": [
        {"name":"Food","slug":"food","base_stockpile_cap":1000,"change_mode":"percent","change_amount":0,"is_system_resource":true,"icon":null,"category":"Nonexistent"}
      ],
      "jobs": [],
      "blueprints": [],
      "deposit_types": [],
      "managed_population_types": [],
      "unit_types": []
    }$tmpl$
  ),
  (
    'poisoned_education',
    $tmpl${
      "template_version": 2,
      "meta": {"name": "IT Poisoned Education", "slug": "it-poisoned-education", "exported_at": "2026-01-01T00:00:00.000Z"},
      "calendar": {
        "dateFormatTemplate": "Y{year}",
        "months": [{"dayCount": 30, "index": 0, "name": "Jan"}],
        "startingDayOfMonth": 1, "startingMonthIndex": 0, "startingWeekdayOffset": 0, "startingYear": 1,
        "weekdays": [{"index": 0, "name": "Mon"}]
      },
      "population_rules": {
        "fertility_chance": 0.1, "food_consumption_per_citizen": 1.0, "homelessness_decline_rate": 0.05,
        "incest_prevention_depth": 3, "maximum_fertility_age_turns": null, "minimum_partnership_age_turns": 18,
        "mourning_period_turns": 4, "partnership_seek_chance": 0.3, "starvation_severity_multiplier": 1.5,
        "water_consumption_per_citizen": 1.0
      },
      "npc_flavor": {"contradictions":[],"flaws":[],"goals":[],"traits":[]},
      "naming_config": {"convention":"none","female_given_names":[],"male_given_names":[],"surnames":[]},
      "namesets": [],
      "resource_categories": [],
      "education_levels": [],
      "cultures": [],
      "religions": [],
      "resources": [],
      "jobs": [
        {
          "name": "Farmer", "slug": "farmer",
          "job_type": "standard",
          "base_capacity": 20,
          "trader_capacity_per_worker": null,
          "inputs": [],
          "outputs": [],
          "icon": null,
          "required_education_level": "Nonexistent"
        }
      ],
      "blueprints": [],
      "deposit_types": [],
      "managed_population_types": [],
      "unit_types": []
    }$tmpl$
  ),
  (
    'poisoned_unit_building',
    $tmpl${
      "template_version": 2,
      "meta": {"name": "IT Poisoned Unit Building", "slug": "it-poisoned-unit-building", "exported_at": "2026-01-01T00:00:00.000Z"},
      "calendar": {
        "dateFormatTemplate": "Y{year}",
        "months": [{"dayCount": 30, "index": 0, "name": "Jan"}],
        "startingDayOfMonth": 1, "startingMonthIndex": 0, "startingWeekdayOffset": 0, "startingYear": 1,
        "weekdays": [{"index": 0, "name": "Mon"}]
      },
      "population_rules": {
        "fertility_chance": 0.1, "food_consumption_per_citizen": 1.0, "homelessness_decline_rate": 0.05,
        "incest_prevention_depth": 3, "maximum_fertility_age_turns": null, "minimum_partnership_age_turns": 18,
        "mourning_period_turns": 4, "partnership_seek_chance": 0.3, "starvation_severity_multiplier": 1.5,
        "water_consumption_per_citizen": 1.0
      },
      "npc_flavor": {"contradictions":[],"flaws":[],"goals":[],"traits":[]},
      "naming_config": {"convention":"none","female_given_names":[],"male_given_names":[],"surnames":[]},
      "namesets": [],
      "resource_categories": [],
      "education_levels": [],
      "cultures": [],
      "religions": [],
      "resources": [],
      "jobs": [],
      "blueprints": [],
      "deposit_types": [],
      "managed_population_types": [],
      "unit_types": [
        {
          "name": "Militia",
          "description": null,
          "soldiers_per_unit": 10,
          "required_education_level": null,
          "required_building": {"blueprint_slug": "nonexistent-blueprint", "tier_number": 1},
          "recruitment_costs": [],
          "upkeep_costs": [],
          "desertion_rate": 0.05
        }
      ]
    }$tmpl$
  ),
  (
    'poisoned_natural_born_percent',
    $tmpl${
      "template_version": 2,
      "meta": {"name": "IT Poisoned Percent", "slug": "it-poisoned-percent", "exported_at": "2026-01-01T00:00:00.000Z"},
      "calendar": {
        "dateFormatTemplate": "Y{year}",
        "months": [{"dayCount": 30, "index": 0, "name": "Jan"}],
        "startingDayOfMonth": 1, "startingMonthIndex": 0, "startingWeekdayOffset": 0, "startingYear": 1,
        "weekdays": [{"index": 0, "name": "Mon"}]
      },
      "population_rules": {
        "fertility_chance": 0.1, "food_consumption_per_citizen": 1.0, "homelessness_decline_rate": 0.05,
        "incest_prevention_depth": 3, "maximum_fertility_age_turns": null, "minimum_partnership_age_turns": 18,
        "mourning_period_turns": 4, "partnership_seek_chance": 0.3, "starvation_severity_multiplier": 1.5,
        "water_consumption_per_citizen": 1.0
      },
      "npc_flavor": {"contradictions":[],"flaws":[],"goals":[],"traits":[]},
      "naming_config": {"convention":"none","female_given_names":[],"male_given_names":[],"surnames":[]},
      "namesets": [],
      "resource_categories": [],
      "education_levels": [
        {"name": "Basic", "description": null, "rank": 1, "natural_born_percent": 60},
        {"name": "Scholar", "description": null, "rank": 2, "natural_born_percent": 50}
      ],
      "cultures": [],
      "religions": [],
      "resources": [],
      "jobs": [],
      "blueprints": [],
      "deposit_types": [],
      "managed_population_types": [],
      "unit_types": []
    }$tmpl$
  );

-- Grant the authenticated role read access to the temp table so it can be
-- referenced inside throws_ok() and is() assertions after role switch.
grant
select
  on it_template_store to authenticated;

-- ===========================================================================
-- 1. v1 template_version → 22000 (v1 is no longer supported)
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
        '{"template_version":1,"meta":{},"calendar":{},"population_rules":{},"npc_flavor":{},"naming_config":{},"namesets":[],"resources":[],"jobs":[],"blueprints":[],"deposit_types":[],"managed_population_types":[]}'::jsonb
      )
    $$,
    '22000',
    null,
    'v1 template_version raises 22000'
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
        '{"template_version":2}'::jsonb
      )
    $$,
    '42501',
    null,
    'non-superadmin raises 42501'
  );

-- ===========================================================================
-- 3–19. Successful round-trip (superadmin)
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
    3,
    '3 jobs imported'
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
    2,
    '2 blueprints imported'
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
    2,
    '2 blueprint tiers imported'
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

select
  is (
    (
      select
        count(*)::int
      from
        public.resource_categories rc
      where
        rc.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'IT Imported World'
        )
    ),
    1,
    '1 resource category imported'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.education_levels el
      where
        el.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'IT Imported World'
        )
    ),
    2,
    '2 education levels imported'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.cultures c
      where
        c.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'IT Imported World'
        )
    ),
    1,
    '1 culture imported'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.religions r
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
    1,
    '1 religion imported'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.unit_types u
      where
        u.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'IT Imported World'
        )
    ),
    1,
    '1 unit type imported'
  );

select
  is (
    (
      select
        rc.name
      from
        public.resources r
        join public.resource_categories rc on rc.id = r.category_id
      where
        r.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'IT Imported World'
        )
        and r.slug = 'food'
    ),
    'Foodstuffs',
    'resource category_id resolves to the imported category'
  );

select
  is (
    (
      select
        el.name
      from
        public.job_definitions j
        join public.education_levels el on el.id = j.required_education_level_id
      where
        j.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'IT Imported World'
        )
        and j.slug = 'farmer'
    ),
    'Basic',
    'job required_education_level_id resolves to the imported level'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.building_blueprint_tiers t
        join public.building_blueprints b on b.id = t.building_blueprint_id
        cross join lateral jsonb_array_elements(t.effects_json) as e (value)
      where
        b.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'IT Imported World'
        )
        and b.slug = 'school'
        and t.tier_number = 1
        and (e.value ->> 'type') = 'education'
        and jsonb_array_length(e.value -> 'levels') = 2
    ),
    1,
    'education effect present in school tier effects_json with 2 levels'
  );

select
  is (
    (
      select
        b.slug || ':' || u.required_building_tier_number::text
      from
        public.unit_types u
        join public.building_blueprints b on b.id = u.required_building_blueprint_id
      where
        u.world_id = (
          select
            id
          from
            public.worlds
          where
            name = 'IT Imported World'
        )
        and u.name = 'Militia'
    ),
    'school:1',
    'unit type required_building resolves to school blueprint tier 1'
  );

-- ===========================================================================
-- 20–24. Poisoned fixtures: dangling refs raise 22000, atomically
-- ===========================================================================
select
  throws_ok (
    $$
      select public.import_world_from_template (
        'IT Poisoned World',
        (select tmpl from it_template_store where label = 'poisoned')
      )
    $$,
    '22000',
    null,
    'dangling resource ref in job inputs raises 22000'
  );

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

select
  throws_ok (
    $$
      select public.import_world_from_template (
        'IT Poisoned Category',
        (select tmpl from it_template_store where label = 'poisoned_category')
      )
    $$,
    '22000',
    null,
    'dangling resource category ref raises 22000'
  );

select
  throws_ok (
    $$
      select public.import_world_from_template (
        'IT Poisoned Education',
        (select tmpl from it_template_store where label = 'poisoned_education')
      )
    $$,
    '22000',
    null,
    'dangling job required_education_level ref raises 22000'
  );

select
  throws_ok (
    $$
      select public.import_world_from_template (
        'IT Poisoned Unit Building',
        (select tmpl from it_template_store where label = 'poisoned_unit_building')
      )
    $$,
    '22000',
    null,
    'dangling unit type required_building blueprint ref raises 22000'
  );

-- ===========================================================================
-- 25. natural_born_percent sum > 100 is rejected (enforced by the
--     education_levels_enforce_natural_born_percent_limit trigger)
-- ===========================================================================
select
  throws_ok (
    $$
      select public.import_world_from_template (
        'IT Poisoned Percent',
        (select tmpl from it_template_store where label = 'poisoned_natural_born_percent')
      )
    $$,
    'P0001',
    null,
    'natural_born_percent total exceeding 100 is rejected'
  );

reset role;

select
  *
from
  finish ();

rollback;
