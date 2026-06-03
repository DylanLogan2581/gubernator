import { describe, expect, it } from "vitest";

import { setBulkStandardJobAssignmentInputSchema } from "./setBulkStandardJobAssignmentSchemas";

const JOB_ID = "11111111-1111-1111-1111-111111111111";
const SETTLEMENT_ID = "22222222-2222-2222-2222-222222222222";

describe("setBulkStandardJobAssignmentInputSchema", () => {
  it("accepts valid input", () => {
    const result = setBulkStandardJobAssignmentInputSchema.safeParse({
      jobId: JOB_ID,
      settlementId: SETTLEMENT_ID,
      targetCount: 3,
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid input with targetCount = 0", () => {
    const result = setBulkStandardJobAssignmentInputSchema.safeParse({
      jobId: JOB_ID,
      settlementId: SETTLEMENT_ID,
      targetCount: 0,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a negative targetCount", () => {
    const result = setBulkStandardJobAssignmentInputSchema.safeParse({
      jobId: JOB_ID,
      settlementId: SETTLEMENT_ID,
      targetCount: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer targetCount", () => {
    const result = setBulkStandardJobAssignmentInputSchema.safeParse({
      jobId: JOB_ID,
      settlementId: SETTLEMENT_ID,
      targetCount: 1.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing jobId", () => {
    const result = setBulkStandardJobAssignmentInputSchema.safeParse({
      settlementId: SETTLEMENT_ID,
      targetCount: 2,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID jobId", () => {
    const result = setBulkStandardJobAssignmentInputSchema.safeParse({
      jobId: "not-a-uuid",
      settlementId: SETTLEMENT_ID,
      targetCount: 2,
    });

    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = setBulkStandardJobAssignmentInputSchema.safeParse({
      jobId: JOB_ID,
      settlementId: SETTLEMENT_ID,
      targetCount: 2,
      worldId: "33333333-3333-3333-3333-333333333333",
    });

    expect(result.success).toBe(false);
  });
});
