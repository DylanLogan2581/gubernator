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
const MANAGED_POP_ID = "00000000-0000-0000-0000-000000000050";
const HUSBANDRY_JOB_ID = "00000000-0000-0000-0000-000000000021";
const CULLING_JOB_ID = "00000000-0000-0000-0000-000000000022";
const NAMESET_ID = "00000000-0000-0000-0000-000000000060";
const EXPORTED_AT = "2026-06-17T00:00:00.000Z";

const CALENDAR_CONFIG = {
  dateFormatTemplate: "{weekday}, {day} {month} {year}",
  months: [{ dayCount: 30, index: 0, name: "Firstmonth" }],
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
    resources: [
      {
        id: RESOURCE_ID,
        name: "Grain",
        slug: "grain",
        base_stockpile_cap: 1000,
        decay_rate: 0.01,
        is_system_resource: false,
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
            ],
          },
        ],
      },
    ],
    depositTypes: [
      {
        id: DEPOSIT_TYPE_ID,
        name: "Iron Vein",
        slug: "iron-vein",
        job_id: JOB_ID,
        output_units_per_worker: 3,
        worker_inputs_json: [{ resource_id: RESOURCE_ID, amount_per_worker: 1 }],
        is_trashed: false,
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
        is_trashed: false,
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

  it("resolves deposit type job_id to job_slug", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    expect(template.deposit_types[0]).toMatchObject({
      slug: "iron-vein",
      job_slug: "farming",
      output_units_per_worker: 3,
    });
  });

  it("resolves managed population job ids to job slugs", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    expect(template.managed_population_types[0]).toMatchObject({
      slug: "sheep",
      husbandry_job_slug: "husbandry",
      culling_job_slug: "culling",
    });
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

  it("drops deposit types whose job is unresolvable", () => {
    const base = makeMinimalData();
    const data: WorldConfigData = {
      ...base,
      jobs: base.jobs.map((j) => ({ ...j, is_trashed: true })),
    };
    const template = assembleWorldTemplate(data);
    // all jobs are trashed → deposit type's job_id unresolvable → dropped
    expect(template.deposit_types).toHaveLength(0);
  });

  it("includes template_version 1", () => {
    const template = assembleWorldTemplate(makeMinimalData());
    expect(template.template_version).toBe(1);
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
