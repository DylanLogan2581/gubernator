import { describe, expect, it } from "vitest";

import { setConstructionProjectWorkersInputSchema } from "./setConstructionProjectWorkersSchemas";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const SETTLEMENT_ID = "22222222-2222-2222-2222-222222222222";

const VALID_INPUT = {
  projectId: PROJECT_ID,
  settlementId: SETTLEMENT_ID,
  targetCount: 3,
};

describe("setConstructionProjectWorkersInputSchema", () => {
  it("accepts valid input", () => {
    const result =
      setConstructionProjectWorkersInputSchema.safeParse(VALID_INPUT);

    expect(result.success).toBe(true);
  });

  it("accepts a targetCount of 0", () => {
    const result = setConstructionProjectWorkersInputSchema.safeParse({
      ...VALID_INPUT,
      targetCount: 0,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid projectId", () => {
    const result = setConstructionProjectWorkersInputSchema.safeParse({
      ...VALID_INPUT,
      projectId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.projectId).toContain(
        "Select a project.",
      );
    }
  });

  it("rejects an invalid settlementId", () => {
    const result = setConstructionProjectWorkersInputSchema.safeParse({
      ...VALID_INPUT,
      settlementId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.settlementId).toContain(
        "Select a settlement.",
      );
    }
  });

  it("rejects a non-integer targetCount", () => {
    const result = setConstructionProjectWorkersInputSchema.safeParse({
      ...VALID_INPUT,
      targetCount: 1.5,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.targetCount).toContain(
        "Target count must be an integer.",
      );
    }
  });

  it("rejects a negative targetCount", () => {
    const result = setConstructionProjectWorkersInputSchema.safeParse({
      ...VALID_INPUT,
      targetCount: -1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.targetCount).toContain(
        "Target count must not be negative.",
      );
    }
  });

  it("rejects missing fields", () => {
    const result = setConstructionProjectWorkersInputSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.projectId).toBeDefined();
      expect(fieldErrors.settlementId).toBeDefined();
      expect(fieldErrors.targetCount).toBeDefined();
    }
  });

  it("rejects unknown fields", () => {
    const result = setConstructionProjectWorkersInputSchema.safeParse({
      ...VALID_INPUT,
      extraField: "unexpected",
    });

    expect(result.success).toBe(false);
  });
});
