import { describe, expect, it } from "vitest";

import { transferManagedPopulationCountInputSchema } from "./transferManagedPopulationCountSchemas";

const FROM_INSTANCE_ID = "11111111-1111-1111-1111-111111111111";
const TO_INSTANCE_ID = "22222222-2222-2222-2222-222222222222";

const VALID_BASE = {
  fromManagedPopulationInstanceId: FROM_INSTANCE_ID,
  toManagedPopulationInstanceId: TO_INSTANCE_ID,
  count: 10,
};

describe("transferManagedPopulationCountInputSchema", () => {
  it("accepts valid input", () => {
    const result =
      transferManagedPopulationCountInputSchema.safeParse(VALID_BASE);

    expect(result.success).toBe(true);
  });

  it("accepts fractional count", () => {
    const result = transferManagedPopulationCountInputSchema.safeParse({
      ...VALID_BASE,
      count: 5.5,
    });

    expect(result.success).toBe(true);
  });

  it("rejects zero count", () => {
    const result = transferManagedPopulationCountInputSchema.safeParse({
      ...VALID_BASE,
      count: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.count).toContain(
        "Count must be greater than 0.",
      );
    }
  });

  it("rejects negative count", () => {
    const result = transferManagedPopulationCountInputSchema.safeParse({
      ...VALID_BASE,
      count: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid fromManagedPopulationInstanceId", () => {
    const result = transferManagedPopulationCountInputSchema.safeParse({
      ...VALID_BASE,
      fromManagedPopulationInstanceId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.fromManagedPopulationInstanceId,
      ).toContain("Managed population instance id must be a valid UUID.");
    }
  });

  it("rejects an invalid toManagedPopulationInstanceId", () => {
    const result = transferManagedPopulationCountInputSchema.safeParse({
      ...VALID_BASE,
      toManagedPopulationInstanceId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects the same instance for source and target", () => {
    const result = transferManagedPopulationCountInputSchema.safeParse({
      ...VALID_BASE,
      toManagedPopulationInstanceId: FROM_INSTANCE_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.toManagedPopulationInstanceId,
      ).toContain("Source and target must be different instances.");
    }
  });

  it("rejects unknown top-level fields", () => {
    const result = transferManagedPopulationCountInputSchema.safeParse({
      ...VALID_BASE,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });
});
