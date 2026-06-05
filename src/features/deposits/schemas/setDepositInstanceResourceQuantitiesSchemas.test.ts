import { describe, expect, it } from "vitest";

import { setDepositInstanceResourceQuantitiesInputSchema } from "./setDepositInstanceResourceQuantitiesSchemas";

const DEPOSIT_INSTANCE_RESOURCE_ID = "11111111-1111-1111-1111-111111111111";
const SETTLEMENT_ID = "22222222-2222-2222-2222-222222222222";

const VALID_BASE = {
  depositInstanceResourceId: DEPOSIT_INSTANCE_RESOURCE_ID,
  initialQuantity: 1000,
  remainingQuantity: 750,
  settlementId: SETTLEMENT_ID,
};

describe("setDepositInstanceResourceQuantitiesInputSchema", () => {
  it("accepts valid input", () => {
    const result =
      setDepositInstanceResourceQuantitiesInputSchema.safeParse(VALID_BASE);

    expect(result.success).toBe(true);
  });

  it("accepts initial and remaining of zero", () => {
    const result = setDepositInstanceResourceQuantitiesInputSchema.safeParse({
      ...VALID_BASE,
      initialQuantity: 0,
      remainingQuantity: 0,
    });

    expect(result.success).toBe(true);
  });

  it("accepts remaining equal to initial", () => {
    const result = setDepositInstanceResourceQuantitiesInputSchema.safeParse({
      ...VALID_BASE,
      initialQuantity: 500,
      remainingQuantity: 500,
    });

    expect(result.success).toBe(true);
  });

  it("accepts fractional quantities", () => {
    const result = setDepositInstanceResourceQuantitiesInputSchema.safeParse({
      ...VALID_BASE,
      initialQuantity: 100.5,
      remainingQuantity: 50.25,
    });

    expect(result.success).toBe(true);
  });

  it("rejects initialQuantity < 0", () => {
    const result = setDepositInstanceResourceQuantitiesInputSchema.safeParse({
      ...VALID_BASE,
      initialQuantity: -1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.initialQuantity).toBeDefined();
    }
  });

  it("rejects remainingQuantity < 0", () => {
    const result = setDepositInstanceResourceQuantitiesInputSchema.safeParse({
      ...VALID_BASE,
      remainingQuantity: -1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.remainingQuantity,
      ).toBeDefined();
    }
  });

  it("rejects an invalid depositInstanceResourceId", () => {
    const result = setDepositInstanceResourceQuantitiesInputSchema.safeParse({
      ...VALID_BASE,
      depositInstanceResourceId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.depositInstanceResourceId,
      ).toContain("Deposit instance resource id must be a valid UUID.");
    }
  });

  it("rejects an invalid settlementId", () => {
    const result = setDepositInstanceResourceQuantitiesInputSchema.safeParse({
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

  it("rejects unknown top-level fields", () => {
    const result = setDepositInstanceResourceQuantitiesInputSchema.safeParse({
      ...VALID_BASE,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });
});
