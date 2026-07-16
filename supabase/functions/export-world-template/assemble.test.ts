import { describe, expect, it } from "vitest";

import { worldTemplateSchema } from "@/shared/worldTemplateSchema";

import { assembleWorldTemplate } from "./assemble";

import type { WorldConfigData } from "./types";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const RESOURCE_ID = "00000000-0000-0000-0000-000000000010";
const JOB_ID = "00000000-0000-0000-0000-000000000020";
const BLUEPRINT_ID = "00000000-0000-0000-0000-000000000030";
const DEPOSIT_TYPE_ID = "00000000-0000-0000-0000-000000000040";
const DEPOSIT_TYPE_JOB_ID = "00000000-0000-0000-0000-000000000041";
const MANAGED_POP_ID = "00000000-0000-0000-0000-000000000050";
const HUSBANDRY_JOB_ID = "00000000-0000-0000-0000-000000000021";
const CULLING_JOB_ID = "00000000-0000-0000-0000-000000000022";
const TEACHER_JOB_ID = "00000000-0000-0000-0000-000000000023";
const NAMESET_ID = "00000000-0000-0000-0000-000000000060";
const CATEGORY_ID = "00000000-0000-0000-0000-000000000070";
const EDU_LEVEL_BASIC_ID = "00000000-0000-0000-0000-000000000080";
const EDU_LEVEL_SCHOLAR_ID = "00000000-0000-0000-0000-000000000081";
const CULTURE_ID = "00000000-0000-0000-0000-000000000090";
const RELIGION_ID = "00000000-0000-0000-0000-0000000000a0";
const UNIT_TYPE_ID = "00000000-0000-0000-0000-0000000000b0";
const EXPORTED_AT = "2026-06-17T00:00:00.000Z";

const CALENDAR_CONFIG = {
  dateFormatTemplate: "{weekday}, {day} {month} {year}",
  months: [{ dayCount: 30, index: 0, name: "Firstmonth" }],
  shortDateFormatTemplate: "{monthNumber}/{dayNumber}/{yearNumber}",
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
};

const NPC_FLAVOR_CONFIG = {
  contradictions: ["brave but cowardly"],
  flaws: ["stubborn"],
  goals: ["find glory"],
  traits: ["curious"],
};

const NAMING_CONFIG = {
  convention: "family-name" as const,
  female_given_names: ["Alice"],
  male_given_names: ["Bob"],
  surnames: ["Smith"],
};

