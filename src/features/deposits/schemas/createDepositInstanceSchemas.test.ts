import { describe, expect, it } from "vitest";

import { createDepositInstanceInputSchema } from "./createDepositInstanceSchemas";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const DEPOSIT_TYPE_ID = "22222222-2222-2222-2222-222222222222";
const RESOURCE_ID_A = "33333333-3333-3333-3333-333333333333";
const RESOURCE_ID_B = "44444444-4444-4444-4444-444444444444";

const VALID_BASE = {
  depositTypeId: DEPOSIT_TYPE_ID,
  name: "Iron Seam",
  resources: [{ initialQuantity: 100, resourceId: RESOURCE_ID_A }],
  settlementId: SETTLEMENT_ID,
};

describe("createDepositInstanceInputSchema", () => {
  it("accepts valid minimal input", () => {
    const result = createDepositInstanceInputSchema.safeParse(VALID_BASE);

    expect(result.success).toBe(true);
  });

  it("accepts valid input with maxWorkers", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      maxWorkers: 5,
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid input with multiple distinct resources", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      resources: [
        { initialQuantity: 100, resourceId: RESOURCE_ID_A },
        { initialQuantity: 50, resourceId: RESOURCE_ID_B },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty resources array", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      resources: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.resources).toBeDefined();
    }
  });

  it("rejects duplicate resource ids in the mix", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      resources: [
        { initialQuantity: 100, resourceId: RESOURCE_ID_A },
        { initialQuantity: 50, resourceId: RESOURCE_ID_A },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten();
      expect(errors.fieldErrors.resources).toContain(
        "Duplicate resources are not allowed.",
      );
    }
  });

  it("rejects a blank name", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      name: "   ",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "Deposit instance name is required.",
      );
    }
  });

  it("rejects a name that is too long", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      name: "a".repeat(65),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "Deposit instance name is too long.",
      );
    }
  });

  it("accepts a name that is exactly 64 characters", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      name: "a".repeat(64),
    });

    expect(result.success).toBe(true);
  });

  it("rejects maxWorkers of zero", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      maxWorkers: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.maxWorkers).toBeDefined();
    }
  });

  it("rejects a non-integer maxWorkers", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      maxWorkers: 1.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-positive initialQuantity", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      resources: [{ initialQuantity: 0, resourceId: RESOURCE_ID_A }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid settlementId", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      settlementId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.settlementId).toContain(
        "Settlement id must be a valid UUID.",
      );
    }
  });

  it("rejects an invalid depositTypeId", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      depositTypeId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.depositTypeId).toContain(
        "Deposit type id must be a valid UUID.",
      );
    }
  });

  it("rejects an invalid resource resourceId", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      resources: [{ initialQuantity: 100, resourceId: "not-a-uuid" }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields in a resource entry", () => {
    const result = createDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      resources: [
        { extra: "field", initialQuantity: 100, resourceId: RESOURCE_ID_A },
      ],
    });

    expect(result.success).toBe(false);
  });
});
