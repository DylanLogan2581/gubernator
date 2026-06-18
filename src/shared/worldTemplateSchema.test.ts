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
      decay_rate: 0.01,
      is_system_resource: false,
    },
    {
      name: "Wood",
      slug: "wood",
      base_stockpile_cap: 500,
      decay_rate: 0.0,
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
      job_slug: "farming",
      output_units_per_worker: 3,
      worker_inputs: [{ resource_slug: "grain", amount_per_worker: 1 }],
    },
  ],
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
    const bad = { ...VALID_TEMPLATE, template_version: 2 };
    const result = worldTemplateSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects missing required field in resources", () => {
    const bad = {
      ...VALID_TEMPLATE,
      resources: [{ name: "Grain", slug: "grain", decay_rate: 0.01 }],
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
});
