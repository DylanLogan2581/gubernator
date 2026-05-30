import { describe, expect, it } from "vitest";

import {
  createManagedPopulationTypeInputSchema,
  populationResourceEntrySchema,
  setManagedPopulationTypeActiveInputSchema,
  updateManagedPopulationTypeInputSchema,
} from "./managedPopulationSchemas";

const MANAGED_POPULATION_TYPE_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const HUSBANDRY_JOB_ID = "33333333-3333-3333-3333-333333333333";
const CULLING_JOB_ID = "44444444-4444-4444-4444-444444444444";
const RESOURCE_ID = "55555555-5555-5555-5555-555555555555";

const VALID_CREATE_INPUT = {
  cullingJobId: CULLING_JOB_ID,
  growthRate: 0.05,
  husbandryJobId: HUSBANDRY_JOB_ID,
  husbandryWorkersPerNAnimals: 2,
  name: "Cattle",
  slug: "cattle",
  worldId: WORLD_ID,
};

describe("populationResourceEntrySchema", () => {
  it("accepts a valid entry", () => {
    const result = populationResourceEntrySchema.safeParse({
      amountPerNAnimals: 3,
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts zero amountPerNAnimals", () => {
    const result = populationResourceEntrySchema.safeParse({
      amountPerNAnimals: 0,
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects negative amountPerNAnimals", () => {
    const result = populationResourceEntrySchema.safeParse({
      amountPerNAnimals: -1,
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.amountPerNAnimals).toContain(
        "Amount per N animals must be non-negative.",
      );
    }
  });

  it("rejects an invalid resourceId", () => {
    const result = populationResourceEntrySchema.safeParse({
      amountPerNAnimals: 1,
      resourceId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = populationResourceEntrySchema.safeParse({
      amountPerNAnimals: 1,
      extra: "field",
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("createManagedPopulationTypeInputSchema", () => {
  it("accepts a valid minimal input", () => {
    const result =
      createManagedPopulationTypeInputSchema.safeParse(VALID_CREATE_INPUT);

    expect(result.success).toBe(true);
  });

  it("accepts input with maintenanceRulesJson", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      maintenanceRulesJson: [{ amountPerNAnimals: 2, resourceId: RESOURCE_ID }],
    });

    expect(result.success).toBe(true);
  });

  it("accepts input with cullingOutputsJson", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      cullingOutputsJson: [{ amountPerNAnimals: 5, resourceId: RESOURCE_ID }],
    });

    expect(result.success).toBe(true);
  });

  it("accepts input with empty maintenanceRulesJson", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      maintenanceRulesJson: [],
    });

    expect(result.success).toBe(true);
  });

  it("accepts zero growthRate", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      growthRate: 0,
    });

    expect(result.success).toBe(true);
  });

  it("rejects negative growthRate", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      growthRate: -0.01,
    });

    expect(result.success).toBe(false);
  });

  it("rejects husbandryWorkersPerNAnimals of zero", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      husbandryWorkersPerNAnimals: 0,
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-integer husbandryWorkersPerNAnimals", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      husbandryWorkersPerNAnimals: 1.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a blank name", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      name: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a name that is too long", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      name: "a".repeat(65),
    });

    expect(result.success).toBe(false);
  });

  it("rejects a blank slug", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      slug: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid husbandryJobId", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      husbandryJobId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid cullingJobId", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      cullingJobId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid worldId", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      worldId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      extra: "field",
    });

    expect(result.success).toBe(false);
  });

  it("rejects when husbandryJobId equals cullingJobId", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      cullingJobId: HUSBANDRY_JOB_ID,
      husbandryJobId: HUSBANDRY_JOB_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.cullingJobId).toContain(
        "Husbandry job and culling job must be different.",
      );
    }
  });
});

describe("updateManagedPopulationTypeInputSchema", () => {
  it("accepts a partial update with only name", () => {
    const result = updateManagedPopulationTypeInputSchema.safeParse({
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      name: "Updated Name",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only growthRate", () => {
    const result = updateManagedPopulationTypeInputSchema.safeParse({
      growthRate: 0.1,
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only maintenanceRulesJson", () => {
    const result = updateManagedPopulationTypeInputSchema.safeParse({
      maintenanceRulesJson: [{ amountPerNAnimals: 1, resourceId: RESOURCE_ID }],
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an update with no updatable fields", () => {
    const result = updateManagedPopulationTypeInputSchema.safeParse({
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "At least one field must be provided.",
      );
    }
  });

  it("rejects an invalid managedPopulationTypeId", () => {
    const result = updateManagedPopulationTypeInputSchema.safeParse({
      managedPopulationTypeId: "not-a-uuid",
      name: "Updated Name",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = updateManagedPopulationTypeInputSchema.safeParse({
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      name: "Updated Name",
      unknownField: "value",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects when both job ids are provided and equal", () => {
    const result = updateManagedPopulationTypeInputSchema.safeParse({
      cullingJobId: HUSBANDRY_JOB_ID,
      husbandryJobId: HUSBANDRY_JOB_ID,
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.cullingJobId).toContain(
        "Husbandry job and culling job must be different.",
      );
    }
  });

  it("accepts when only one job id is provided", () => {
    const result = updateManagedPopulationTypeInputSchema.safeParse({
      husbandryJobId: HUSBANDRY_JOB_ID,
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });
});

describe("setManagedPopulationTypeActiveInputSchema", () => {
  it("accepts a valid set-active request", () => {
    const result = setManagedPopulationTypeActiveInputSchema.safeParse({
      isActive: true,
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts isActive: false", () => {
    const result = setManagedPopulationTypeActiveInputSchema.safeParse({
      isActive: false,
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a non-boolean isActive", () => {
    const result = setManagedPopulationTypeActiveInputSchema.safeParse({
      isActive: "true",
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid managedPopulationTypeId", () => {
    const result = setManagedPopulationTypeActiveInputSchema.safeParse({
      isActive: true,
      managedPopulationTypeId: "not-a-uuid",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = setManagedPopulationTypeActiveInputSchema.safeParse({
      extra: "field",
      isActive: true,
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});
