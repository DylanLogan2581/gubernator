import { describe, expect, it } from "vitest";

import {
  WORLD_TEMPLATE_VERSION,
  worldTemplateSchema,
} from "./worldTemplateSchema";

const VALID_TEMPLATE = {
  template_version: WORLD_TEMPLATE_VERSION,
  meta: {
    name: "Seeded World",
    slug: "seeded-world-abcd1234",
    exported_at: "2026-06-17T00:00:00.000Z",
  },
  calendar: {
    dateFormatTemplate: "{weekday}, {day} {month} {year}",
    months: [
      { dayCount: 30, index: 0, name: "Firstmonth" },
      { dayCount: 28, index: 1, name: "Secondmonth" },
    ],
    startingDayOfMonth: 1,
    startingMonthIndex: 0,
    startingWeekdayOffset: 0,
    startingYear: 1,
    weekdays: [
      { index: 0, name: "Moonday" },
      { index: 1, name: "Fireday" },
      { index: 2, name: "Waterday" },
      { index: 3, name: "Earthday" },
      { index: 4, name: "Skyway" },
      { index: 5, name: "Spiritday" },
      { index: 6, name: "Restday" },
    ],
  },
  population_rules: {
    fertility_chance: 0.1,
    food_consumption_per_citizen: 1.0,
    homelessness_decline_rate: 0.05,
    incest_prevention_depth: 2,
    maximum_fertility_age_turns: 1800,
    minimum_partnership_age_turns: 360,
    mourning_period_turns: 90,
    partnership_seek_chance: 0.2,
    starvation_severity_multiplier: 1.0,
    water_consumption_per_citizen: 1.0,
  },
  npc_flavor: {
    contradictions: ["brave but cowardly"],
    flaws: ["stubborn"],
    goals: ["find glory"],
    traits: ["curious"],
  },
  naming_config: {
    convention: "family-name",
    female_given_names: ["Alice"],
    male_given_names: ["Bob"],
    surnames: ["Smith"],
  },
  namesets: [
    {
      name: "Default",
      is_default: true,
      config: {
        convention: "family-name",
        female_given_names: ["Alice"],
        male_given_names: ["Bob"],
        surnames: ["Smith"],
      },
    },
  ],
  resources: [
    {
      name: "Grain",
      slug: "grain",
      base_stockpile_cap: 1000,
      change_amount: -0.01,
      change_mode: "percent",
      is_system_resource: false,
    },
    {
      name: "Wood",
      slug: "wood",
      base_stockpile_cap: 500,
      change_amount: 0.0,
      change_mode: "percent",
      is_system_resource: false,
    },
  ],
  jobs: [
    {
      name: "Farming",
      slug: "farming",
      job_type: "standard",
      base_capacity: 10,
      trader_capacity_per_worker: null,
      inputs: [],
      outputs: [{ resource_slug: "grain", amount_per_worker: 2 }],
    },
  ],
  blueprints: [
    {
      name: "Granary",
      slug: "granary",
      description: "Stores grain",
      max_instances_per_settlement: 2,
      grace_period_turns: 10,
      tiers: [
        {
          tier_number: 1,
          worker_turns_required: 100,
          construction_costs: [{ resource_slug: "wood", amount: 50 }],
          upkeep_costs: [],
          effects: [
            {
              type: "resource_storage_increase",
              resource_slug: "grain",
              amount: 500,
            },
            { type: "population_cap_increase", amount: 20 },
          ],
        },
      ],
    },
  ],
  deposit_types: [
    {
      name: "Iron Vein",
      slug: "iron-vein",
      jobs: [
        {
          job_slug: "farming",
          output_units_per_worker: 3,
          worker_inputs: [{ resource_slug: "grain", amount_per_worker: 1 }],
        },
      ],
    },
  ],
  managed_population_types: [
    {
      name: "Sheep",
      slug: "sheep",
      husbandry_jobs: [{ job_slug: "husbandry", workers_per_n_animals: 5 }],
      culling_jobs: [{ job_slug: "culling", max_cull_per_worker: 10 }],
      growth_rate: 0.05,
      maintenance_rules: [
        { resource_slug: "grain", amount_per_n_animals: 0.1 },
      ],
      culling_outputs: [],
      regular_outputs: [],
    },
  ],
};

