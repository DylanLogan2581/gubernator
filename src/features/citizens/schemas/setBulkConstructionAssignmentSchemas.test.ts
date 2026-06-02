import { describe, expect, it } from "vitest";

import { setBulkConstructionAssignmentInputSchema } from "./setBulkConstructionAssignmentSchemas";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

describe("setBulkConstructionAssignmentInputSchema", () => {
  it("accepts valid input", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      constructionProjectId: PROJECT_ID,
      targetCount: 3,
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid input with targetCount = 0", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      constructionProjectId: PROJECT_ID,
      targetCount: 0,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a negative targetCount", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      constructionProjectId: PROJECT_ID,
      targetCount: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer targetCount", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      constructionProjectId: PROJECT_ID,
      targetCount: 1.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing constructionProjectId", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      targetCount: 2,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID constructionProjectId", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      constructionProjectId: "not-a-uuid",
      targetCount: 2,
    });

    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      constructionProjectId: PROJECT_ID,
      settlementId: "22222222-2222-2222-2222-222222222222",
      targetCount: 2,
    });

    expect(result.success).toBe(false);
  });
});
