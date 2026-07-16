import { describe, expect, it } from "vitest";

import {
  WORLD_TEMPLATE_VERSION,
  type WorldTemplate,
} from "@/shared/worldTemplateSchema";

import { computeDryRunReport } from "./worldTemplateDryRun";

const BASE_TEMPLATE: WorldTemplate = {
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
  resource_categories: [{ name: "Food", color: "#4caf50", sort_order: 0 }],
  education_levels: [
    { name: "Basic", description: null, rank: 1, natural_born_percent: 10 },
  ],
  cultures: [{ name: "Highlanders", description: null, color: "#ab12ef" }],
  religions: [{ name: "Sun cult", description: null, color: "#f1c40f" }],
  resources: [
    {
      name: "Grain",
      slug: "grain",
      base_stockpile_cap: 1000,
      change_amount: -0.01,
      change_mode: "percent",
      is_system_resource: false,
      icon: null,
      category: "Food",
    },
    {
      name: "Wood",
      slug: "wood",
      base_stockpile_cap: 500,
      change_amount: 0.0,
      change_mode: "percent",
      is_system_resource: false,
      icon: null,
      category: null,
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
      icon: null,
      required_education_level: "Basic",
    },
    {
      name: "Tutor",
      slug: "tutor",
      job_type: "teacher",
      base_capacity: 5,
      trader_capacity_per_worker: null,
      inputs: [],
      outputs: [],
      icon: null,
      required_education_level: null,
    },
  ],
  blueprints: [
    {
      name: "Granary",
      slug: "granary",
      description: "Stores grain",
      max_instances_per_settlement: 2,
      grace_period_turns: 10,
      icon: null,
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
  deposit_types: [
    {
      name: "Iron Vein",
      slug: "iron-vein",
      job_slug: "farming",
      output_units_per_worker: 3,
      worker_inputs: [{ resource_slug: "grain", amount_per_worker: 1 }],
      icon: null,
    },
  ],
  managed_population_types: [
    {
      name: "Sheep",
      slug: "sheep",
      husbandry_job_slug: "farming",
      culling_job_slug: "farming",
      husbandry_workers_per_n_animals: 5,
      growth_rate: 0.05,
      maintenance_rules: [
        { resource_slug: "grain", amount_per_n_animals: 0.1 },
      ],
      culling_outputs: [],
      regular_outputs: [],
      icon: null,
    },
  ],
  unit_types: [
    {
      name: "Militia",
      description: null,
      soldiers_per_unit: 10,
      required_education_level: "Basic",
      required_building: { blueprint_slug: "granary", tier_number: 1 },
      recruitment_costs: [{ resource_slug: "wood", amount: 5 }],
      upkeep_costs: [{ resource_slug: "grain", amount: 1 }],
      desertion_rate: 0.05,
    },
  ],
};

function clone(template: WorldTemplate): WorldTemplate {
  return structuredClone(template);
}

describe("computeDryRunReport", () => {
  it("counts every v2 section on a full template", () => {
    const report = computeDryRunReport(BASE_TEMPLATE);
    expect(report.counts).toEqual({
      resourceCategories: 1,
      educationLevels: 1,
      cultures: 1,
      religions: 1,
      resources: 2,
      jobs: 2,
      blueprints: 1,
      blueprintTiers: 1,
      depositTypes: 1,
      managedPopulationTypes: 1,
      unitTypes: 1,
      namesets: 1,
    });
    expect(report.danglingRefs).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it("flags a resource referencing an unknown category", () => {
    const template = clone(BASE_TEMPLATE);
    template.resources[0].category = "Missing";
    const report = computeDryRunReport(template);
    expect(report.danglingRefs).toContain(
      'Resource "grain" references unknown category "Missing"',
    );
  });

  it("flags a job referencing an unknown education level", () => {
    const template = clone(BASE_TEMPLATE);
    template.jobs[0].required_education_level = "Missing";
    const report = computeDryRunReport(template);
    expect(report.danglingRefs).toContain(
      'Job "farming" references unknown education level "Missing"',
    );
  });

  it("flags an education effect with an unknown teacher job", () => {
    const template = clone(BASE_TEMPLATE);
    const effect = template.blueprints[0].tiers[0].effects[2];
    if (effect.type !== "education")
      throw new Error("expected education effect");
    effect.teacher_job_slug = "missing-job";
    const report = computeDryRunReport(template);
    expect(report.danglingRefs).toContain(
      'Blueprint "granary" tier 1 education effect references unknown job "missing-job"',
    );
  });

  it("flags an education effect whose job is not a teacher", () => {
    const template = clone(BASE_TEMPLATE);
    const effect = template.blueprints[0].tiers[0].effects[2];
    if (effect.type !== "education")
      throw new Error("expected education effect");
    effect.teacher_job_slug = "farming";
    const report = computeDryRunReport(template);
    expect(report.danglingRefs).toContain(
      'Blueprint "granary" tier 1 education effect job "farming" is not a teacher job',
    );
  });

  it("flags an education effect referencing unknown from/to levels", () => {
    const template = clone(BASE_TEMPLATE);
    const effect = template.blueprints[0].tiers[0].effects[2];
    if (effect.type !== "education")
      throw new Error("expected education effect");
    effect.levels = [
      { from_level: "Missing", to_level: "AlsoMissing", turns: 3 },
    ];
    const report = computeDryRunReport(template);
    expect(report.danglingRefs).toContain(
      'Blueprint "granary" tier 1 education effect references unknown education level "Missing"',
    );
    expect(report.danglingRefs).toContain(
      'Blueprint "granary" tier 1 education effect references unknown education level "AlsoMissing"',
    );
  });

  it("flags a unit type referencing an unknown education level", () => {
    const template = clone(BASE_TEMPLATE);
    template.unit_types[0].required_education_level = "Missing";
    const report = computeDryRunReport(template);
    expect(report.danglingRefs).toContain(
      'Unit type "Militia" references unknown education level "Missing"',
    );
  });

  it("flags a unit type referencing an unknown blueprint", () => {
    const template = clone(BASE_TEMPLATE);
    template.unit_types[0].required_building = {
      blueprint_slug: "missing-blueprint",
      tier_number: 1,
    };
    const report = computeDryRunReport(template);
    expect(report.danglingRefs).toContain(
      'Unit type "Militia" references unknown blueprint "missing-blueprint"',
    );
  });

  it("flags a unit type referencing an unknown blueprint tier", () => {
    const template = clone(BASE_TEMPLATE);
    template.unit_types[0].required_building = {
      blueprint_slug: "granary",
      tier_number: 9,
    };
    const report = computeDryRunReport(template);
    expect(report.danglingRefs).toContain(
      'Unit type "Militia" references unknown tier 9 of blueprint "granary"',
    );
  });

  it("flags a unit type referencing unknown cost resources", () => {
    const template = clone(BASE_TEMPLATE);
    template.unit_types[0].recruitment_costs = [
      { resource_slug: "missing-resource", amount: 5 },
    ];
    template.unit_types[0].upkeep_costs = [
      { resource_slug: "another-missing-resource", amount: 1 },
    ];
    const report = computeDryRunReport(template);
    expect(report.danglingRefs).toContain(
      'Unit type "Militia" recruitment cost references unknown resource "missing-resource"',
    );
    expect(report.danglingRefs).toContain(
      'Unit type "Militia" upkeep cost references unknown resource "another-missing-resource"',
    );
  });

  it("warns when natural_born_percent values sum over 100", () => {
    const template = clone(BASE_TEMPLATE);
    template.education_levels = [
      { name: "Basic", description: null, rank: 1, natural_born_percent: 60 },
      { name: "Scholar", description: null, rank: 2, natural_born_percent: 50 },
    ];
    const report = computeDryRunReport(template);
    expect(report.warnings).toContain(
      "Education level natural_born_percent values sum to 110, which is over 100",
    );
  });

  it("still flags pre-existing v1 dangling refs (job/resource/deposit/population)", () => {
    const template = clone(BASE_TEMPLATE);
    template.jobs[0].outputs = [
      { resource_slug: "missing-resource", amount_per_worker: 2 },
    ];
    template.deposit_types[0].job_slug = "missing-job";
    template.managed_population_types[0].husbandry_job_slug = "missing-job";
    const report = computeDryRunReport(template);
    expect(report.danglingRefs).toContain(
      'Job "farming" output references unknown resource "missing-resource"',
    );
    expect(report.danglingRefs).toContain(
      'Deposit type "iron-vein" references unknown job "missing-job"',
    );
    expect(report.danglingRefs).toContain(
      'Managed pop type "sheep" husbandry_job_slug references unknown job "missing-job"',
    );
  });
});