function makeMinimalData(): WorldConfigData {
  return {
    world: {
      id: WORLD_ID,
      name: "Test World",
      calendar_config_json: CALENDAR_CONFIG,
      naming_config_json: NAMING_CONFIG,
      npc_flavor_config_json: NPC_FLAVOR_CONFIG,
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
    resourceCategories: [
      { id: CATEGORY_ID, name: "Food", color: "#22c55e", sort_order: 0 },
    ],
    educationLevels: [
      {
        id: EDU_LEVEL_BASIC_ID,
        name: "Basic",
        description: "Can read and write",
        rank: 1,
        natural_born_percent: 10,
      },
      {
        id: EDU_LEVEL_SCHOLAR_ID,
        name: "Scholar",
        description: null,
        rank: 2,
        natural_born_percent: 0,
      },
    ],
    cultures: [{ id: CULTURE_ID, name: "Highlander", description: "Mountain folk", color: "#6b7280" }],
    religions: [{ id: RELIGION_ID, name: "Sun Cult", description: null, color: "#f59e0b" }],
    resources: [
      {
        id: RESOURCE_ID,
        name: "Grain",
        slug: "grain",
        base_stockpile_cap: 1000,
        change_amount: -0.01,
        change_mode: "percent",
        is_system_resource: false,
        icon: "wheat",
        icon_color: 1,
        category_id: CATEGORY_ID,
        is_trashed: false,
      },
    ],
    jobs: [
      {
        id: JOB_ID,
        name: "Farming",
        slug: "farming",
        job_type: "standard",
        base_capacity: 10,
        trader_capacity_per_worker: null,
        inputs_json: [],
        outputs_json: [{ resource_id: RESOURCE_ID, amount_per_worker: 2 }],
        icon: "tractor",
        icon_color: 2,
        required_education_level_id: EDU_LEVEL_BASIC_ID,
        is_trashed: false,
      },
      {
        id: HUSBANDRY_JOB_ID,
        name: "Husbandry",
        slug: "husbandry",
        job_type: "husbandry",
        base_capacity: 5,
        trader_capacity_per_worker: null,
        inputs_json: [],
        outputs_json: [],
        icon: null,
        icon_color: null,
        required_education_level_id: null,
        is_trashed: false,
      },
      {
        id: CULLING_JOB_ID,
        name: "Culling",
        slug: "culling",
        job_type: "culling",
        base_capacity: 5,
        trader_capacity_per_worker: null,
        inputs_json: [],
        outputs_json: [],
        icon: null,
        icon_color: null,
        required_education_level_id: null,
        is_trashed: false,
      },
      {
        id: TEACHER_JOB_ID,
        name: "Teacher",
        slug: "teacher",
        job_type: "teacher",
        base_capacity: 2,
        trader_capacity_per_worker: null,
        inputs_json: [],
        outputs_json: [],
        icon: null,
        icon_color: null,
        required_education_level_id: null,
        is_trashed: false,
      },
    ],
    blueprints: [
      {
        id: BLUEPRINT_ID,
        name: "Granary",
        slug: "granary",
        description: "Stores grain",
        max_instances_per_settlement: 2,
        grace_period_turns: 10,
        icon: "house",
        icon_color: 3,
        is_trashed: false,
        building_blueprint_tiers: [
          {
            building_blueprint_id: BLUEPRINT_ID,
            tier_number: 1,
            worker_turns_required: 100,
            construction_costs_json: [{ resource_id: RESOURCE_ID, amount: 50 }],
            upkeep_costs_json: [],
            effects_json: [
              { type: "resource_storage_increase", resource_id: RESOURCE_ID, amount: 500 },
              {
                type: "education",
                teacher_job_id: TEACHER_JOB_ID,
                teacher_capacity: 2,
                students_per_teacher: 10,
                levels: [
                  { from_level_id: null, to_level_id: EDU_LEVEL_BASIC_ID, turns: 5 },
                  {
                    from_level_id: EDU_LEVEL_BASIC_ID,
                    to_level_id: EDU_LEVEL_SCHOLAR_ID,
                    turns: 10,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    depositTypes: [
      {
        deposit_type_jobs: [
          {
            deposit_type_id: DEPOSIT_TYPE_ID,
            id: DEPOSIT_TYPE_JOB_ID,
            job_id: JOB_ID,
            output_units_per_worker: 3,
            worker_inputs_json: [{ resource_id: RESOURCE_ID, amount_per_worker: 1 }],
          },
        ],
        icon: "pickaxe",
        icon_color: 4,
        id: DEPOSIT_TYPE_ID,
        is_trashed: false,
        name: "Iron Vein",
        slug: "iron-vein",
      },
    ],
    managedPopulationTypes: [
      {
        id: MANAGED_POP_ID,
        name: "Sheep",
        slug: "sheep",
        husbandry_job_id: HUSBANDRY_JOB_ID,
        culling_job_id: CULLING_JOB_ID,
        husbandry_workers_per_n_animals: 5,
        growth_rate: 0.05,
        maintenance_rules_json: [{ resource_id: RESOURCE_ID, amount_per_n_animals: 0.1 }],
        culling_outputs_json: [],
        regular_outputs_json: [],
        icon: "sheep",
        icon_color: 5,
        is_trashed: false,
      },
    ],
    unitTypes: [
      {
        id: UNIT_TYPE_ID,
        name: "Spearman",
        description: "Basic levy",
        soldiers_per_unit: 20,
        required_education_level_id: EDU_LEVEL_BASIC_ID,
        required_building_blueprint_id: BLUEPRINT_ID,
        required_building_tier_number: 1,
        recruitment_costs_json: [{ resource_id: RESOURCE_ID, amount: 10 }],
        upkeep_costs_json: [{ resource_id: RESOURCE_ID, amount: 1 }],
        desertion_rate: 0.05,
      },
    ],
    namesets: [
      {
        id: NAMESET_ID,
        name: "Default Names",
        config_json: NAMING_CONFIG,
        is_default: true,
        is_trashed: false,
      },
    ],
    exportedAt: EXPORTED_AT,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("assembleWorldTemplate", () => {
  it("produces output that validates against worldTemplateSchema", () => {
    const data = makeMinimalData();
    const template = assembleWorldTemplate(data);
    const result = worldTemplateSchema.safeParse(template);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("is byte-stable for the same input (deterministic ordering)", () => {
    const data = makeMinimalData();
    const first = JSON.stringify(assembleWorldTemplate(data));
    const second = JSON.stringify(assembleWorldTemplate(data));
    expect(first).toBe(second);
  });

  it("excludes no-UUID cross-references — uses slugs not IDs", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    const serialized = JSON.stringify(template);
    // No raw UUIDs should appear in the output
    expect(serialized).not.toContain(RESOURCE_ID);
    expect(serialized).not.toContain(JOB_ID);
    expect(serialized).not.toContain(BLUEPRINT_ID);
    expect(serialized).not.toContain(DEPOSIT_TYPE_ID);
    expect(serialized).not.toContain(MANAGED_POP_ID);
    expect(serialized).not.toContain(NAMESET_ID);
    expect(serialized).not.toContain(WORLD_ID);
    expect(serialized).not.toContain(HUSBANDRY_JOB_ID);
    expect(serialized).not.toContain(CULLING_JOB_ID);
    expect(serialized).not.toContain(TEACHER_JOB_ID);
    expect(serialized).not.toContain(CATEGORY_ID);
    expect(serialized).not.toContain(EDU_LEVEL_BASIC_ID);
    expect(serialized).not.toContain(EDU_LEVEL_SCHOLAR_ID);
    expect(serialized).not.toContain(UNIT_TYPE_ID);
  });

  it("resolves job io resource_id to resource_slug", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    expect(template.jobs[0]?.outputs[0]).toMatchObject({
      resource_slug: "grain",
      amount_per_worker: 2,
    });
  });

  it("resolves tier cost resource_id to resource_slug", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    expect(template.blueprints[0]?.tiers[0]?.construction_costs[0]).toMatchObject({
      resource_slug: "grain",
      amount: 50,
    });
  });

  it("resolves tier effect resource_id to resource_slug", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    const effect = template.blueprints[0]?.tiers[0]?.effects[0];
    expect(effect).toMatchObject({
      type: "resource_storage_increase",
      resource_slug: "grain",
      amount: 500,
    });
  });

  it("resolves education tier effect teacher job and level names", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    const effect = template.blueprints[0]?.tiers[0]?.effects[1];
    expect(effect).toMatchObject({
      type: "education",
      teacher_job_slug: "teacher",
      teacher_capacity: 2,
      students_per_teacher: 10,
      levels: [
        { from_level: null, to_level: "Basic", turns: 5 },
        { from_level: "Basic", to_level: "Scholar", turns: 10 },
      ],
    });
  });

  it("resolves deposit type job_id to job_slug", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    expect(template.deposit_types[0]).toMatchObject({
      slug: "iron-vein",
      icon: "pickaxe",
      jobs: [
        {
          job_slug: "farming",
          output_units_per_worker: 3,
        },
      ],
    });
  });

  it("resolves managed population job ids to job slugs", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    expect(template.managed_population_types[0]).toMatchObject({
      slug: "sheep",
      husbandry_job_slug: "husbandry",
      culling_job_slug: "culling",
      icon: "sheep",
    });
  });

  it("resolves resource category_id to category name", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    expect(template.resources[0]).toMatchObject({
      slug: "grain",
      icon: "wheat",
      category: "Food",
    });
  });

  it("resolves job required_education_level_id to level name", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    expect(template.jobs[0]).toMatchObject({
      slug: "farming",
      icon: "tractor",
      required_education_level: "Basic",
    });
  });

  it("includes resource_categories, education_levels, cultures, religions", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    expect(template.resource_categories).toEqual([
      { name: "Food", color: "#22c55e", sort_order: 0 },
    ]);
    expect(template.education_levels).toEqual([
      { name: "Basic", description: "Can read and write", rank: 1, natural_born_percent: 10 },
      { name: "Scholar", description: null, rank: 2, natural_born_percent: 0 },
    ]);
    expect(template.cultures).toEqual([
      { name: "Highlander", description: "Mountain folk", color: "#6b7280" },
    ]);
    expect(template.religions).toEqual([
      { name: "Sun Cult", description: null, color: "#f59e0b" },
    ]);
  });

  it("resolves unit type education level and required building references", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    expect(template.unit_types[0]).toMatchObject({
      name: "Spearman",
      required_education_level: "Basic",
      required_building: { blueprint_slug: "granary", tier_number: 1 },
      recruitment_costs: [{ resource_slug: "grain", amount: 10 }],
      upkeep_costs: [{ resource_slug: "grain", amount: 1 }],
      desertion_rate: 0.05,
    });
  });

  it("preserves shortDateFormatTemplate through calendar passthrough", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    expect(
      (template.calendar as { shortDateFormatTemplate?: string }).shortDateFormatTemplate,
    ).toBe("{monthNumber}/{dayNumber}/{yearNumber}");
  });

  it("drops trashed items from all collections", () => {
    const base = makeMinimalData();
    const data: WorldConfigData = {
      ...base,
      resources: base.resources.map((r) => ({ ...r, is_trashed: true })),
      jobs: base.jobs.map((j) => ({ ...j, is_trashed: true })),
      blueprints: base.blueprints.map((b) => ({ ...b, is_trashed: true })),
      depositTypes: base.depositTypes.map((d) => ({ ...d, is_trashed: true })),
      managedPopulationTypes: base.managedPopulationTypes.map((m) => ({ ...m, is_trashed: true })),
      namesets: base.namesets.map((n) => ({ ...n, is_trashed: true })),
    };

    const template = assembleWorldTemplate(data);
    expect(template.resources).toHaveLength(0);
    expect(template.blueprints).toHaveLength(0);
    expect(template.deposit_types).toHaveLength(0);
    expect(template.namesets).toHaveLength(0);
  });

  it("drops a deposit type job whose job is unresolvable", () => {
    const base = makeMinimalData();
    const data: WorldConfigData = {
      ...base,
      jobs: base.jobs.map((j) => ({ ...j, is_trashed: true })),
    };
    const template = assembleWorldTemplate(data);
    // all jobs are trashed → deposit type job's job_id unresolvable → dropped,
    // but the deposit type itself remains (with no jobs).
    expect(template.deposit_types).toHaveLength(1);
    expect(template.deposit_types[0]?.jobs).toHaveLength(0);
  });

  it("drops education tier effect entirely when teacher job is unresolvable", () => {
    const base = makeMinimalData();
    const data: WorldConfigData = {
      ...base,
      jobs: base.jobs.map((j) => (j.id === TEACHER_JOB_ID ? { ...j, is_trashed: true } : j)),
    };
    const template = assembleWorldTemplate(data);
    const effects = template.blueprints[0]?.tiers[0]?.effects ?? [];
    expect(effects.some((e) => e.type === "education")).toBe(false);
  });

  it("includes template_version 2", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    expect(template.template_version).toBe(2);
  });

  it("includes exported_at in meta", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    expect(template.meta.exported_at).toBe(EXPORTED_AT);
  });

  it("derives world slug from name and id", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    // name="Test World", id starts with "00000000-..."
    expect(template.meta.slug).toMatch(/^test-world-/);
  });
});
