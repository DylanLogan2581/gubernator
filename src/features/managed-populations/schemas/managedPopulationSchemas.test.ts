import { describe, expect, it } from "vitest";

import {
  createManagedPopulationTypeInputSchema,
  hardDeleteManagedPopulationTypeInputSchema,
  managedPopulationCullingJobSchema,
  managedPopulationHusbandryJobSchema,
  populationResourceEntrySchema,
  restoreManagedPopulationTypeInputSchema,
  softDeleteManagedPopulationTypeInputSchema,
  updateManagedPopulationTypeInputSchema,
} from "./managedPopulationSchemas";

const MANAGED_POPULATION_TYPE_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const HUSBANDRY_JOB_ID = "33333333-3333-3333-3333-333333333333";
const CULLING_JOB_ID = "44444444-4444-4444-4444-444444444444";
const HUSBANDRY_JOB_ID_2 = "66666666-6666-6666-6666-666666666666";
const CULLING_JOB_ID_2 = "77777777-7777-7777-7777-777777777777";
const RESOURCE_ID = "55555555-5555-5555-5555-555555555555";

const VALID_CREATE_INPUT = {
  cullingJobs: [{ jobId: CULLING_JOB_ID, maxCullPerWorker: 10 }],
  growthRate: 0.05,
  husbandryJobs: [{ jobId: HUSBANDRY_JOB_ID, workersPerNAnimals: 2 }],
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

describe("managedPopulationHusbandryJobSchema", () => {
  it("accepts a valid job entry", () => {
    const result = managedPopulationHusbandryJobSchema.safeParse({
      jobId: HUSBANDRY_JOB_ID,
      workersPerNAnimals: 2,
    });

    expect(result.success).toBe(true);
  });

  it("rejects workersPerNAnimals of zero", () => {
    const result = managedPopulationHusbandryJobSchema.safeParse({
      jobId: HUSBANDRY_JOB_ID,
      workersPerNAnimals: 0,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer workersPerNAnimals", () => {
    const result = managedPopulationHusbandryJobSchema.safeParse({
      jobId: HUSBANDRY_JOB_ID,
      workersPerNAnimals: 1.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid jobId", () => {
    const result = managedPopulationHusbandryJobSchema.safeParse({
      jobId: "not-a-uuid",
      workersPerNAnimals: 2,
    });

    expect(result.success).toBe(false);
  });
});

describe("managedPopulationCullingJobSchema", () => {
  it("accepts a valid job entry", () => {
    const result = managedPopulationCullingJobSchema.safeParse({
      jobId: CULLING_JOB_ID,
      maxCullPerWorker: 10,
    });

    expect(result.success).toBe(true);
  });

  it("accepts zero maxCullPerWorker", () => {
    const result = managedPopulationCullingJobSchema.safeParse({
      jobId: CULLING_JOB_ID,
      maxCullPerWorker: 0,
    });

    expect(result.success).toBe(true);
  });

  it("rejects negative maxCullPerWorker", () => {
    const result = managedPopulationCullingJobSchema.safeParse({
      jobId: CULLING_JOB_ID,
      maxCullPerWorker: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer maxCullPerWorker", () => {
    const result = managedPopulationCullingJobSchema.safeParse({
      jobId: CULLING_JOB_ID,
      maxCullPerWorker: 1.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid jobId", () => {
    const result = managedPopulationCullingJobSchema.safeParse({
      jobId: "not-a-uuid",
      maxCullPerWorker: 10,
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

  it("accepts input with multiple husbandry and culling jobs", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      cullingJobs: [
        { jobId: CULLING_JOB_ID, maxCullPerWorker: 10 },
        { jobId: CULLING_JOB_ID_2, maxCullPerWorker: 20 },
      ],
      husbandryJobs: [
        { jobId: HUSBANDRY_JOB_ID, workersPerNAnimals: 2 },
        { jobId: HUSBANDRY_JOB_ID_2, workersPerNAnimals: 4 },
      ],
    });

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

  it("rejects an empty husbandryJobs array", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      husbandryJobs: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty cullingJobs array", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      cullingJobs: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate jobIds within husbandryJobs", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      husbandryJobs: [
        { jobId: HUSBANDRY_JOB_ID, workersPerNAnimals: 2 },
        { jobId: HUSBANDRY_JOB_ID, workersPerNAnimals: 3 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate jobIds within cullingJobs", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      cullingJobs: [
        { jobId: CULLING_JOB_ID, maxCullPerWorker: 10 },
        { jobId: CULLING_JOB_ID, maxCullPerWorker: 20 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts the same jobId used as both a husbandry and a culling job", () => {
    const result = createManagedPopulationTypeInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      cullingJobs: [{ jobId: HUSBANDRY_JOB_ID, maxCullPerWorker: 10 }],
      husbandryJobs: [{ jobId: HUSBANDRY_JOB_ID, workersPerNAnimals: 2 }],
    });

    expect(result.success).toBe(true);
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

  it("accepts a partial update with only husbandryJobs", () => {
    const result = updateManagedPopulationTypeInputSchema.safeParse({
      husbandryJobs: [{ jobId: HUSBANDRY_JOB_ID, workersPerNAnimals: 3 }],
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only cullingJobs", () => {
    const result = updateManagedPopulationTypeInputSchema.safeParse({
      cullingJobs: [{ jobId: CULLING_JOB_ID, maxCullPerWorker: 15 }],
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty husbandryJobs array on update", () => {
    const result = updateManagedPopulationTypeInputSchema.safeParse({
      husbandryJobs: [],
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty cullingJobs array on update", () => {
    const result = updateManagedPopulationTypeInputSchema.safeParse({
      cullingJobs: [],
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
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
});

describe("softDeleteManagedPopulationTypeInputSchema", () => {
  it("accepts a valid request", () => {
    const result = softDeleteManagedPopulationTypeInputSchema.safeParse({
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid managedPopulationTypeId", () => {
    const result = softDeleteManagedPopulationTypeInputSchema.safeParse({
      managedPopulationTypeId: "not-a-uuid",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = softDeleteManagedPopulationTypeInputSchema.safeParse({
      extra: "field",
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("restoreManagedPopulationTypeInputSchema", () => {
  it("accepts a valid request", () => {
    const result = restoreManagedPopulationTypeInputSchema.safeParse({
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid managedPopulationTypeId", () => {
    const result = restoreManagedPopulationTypeInputSchema.safeParse({
      managedPopulationTypeId: "not-a-uuid",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("hardDeleteManagedPopulationTypeInputSchema", () => {
  it("accepts a valid request", () => {
    const result = hardDeleteManagedPopulationTypeInputSchema.safeParse({
      managedPopulationTypeId: MANAGED_POPULATION_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid managedPopulationTypeId", () => {
    const result = hardDeleteManagedPopulationTypeInputSchema.safeParse({
      managedPopulationTypeId: "not-a-uuid",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});
