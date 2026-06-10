import { describe, expect, it } from "vitest";

import { createManagedPopulationInstanceInputSchema } from "./createManagedPopulationInstanceSchemas";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const TYPE_ID = "22222222-2222-2222-2222-222222222222";

const VALID_BASE = {
  initialCount: 100,
  initialCullQuantity: 0,
  name: "Northern Herd",
  settlementId: SETTLEMENT_ID,
  typeId: TYPE_ID,
};

describe("createManagedPopulationInstanceInputSchema", () => {
  it("accepts valid minimal input", () => {
    const result =
      createManagedPopulationInstanceInputSchema.safeParse(VALID_BASE);

    expect(result.success).toBe(true);
  });

  it("accepts initialCullQuantity equal to initialCount", () => {
    const result = createManagedPopulationInstanceInputSchema.safeParse({
      ...VALID_BASE,
      initialCullQuantity: 100,
    });

    expect(result.success).toBe(true);
  });

  it("accepts fractional count values", () => {
    const result = createManagedPopulationInstanceInputSchema.safeParse({
      ...VALID_BASE,
      initialCount: 50.5,
      initialCullQuantity: 25.25,
    });

    expect(result.success).toBe(true);
  });

  it("rejects initialCount of zero", () => {
    const result = createManagedPopulationInstanceInputSchema.safeParse({
      ...VALID_BASE,
      initialCount: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.initialCount).toBeDefined();
    }
  });

  it("rejects negative initialCount", () => {
    const result = createManagedPopulationInstanceInputSchema.safeParse({
      ...VALID_BASE,
      initialCount: -1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.initialCount).toBeDefined();
    }
  });

  it("rejects negative initialCullQuantity", () => {
    const result = createManagedPopulationInstanceInputSchema.safeParse({
      ...VALID_BASE,
      initialCullQuantity: -1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.initialCullQuantity).toContain(
        "Initial cull quantity must be non-negative.",
      );
    }
  });

  it("rejects initialCullQuantity greater than initialCount", () => {
    const result = createManagedPopulationInstanceInputSchema.safeParse({
      ...VALID_BASE,
      initialCount: 50,
      initialCullQuantity: 51,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.initialCullQuantity).toContain(
        "Initial cull quantity must not exceed initial count.",
      );
    }
  });

  it("rejects a blank name", () => {
    const result = createManagedPopulationInstanceInputSchema.safeParse({
      ...VALID_BASE,
      name: "   ",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "Population instance name is required.",
      );
    }
  });

  it("rejects a name that is too long", () => {
    const result = createManagedPopulationInstanceInputSchema.safeParse({
      ...VALID_BASE,
      name: "a".repeat(65),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "Population instance name is too long.",
      );
    }
  });

  it("accepts a name that is exactly 64 characters", () => {
    const result = createManagedPopulationInstanceInputSchema.safeParse({
      ...VALID_BASE,
      name: "a".repeat(64),
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid settlementId", () => {
    const result = createManagedPopulationInstanceInputSchema.safeParse({
      ...VALID_BASE,
      settlementId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.settlementId).toContain(
        "Select a settlement.",
      );
    }
  });

  it("rejects an invalid typeId", () => {
    const result = createManagedPopulationInstanceInputSchema.safeParse({
      ...VALID_BASE,
      typeId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.typeId).toContain(
        "Managed population type id must be a valid UUID.",
      );
    }
  });

  it("rejects unknown top-level fields", () => {
    const result = createManagedPopulationInstanceInputSchema.safeParse({
      ...VALID_BASE,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });
});
