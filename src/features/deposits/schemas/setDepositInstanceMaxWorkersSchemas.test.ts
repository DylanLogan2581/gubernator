import { describe, expect, it } from "vitest";

import { setDepositInstanceMaxWorkersInputSchema } from "./setDepositInstanceMaxWorkersSchemas";

const DEPOSIT_INSTANCE_ID = "11111111-1111-1111-1111-111111111111";
const SETTLEMENT_ID = "22222222-2222-2222-2222-222222222222";

const VALID_BASE = {
  depositInstanceId: DEPOSIT_INSTANCE_ID,
  maxWorkers: 5,
  removalStrategy: "npc_first" as const,
  settlementId: SETTLEMENT_ID,
};

describe("setDepositInstanceMaxWorkersInputSchema", () => {
  it("accepts valid input with maxWorkers and removalStrategy", () => {
    const result =
      setDepositInstanceMaxWorkersInputSchema.safeParse(VALID_BASE);

    expect(result.success).toBe(true);
  });

  it("accepts null maxWorkers (removes cap)", () => {
    const result = setDepositInstanceMaxWorkersInputSchema.safeParse({
      ...VALID_BASE,
      maxWorkers: null,
    });

    expect(result.success).toBe(true);
  });

  it("accepts null removalStrategy", () => {
    const result = setDepositInstanceMaxWorkersInputSchema.safeParse({
      ...VALID_BASE,
      removalStrategy: null,
    });

    expect(result.success).toBe(true);
  });

  it("accepts removalStrategy random", () => {
    const result = setDepositInstanceMaxWorkersInputSchema.safeParse({
      ...VALID_BASE,
      removalStrategy: "random",
    });

    expect(result.success).toBe(true);
  });

  it("accepts removalStrategy npc_first", () => {
    const result = setDepositInstanceMaxWorkersInputSchema.safeParse({
      ...VALID_BASE,
      removalStrategy: "npc_first",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid removalStrategy value", () => {
    const result = setDepositInstanceMaxWorkersInputSchema.safeParse({
      ...VALID_BASE,
      removalStrategy: "newest_first",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.removalStrategy).toBeDefined();
    }
  });

  it("rejects maxWorkers of zero", () => {
    const result = setDepositInstanceMaxWorkersInputSchema.safeParse({
      ...VALID_BASE,
      maxWorkers: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.maxWorkers).toBeDefined();
    }
  });

  it("rejects maxWorkers of -1", () => {
    const result = setDepositInstanceMaxWorkersInputSchema.safeParse({
      ...VALID_BASE,
      maxWorkers: -1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.maxWorkers).toBeDefined();
    }
  });

  it("rejects a non-integer maxWorkers", () => {
    const result = setDepositInstanceMaxWorkersInputSchema.safeParse({
      ...VALID_BASE,
      maxWorkers: 2.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid depositInstanceId", () => {
    const result = setDepositInstanceMaxWorkersInputSchema.safeParse({
      ...VALID_BASE,
      depositInstanceId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.depositInstanceId).toContain(
        "Deposit instance id must be a valid UUID.",
      );
    }
  });

  it("rejects an invalid settlementId", () => {
    const result = setDepositInstanceMaxWorkersInputSchema.safeParse({
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
    const result = setDepositInstanceMaxWorkersInputSchema.safeParse({
      ...VALID_BASE,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });
});
