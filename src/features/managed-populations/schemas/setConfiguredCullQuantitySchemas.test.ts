import { describe, expect, it } from "vitest";

import { setConfiguredCullQuantityInputSchema } from "./setConfiguredCullQuantitySchemas";

const INSTANCE_ID = "11111111-1111-1111-1111-111111111111";

const VALID_BASE = {
  managedPopulationInstanceId: INSTANCE_ID,
  quantity: 10,
};

describe("setConfiguredCullQuantityInputSchema", () => {
  it("accepts valid input", () => {
    const result = setConfiguredCullQuantityInputSchema.safeParse(VALID_BASE);

    expect(result.success).toBe(true);
  });

  it("accepts quantity of zero", () => {
    const result = setConfiguredCullQuantityInputSchema.safeParse({
      ...VALID_BASE,
      quantity: 0,
    });

    expect(result.success).toBe(true);
  });

  it("accepts fractional quantity", () => {
    const result = setConfiguredCullQuantityInputSchema.safeParse({
      ...VALID_BASE,
      quantity: 5.5,
    });

    expect(result.success).toBe(true);
  });

  it("rejects negative quantity", () => {
    const result = setConfiguredCullQuantityInputSchema.safeParse({
      ...VALID_BASE,
      quantity: -1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.quantity).toContain(
        "Quantity must be non-negative.",
      );
    }
  });

  it("rejects an invalid managedPopulationInstanceId", () => {
    const result = setConfiguredCullQuantityInputSchema.safeParse({
      ...VALID_BASE,
      managedPopulationInstanceId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.managedPopulationInstanceId,
      ).toContain("Managed population instance id must be a valid UUID.");
    }
  });

  it("rejects unknown top-level fields", () => {
    const result = setConfiguredCullQuantityInputSchema.safeParse({
      ...VALID_BASE,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });
});
