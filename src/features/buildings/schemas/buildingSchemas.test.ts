import { describe, expect, it } from "vitest";

import {
  createBlueprintInputSchema,
  createTierInputSchema,
  deleteTierInputSchema,
  setBlueprintActiveInputSchema,
  tierCostEntrySchema,
  tierEffectSchema,
  updateBlueprintInputSchema,
  updateTierInputSchema,
} from "./buildingSchemas";

const BLUEPRINT_ID = "11111111-1111-1111-1111-111111111111";
const TIER_ID = "22222222-2222-2222-2222-222222222222";
const WORLD_ID = "33333333-3333-3333-3333-333333333333";
const RESOURCE_ID = "44444444-4444-4444-4444-444444444444";
const JOB_ID = "55555555-5555-5555-5555-555555555555";

describe("tierCostEntrySchema", () => {
  it("accepts a valid cost entry", () => {
    const result = tierCostEntrySchema.safeParse({
      amount: 10,
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts zero amount", () => {
    const result = tierCostEntrySchema.safeParse({
      amount: 0,
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects negative amount", () => {
    const result = tierCostEntrySchema.safeParse({
      amount: -1,
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.amount).toContain(
        "Amount must be non-negative.",
      );
    }
  });

  it("rejects an invalid resourceId", () => {
    const result = tierCostEntrySchema.safeParse({
      amount: 5,
      resourceId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = tierCostEntrySchema.safeParse({
      amount: 5,
      extra: "field",
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("tierEffectSchema — discrimination across all four types", () => {
  it("accepts a valid job_capacity_increase effect", () => {
    const result = tierEffectSchema.safeParse({
      amount: 5,
      jobId: JOB_ID,
      type: "job_capacity_increase",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("job_capacity_increase");
    }
  });

  it("accepts a valid passive_resource_production effect", () => {
    const result = tierEffectSchema.safeParse({
      amount: 3,
      resourceId: RESOURCE_ID,
      type: "passive_resource_production",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("passive_resource_production");
    }
  });

  it("accepts a valid resource_storage_increase effect", () => {
    const result = tierEffectSchema.safeParse({
      amount: 100,
      resourceId: RESOURCE_ID,
      type: "resource_storage_increase",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("resource_storage_increase");
    }
  });

  it("accepts a valid population_cap_increase effect", () => {
    const result = tierEffectSchema.safeParse({
      amount: 50,
      type: "population_cap_increase",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("population_cap_increase");
    }
  });

  it("rejects an unknown effect type", () => {
    const result = tierEffectSchema.safeParse({
      amount: 10,
      type: "unknown_effect",
    });

    expect(result.success).toBe(false);
  });

  it("rejects job_capacity_increase without jobId", () => {
    const result = tierEffectSchema.safeParse({
      amount: 5,
      type: "job_capacity_increase",
    });

    expect(result.success).toBe(false);
  });

  it("rejects passive_resource_production without resourceId", () => {
    const result = tierEffectSchema.safeParse({
      amount: 3,
      type: "passive_resource_production",
    });

    expect(result.success).toBe(false);
  });

  it("rejects resource_storage_increase without resourceId", () => {
    const result = tierEffectSchema.safeParse({
      amount: 100,
      type: "resource_storage_increase",
    });

    expect(result.success).toBe(false);
  });

  it("rejects population_cap_increase with extra fields (strict)", () => {
    const result = tierEffectSchema.safeParse({
      amount: 50,
      resourceId: RESOURCE_ID,
      type: "population_cap_increase",
    });

    expect(result.success).toBe(false);
  });

  it("rejects job_capacity_increase with extra resourceId field (strict)", () => {
    const result = tierEffectSchema.safeParse({
      amount: 5,
      jobId: JOB_ID,
      resourceId: RESOURCE_ID,
      type: "job_capacity_increase",
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative amount on any effect type", () => {
    const result = tierEffectSchema.safeParse({
      amount: -1,
      type: "population_cap_increase",
    });

    expect(result.success).toBe(false);
  });
});

describe("createBlueprintInputSchema", () => {
  it("accepts a valid blueprint", () => {
    const result = createBlueprintInputSchema.safeParse({
      name: "Stone Wall",
      slug: "stone-wall",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a blank name", () => {
    const result = createBlueprintInputSchema.safeParse({
      name: "   ",
      slug: "stone-wall",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a name that is too long", () => {
    const result = createBlueprintInputSchema.safeParse({
      name: "a".repeat(65),
      slug: "stone-wall",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a blank slug", () => {
    const result = createBlueprintInputSchema.safeParse({
      name: "Stone Wall",
      slug: "   ",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid worldId", () => {
    const result = createBlueprintInputSchema.safeParse({
      name: "Stone Wall",
      slug: "stone-wall",
      worldId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = createBlueprintInputSchema.safeParse({
      extra: "field",
      name: "Stone Wall",
      slug: "stone-wall",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("updateBlueprintInputSchema", () => {
  it("accepts a partial update with only name", () => {
    const result = updateBlueprintInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      name: "Iron Gate",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only slug", () => {
    const result = updateBlueprintInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      slug: "iron-gate",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts an update with both name and slug", () => {
    const result = updateBlueprintInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      name: "Iron Gate",
      slug: "iron-gate",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an update with no updatable fields", () => {
    const result = updateBlueprintInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "At least one field must be provided.",
      );
    }
  });

  it("rejects an invalid blueprintId", () => {
    const result = updateBlueprintInputSchema.safeParse({
      blueprintId: "not-a-uuid",
      name: "Iron Gate",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("setBlueprintActiveInputSchema", () => {
  it("accepts isActive: true", () => {
    const result = setBlueprintActiveInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      isActive: true,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts isActive: false", () => {
    const result = setBlueprintActiveInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      isActive: false,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a non-boolean isActive", () => {
    const result = setBlueprintActiveInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      isActive: "true",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("createTierInputSchema", () => {
  it("accepts a minimal valid tier", () => {
    const result = createTierInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      tierNumber: 1,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a tier with all optional fields", () => {
    const result = createTierInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      constructionCostsJson: [{ amount: 10, resourceId: RESOURCE_ID }],
      effectsJson: [
        { amount: 50, type: "population_cap_increase" },
        { amount: 5, jobId: JOB_ID, type: "job_capacity_increase" },
      ],
      tierNumber: 2,
      upkeepCostsJson: [{ amount: 2, resourceId: RESOURCE_ID }],
      workerTurnsRequired: 100,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a tier number below 1", () => {
    const result = createTierInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      tierNumber: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.tierNumber).toContain(
        "Tier number must be at least 1.",
      );
    }
  });

  it("rejects a non-integer tier number", () => {
    const result = createTierInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      tierNumber: 1.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative workerTurnsRequired", () => {
    const result = createTierInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      tierNumber: 1,
      workerTurnsRequired: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid effect in effectsJson", () => {
    const result = createTierInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      effectsJson: [{ amount: 5, type: "bad_type" }],
      tierNumber: 1,
    });

    expect(result.success).toBe(false);
  });
});

describe("updateTierInputSchema", () => {
  it("accepts a partial update with only workerTurnsRequired", () => {
    const result = updateTierInputSchema.safeParse({
      tierId: TIER_ID,
      workerTurnsRequired: 200,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only constructionCostsJson", () => {
    const result = updateTierInputSchema.safeParse({
      constructionCostsJson: [{ amount: 5, resourceId: RESOURCE_ID }],
      tierId: TIER_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only effectsJson", () => {
    const result = updateTierInputSchema.safeParse({
      effectsJson: [{ amount: 50, type: "population_cap_increase" }],
      tierId: TIER_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an update with no updatable fields", () => {
    const result = updateTierInputSchema.safeParse({
      tierId: TIER_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.workerTurnsRequired).toContain(
        "At least one field must be provided.",
      );
    }
  });

  it("rejects an invalid tierId", () => {
    const result = updateTierInputSchema.safeParse({
      tierId: "not-a-uuid",
      workerTurnsRequired: 50,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = updateTierInputSchema.safeParse({
      extra: "field",
      tierId: TIER_ID,
      workerTurnsRequired: 50,
    });

    expect(result.success).toBe(false);
  });
});

describe("deleteTierInputSchema", () => {
  it("accepts a valid delete request", () => {
    const result = deleteTierInputSchema.safeParse({
      tierId: TIER_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid tierId", () => {
    const result = deleteTierInputSchema.safeParse({
      tierId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = deleteTierInputSchema.safeParse({
      extra: "field",
      tierId: TIER_ID,
    });

    expect(result.success).toBe(false);
  });
});
