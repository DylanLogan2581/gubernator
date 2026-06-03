import { describe, expect, it } from "vitest";

import { removeManagedPopulationInstanceInputSchema } from "./removeManagedPopulationInstanceSchemas";

const INSTANCE_ID = "11111111-1111-1111-1111-111111111111";

const VALID_BASE = {
  managedPopulationInstanceId: INSTANCE_ID,
};

describe("removeManagedPopulationInstanceInputSchema", () => {
  it("accepts a valid managed population instance id", () => {
    const result =
      removeManagedPopulationInstanceInputSchema.safeParse(VALID_BASE);

    expect(result.success).toBe(true);
  });

  it("rejects an invalid managedPopulationInstanceId", () => {
    const result = removeManagedPopulationInstanceInputSchema.safeParse({
      managedPopulationInstanceId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.managedPopulationInstanceId,
      ).toContain("Managed population instance id must be a valid UUID.");
    }
  });

  it("rejects missing managedPopulationInstanceId", () => {
    const result = removeManagedPopulationInstanceInputSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    const result = removeManagedPopulationInstanceInputSchema.safeParse({
      ...VALID_BASE,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });
});
