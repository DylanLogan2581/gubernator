import { describe, expect, it } from "vitest";

import { manualDeconstructBuildingInputSchema } from "./manualDeconstructBuildingSchemas";

const BUILDING_ID = "11111111-1111-1111-1111-111111111111";

describe("manualDeconstructBuildingInputSchema", () => {
  it("accepts valid input", () => {
    const result = manualDeconstructBuildingInputSchema.safeParse({
      settlementBuildingId: BUILDING_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid settlementBuildingId", () => {
    const result = manualDeconstructBuildingInputSchema.safeParse({
      settlementBuildingId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.settlementBuildingId).toContain(
        "Settlement building id must be a valid UUID.",
      );
    }
  });

  it("rejects missing settlementBuildingId", () => {
    const result = manualDeconstructBuildingInputSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.settlementBuildingId,
      ).toBeDefined();
    }
  });

  it("rejects unknown fields", () => {
    const result = manualDeconstructBuildingInputSchema.safeParse({
      settlementBuildingId: BUILDING_ID,
      extraField: "unexpected",
    });

    expect(result.success).toBe(false);
  });
});
