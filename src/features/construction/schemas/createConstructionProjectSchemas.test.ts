import { describe, expect, it } from "vitest";

import { createConstructionProjectInputSchema } from "./createConstructionProjectSchemas";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const BLUEPRINT_ID = "22222222-2222-2222-2222-222222222222";
const TIER_ID = "33333333-3333-3333-3333-333333333333";

describe("createConstructionProjectInputSchema", () => {
  it("accepts valid input", () => {
    const result = createConstructionProjectInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      settlementId: SETTLEMENT_ID,
      targetTierId: TIER_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid settlementId", () => {
    const result = createConstructionProjectInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      settlementId: "not-a-uuid",
      targetTierId: TIER_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.settlementId).toContain(
        "Select a settlement.",
      );
    }
  });

  it("rejects an invalid blueprintId", () => {
    const result = createConstructionProjectInputSchema.safeParse({
      blueprintId: "not-a-uuid",
      settlementId: SETTLEMENT_ID,
      targetTierId: TIER_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.blueprintId).toContain(
        "Select a blueprint.",
      );
    }
  });

  it("rejects an invalid targetTierId", () => {
    const result = createConstructionProjectInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      settlementId: SETTLEMENT_ID,
      targetTierId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.targetTierId).toContain(
        "Select a target tier.",
      );
    }
  });

  it("rejects missing fields", () => {
    const result = createConstructionProjectInputSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.settlementId).toBeDefined();
      expect(fieldErrors.blueprintId).toBeDefined();
      expect(fieldErrors.targetTierId).toBeDefined();
    }
  });

  it("rejects unknown fields", () => {
    const result = createConstructionProjectInputSchema.safeParse({
      blueprintId: BLUEPRINT_ID,
      extraField: "unexpected",
      settlementId: SETTLEMENT_ID,
      targetTierId: TIER_ID,
    });

    expect(result.success).toBe(false);
  });
});
