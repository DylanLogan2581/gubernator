import { describe, expect, it } from "vitest";

import {
  createUnitTypeInputSchema,
  deleteUnitTypeInputSchema,
  updateUnitTypeInputSchema,
} from "./unitTypeSchemas";

const UNIT_TYPE_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const EDUCATION_LEVEL_ID = "33333333-3333-3333-3333-333333333333";
const BLUEPRINT_ID = "44444444-4444-4444-4444-444444444444";
const RESOURCE_ID = "55555555-5555-5555-5555-555555555555";

const baseCreateInput = {
  desertionRate: 0.1,
  name: "Levy",
  soldiersPerUnit: 10,
  worldId: WORLD_ID,
};

describe("createUnitTypeInputSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = createUnitTypeInputSchema.safeParse(baseCreateInput);
    expect(result.success).toBe(true);
  });

  it("accepts a full payload with requirements and costs", () => {
    const result = createUnitTypeInputSchema.safeParse({
      ...baseCreateInput,
      description: "Cheap conscripts.",
      recruitmentCostsJson: [{ amount: 5, resourceId: RESOURCE_ID }],
      requiredBuildingBlueprintId: BLUEPRINT_ID,
      requiredBuildingTierNumber: 1,
      requiredEducationLevelId: EDUCATION_LEVEL_ID,
      upkeepCostsJson: [{ amount: 1, resourceId: RESOURCE_ID }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank name", () => {
    const result = createUnitTypeInputSchema.safeParse({
      ...baseCreateInput,
      name: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "Unit type name is required.",
      );
    }
  });

  it("rejects soldiersPerUnit of zero", () => {
    const result = createUnitTypeInputSchema.safeParse({
      ...baseCreateInput,
      soldiersPerUnit: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a desertion rate above 1", () => {
    const result = createUnitTypeInputSchema.safeParse({
      ...baseCreateInput,
      desertionRate: 1.1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative desertion rate", () => {
    const result = createUnitTypeInputSchema.safeParse({
      ...baseCreateInput,
      desertionRate: -0.1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a building blueprint without a tier number", () => {
    const result = createUnitTypeInputSchema.safeParse({
      ...baseCreateInput,
      requiredBuildingBlueprintId: BLUEPRINT_ID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a tier number without a building blueprint", () => {
    const result = createUnitTypeInputSchema.safeParse({
      ...baseCreateInput,
      requiredBuildingTierNumber: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid resource id in recruitment costs", () => {
    const result = createUnitTypeInputSchema.safeParse({
      ...baseCreateInput,
      recruitmentCostsJson: [{ amount: 5, resourceId: "not-a-uuid" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateUnitTypeInputSchema", () => {
  it("accepts a partial update with a single field", () => {
    const result = updateUnitTypeInputSchema.safeParse({
      name: "Spearman",
      unitTypeId: UNIT_TYPE_ID,
      worldId: WORLD_ID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an update with no fields", () => {
    const result = updateUnitTypeInputSchema.safeParse({
      unitTypeId: UNIT_TYPE_ID,
      worldId: WORLD_ID,
    });
    expect(result.success).toBe(false);
  });

  it("allows clearing both building requirement fields together", () => {
    const result = updateUnitTypeInputSchema.safeParse({
      requiredBuildingBlueprintId: null,
      requiredBuildingTierNumber: null,
      unitTypeId: UNIT_TYPE_ID,
      worldId: WORLD_ID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects setting only one of the paired building requirement fields", () => {
    const result = updateUnitTypeInputSchema.safeParse({
      requiredBuildingBlueprintId: BLUEPRINT_ID,
      unitTypeId: UNIT_TYPE_ID,
      worldId: WORLD_ID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched nullness between the paired requirement fields", () => {
    const result = updateUnitTypeInputSchema.safeParse({
      requiredBuildingBlueprintId: BLUEPRINT_ID,
      requiredBuildingTierNumber: null,
      unitTypeId: UNIT_TYPE_ID,
      worldId: WORLD_ID,
    });
    expect(result.success).toBe(false);
  });
});

describe("deleteUnitTypeInputSchema", () => {
  it("accepts a valid delete payload", () => {
    const result = deleteUnitTypeInputSchema.safeParse({
      unitTypeId: UNIT_TYPE_ID,
      worldId: WORLD_ID,
    });
    expect(result.success).toBe(true);
  });
});