describe("worldTemplateSchema", () => {
  it("validates a complete valid fixture", () => {
    const result = worldTemplateSchema.safeParse(VALID_TEMPLATE);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("is byte-stable for the same fixture (JSON.stringify idempotent)", () => {
    const first = JSON.stringify(VALID_TEMPLATE);
    const second = JSON.stringify(VALID_TEMPLATE);
    expect(first).toBe(second);
  });

  it("rejects wrong template_version", () => {
    const bad = { ...VALID_TEMPLATE, template_version: 1 };
    const result = worldTemplateSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects missing required field in resources", () => {
    const bad = {
      ...VALID_TEMPLATE,
      resources: [
        {
          name: "Grain",
          slug: "grain",
          change_amount: -0.01,
          change_mode: "percent",
        },
      ],
    };
    const result = worldTemplateSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects probability out of range", () => {
    const bad = {
      ...VALID_TEMPLATE,
      population_rules: {
        ...VALID_TEMPLATE.population_rules,
        fertility_chance: 1.5,
      },
    };
    const result = worldTemplateSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a tier effect with unknown type", () => {
    const bad = {
      ...VALID_TEMPLATE,
      blueprints: [
        {
          ...VALID_TEMPLATE.blueprints[0],
          tiers: [
            {
              ...VALID_TEMPLATE.blueprints[0].tiers[0],
              effects: [{ type: "unknown_effect_type", amount: 10 }],
            },
          ],
        },
      ],
    };
    const result = worldTemplateSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("accepts empty optional arrays", () => {
    const minimal = {
      ...VALID_TEMPLATE,
      namesets: [],
      resources: [],
      jobs: [],
      blueprints: [],
      deposit_types: [],
      managed_population_types: [],
    };
    const result = worldTemplateSchema.safeParse(minimal);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("defaults v2 registries to empty arrays when omitted", () => {
    const result = worldTemplateSchema.safeParse(VALID_TEMPLATE);
    expect(result.success, result.error?.message).toBe(true);
    if (result.success) {
      expect(result.data.resource_categories).toEqual([]);
      expect(result.data.education_levels).toEqual([]);
      expect(result.data.cultures).toEqual([]);
      expect(result.data.religions).toEqual([]);
      expect(result.data.unit_types).toEqual([]);
    }
  });

  it("accepts icon/category/education refs on resources and jobs", () => {
    const withRefs = {
      ...VALID_TEMPLATE,
      resource_categories: [{ name: "Food", color: "#4caf50", sort_order: 0 }],
      education_levels: [
        {
          name: "Basic",
          description: null,
          rank: 1,
          natural_born_percent: 10,
        },
      ],
      resources: [
        {
          ...VALID_TEMPLATE.resources[0],
          icon: "wheat",
          category: "Food",
        },
      ],
      jobs: [
        {
          ...VALID_TEMPLATE.jobs[0],
          icon: null,
          required_education_level: "Basic",
        },
      ],
    };
    const result = worldTemplateSchema.safeParse(withRefs);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("tolerates an old resource category export that still has icon", () => {
    const withOldCategoryIcon = {
      ...VALID_TEMPLATE,
      resource_categories: [
        { name: "Food", icon: "wheat", color: "#4caf50", sort_order: 0 },
      ],
    };
    const result = worldTemplateSchema.safeParse(withOldCategoryIcon);
    expect(result.success, result.error?.message).toBe(true);
    if (result.success) {
      expect(result.data.resource_categories[0]).not.toHaveProperty("icon");
    }
  });

  it("rejects duplicate education level ranks", () => {
    const bad = {
      ...VALID_TEMPLATE,
      education_levels: [
        { name: "Basic", description: null, rank: 1, natural_born_percent: 0 },
        {
          name: "Scholar",
          description: null,
          rank: 1,
          natural_born_percent: 0,
        },
      ],
    };
    const result = worldTemplateSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects natural_born_percent values summing above 100", () => {
    const bad = {
      ...VALID_TEMPLATE,
      education_levels: [
        {
          name: "Basic",
          description: null,
          rank: 1,
          natural_born_percent: 60,
        },
        {
          name: "Scholar",
          description: null,
          rank: 2,
          natural_born_percent: 50,
        },
      ],
    };
    const result = worldTemplateSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("accepts a tier education effect", () => {
    const withEducationEffect = {
      ...VALID_TEMPLATE,
      education_levels: [
        { name: "Basic", description: null, rank: 1, natural_born_percent: 0 },
      ],
      jobs: [
        ...VALID_TEMPLATE.jobs,
        {
          name: "Tutor",
          slug: "tutor",
          job_type: "teacher",
          base_capacity: 5,
          trader_capacity_per_worker: null,
          inputs: [],
          outputs: [],
        },
      ],
      blueprints: [
        {
          ...VALID_TEMPLATE.blueprints[0],
          tiers: [
            {
              ...VALID_TEMPLATE.blueprints[0].tiers[0],
              effects: [
                {
                  type: "education",
                  teacher_job_slug: "tutor",
                  teacher_capacity: 2,
                  students_per_teacher: 5,
                  levels: [{ from_level: null, to_level: "Basic", turns: 3 }],
                },
              ],
            },
          ],
        },
      ],
    };
    const result = worldTemplateSchema.safeParse(withEducationEffect);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("accepts a unit type with a building requirement", () => {
    const withUnitType = {
      ...VALID_TEMPLATE,
      unit_types: [
        {
          name: "Militia",
          description: null,
          soldiers_per_unit: 10,
          required_education_level: null,
          required_building: { blueprint_slug: "granary", tier_number: 1 },
          recruitment_costs: [{ resource_slug: "wood", amount: 5 }],
          upkeep_costs: [{ resource_slug: "grain", amount: 1 }],
          desertion_rate: 0.05,
        },
      ],
    };
    const result = worldTemplateSchema.safeParse(withUnitType);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("accepts a deposit type with multiple linked jobs", () => {
    const withMultipleJobs = {
      ...VALID_TEMPLATE,
      deposit_types: [
        {
          name: "Copper Vein",
          slug: "copper-vein",
          jobs: [
            {
              job_slug: "copper-miner",
              output_units_per_worker: 4,
              worker_inputs: [],
            },
            {
              job_slug: "skilled-copper-miner",
              output_units_per_worker: 8,
              worker_inputs: [{ resource_slug: "grain", amount_per_worker: 1 }],
            },
          ],
        },
      ],
    };
    const result = worldTemplateSchema.safeParse(withMultipleJobs);
    expect(result.success, result.error?.message).toBe(true);
    expect(result.data?.deposit_types[0]?.jobs).toHaveLength(2);
  });

  it("is lenient toward legacy single-job deposit type templates (job_slug flattened onto the deposit type)", () => {
    const legacyShape = {
      ...VALID_TEMPLATE,
      deposit_types: [
        {
          name: "Iron Vein",
          slug: "iron-vein",
          job_slug: "farming",
          output_units_per_worker: 3,
          worker_inputs: [{ resource_slug: "grain", amount_per_worker: 1 }],
        },
      ],
    };
    const result = worldTemplateSchema.safeParse(legacyShape);
    expect(result.success, result.error?.message).toBe(true);
    expect(result.data?.deposit_types[0]?.jobs).toEqual([
      {
        job_slug: "farming",
        output_units_per_worker: 3,
        worker_inputs: [{ resource_slug: "grain", amount_per_worker: 1 }],
      },
    ]);
  });

  it("accepts a managed population type with multiple husbandry and culling jobs", () => {
    const withMultipleJobs = {
      ...VALID_TEMPLATE,
      managed_population_types: [
        {
          ...VALID_TEMPLATE.managed_population_types[0],
          husbandry_jobs: [
            { job_slug: "husbandry", workers_per_n_animals: 5 },
            { job_slug: "senior-husbandry", workers_per_n_animals: 10 },
          ],
          culling_jobs: [
            { job_slug: "culling", max_cull_per_worker: 10 },
            { job_slug: "skilled-culling", max_cull_per_worker: 20 },
          ],
        },
      ],
    };
    const result = worldTemplateSchema.safeParse(withMultipleJobs);
    expect(result.success, result.error?.message).toBe(true);
    expect(
      result.data?.managed_population_types[0]?.husbandry_jobs,
    ).toHaveLength(2);
    expect(result.data?.managed_population_types[0]?.culling_jobs).toHaveLength(
      2,
    );
  });

  it("is lenient toward legacy single-job managed population type templates (husbandry_job_slug/culling_job_slug flattened)", () => {
    const legacyShape = {
      ...VALID_TEMPLATE,
      managed_population_types: [
        {
          name: "Sheep",
          slug: "sheep",
          husbandry_job_slug: "husbandry",
          culling_job_slug: "culling",
          husbandry_workers_per_n_animals: 5,
          growth_rate: 0.05,
          maintenance_rules: [
            { resource_slug: "grain", amount_per_n_animals: 0.1 },
          ],
          culling_outputs: [],
          regular_outputs: [],
        },
      ],
    };
    const result = worldTemplateSchema.safeParse(legacyShape);
    expect(result.success, result.error?.message).toBe(true);
    expect(result.data?.managed_population_types[0]?.husbandry_jobs).toEqual([
      { job_slug: "husbandry", workers_per_n_animals: 5 },
    ]);
    expect(result.data?.managed_population_types[0]?.culling_jobs).toEqual([
      { job_slug: "culling", max_cull_per_worker: 10 },
    ]);
  });

  it("rejects a managed population type with an empty husbandry_jobs array", () => {
    const bad = {
      ...VALID_TEMPLATE,
      managed_population_types: [
        {
          ...VALID_TEMPLATE.managed_population_types[0],
          husbandry_jobs: [],
        },
      ],
    };
    const result = worldTemplateSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a managed population type with an empty culling_jobs array", () => {
    const bad = {
      ...VALID_TEMPLATE,
      managed_population_types: [
        {
          ...VALID_TEMPLATE.managed_population_types[0],
          culling_jobs: [],
        },
      ],
    };
    const result = worldTemplateSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a unit type with an out-of-range desertion rate", () => {
    const bad = {
      ...VALID_TEMPLATE,
      unit_types: [
        {
          name: "Militia",
          description: null,
          soldiers_per_unit: 10,
          required_education_level: null,
          required_building: null,
          recruitment_costs: [],
          upkeep_costs: [],
          desertion_rate: 1.5,
        },
      ],
    };
    const result = worldTemplateSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
