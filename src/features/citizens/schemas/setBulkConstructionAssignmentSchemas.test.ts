import { describe, expect, it } from "vitest";

import { setBulkConstructionAssignmentInputSchema } from "./setBulkConstructionAssignmentSchemas";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

describe("setBulkConstructionAssignmentInputSchema", () => {
  it("accepts valid npc_first input", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      constructionProjectId: PROJECT_ID,
      removalStrategy: "npc_first",
      targetCount: 3,
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid random input with targetCount = 0", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      constructionProjectId: PROJECT_ID,
      removalStrategy: "random",
      targetCount: 0,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a negative targetCount", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      constructionProjectId: PROJECT_ID,
      removalStrategy: "npc_first",
      targetCount: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unknown removalStrategy", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      constructionProjectId: PROJECT_ID,
      removalStrategy: "biggest_npcs_first",
      targetCount: 2,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer targetCount", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      constructionProjectId: PROJECT_ID,
      removalStrategy: "npc_first",
      targetCount: 1.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing constructionProjectId", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      removalStrategy: "npc_first",
      targetCount: 2,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID constructionProjectId", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      constructionProjectId: "not-a-uuid",
      removalStrategy: "npc_first",
      targetCount: 2,
    });

    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = setBulkConstructionAssignmentInputSchema.safeParse({
      constructionProjectId: PROJECT_ID,
      removalStrategy: "npc_first",
      settlementId: "22222222-2222-2222-2222-222222222222",
      targetCount: 2,
    });

    expect(result.success).toBe(false);
  });
});
