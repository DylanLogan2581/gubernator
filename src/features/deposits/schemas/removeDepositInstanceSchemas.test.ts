import { describe, expect, it } from "vitest";

import { removeDepositInstanceInputSchema } from "./removeDepositInstanceSchemas";

const DEPOSIT_INSTANCE_ID = "11111111-1111-1111-1111-111111111111";

const VALID_BASE = {
  depositInstanceId: DEPOSIT_INSTANCE_ID,
};

describe("removeDepositInstanceInputSchema", () => {
  it("accepts a valid deposit instance id", () => {
    const result = removeDepositInstanceInputSchema.safeParse(VALID_BASE);

    expect(result.success).toBe(true);
  });

  it("rejects an invalid depositInstanceId", () => {
    const result = removeDepositInstanceInputSchema.safeParse({
      depositInstanceId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.depositInstanceId).toContain(
        "Deposit instance id must be a valid UUID.",
      );
    }
  });

  it("rejects missing depositInstanceId", () => {
    const result = removeDepositInstanceInputSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    const result = removeDepositInstanceInputSchema.safeParse({
      ...VALID_BASE,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });
});
