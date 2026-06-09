import { describe, expect, it } from "vitest";

import { reorderConstructionProjectsInputSchema } from "./reorderConstructionProjectsSchemas";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const PROJECT_A = "22222222-2222-2222-2222-222222222222";
const PROJECT_B = "33333333-3333-3333-3333-333333333333";

describe("reorderConstructionProjectsInputSchema", () => {
  it("accepts valid input with multiple positions", () => {
    const result = reorderConstructionProjectsInputSchema.safeParse({
      positions: [
        { projectId: PROJECT_A, position: 2 },
        { projectId: PROJECT_B, position: 1 },
      ],
      settlementId: SETTLEMENT_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts an empty positions array", () => {
    const result = reorderConstructionProjectsInputSchema.safeParse({
      positions: [],
      settlementId: SETTLEMENT_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid settlementId", () => {
    const result = reorderConstructionProjectsInputSchema.safeParse({
      positions: [],
      settlementId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.settlementId).toContain(
        "Settlement id must be a valid UUID.",
      );
    }
  });

  it("rejects missing settlementId", () => {
    const result = reorderConstructionProjectsInputSchema.safeParse({
      positions: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.settlementId).toBeDefined();
    }
  });

  it("rejects a position entry with missing projectId", () => {
    const result = reorderConstructionProjectsInputSchema.safeParse({
      positions: [{ position: 1 }],
      settlementId: SETTLEMENT_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a position entry with an invalid projectId", () => {
    const result = reorderConstructionProjectsInputSchema.safeParse({
      positions: [{ projectId: "not-a-uuid", position: 1 }],
      settlementId: SETTLEMENT_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a position entry with position = 0 (out-of-range)", () => {
    const result = reorderConstructionProjectsInputSchema.safeParse({
      positions: [{ projectId: PROJECT_A, position: 0 }],
      settlementId: SETTLEMENT_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Position must be a positive integer.");
    }
  });

  it("rejects a position entry with a negative position (out-of-range)", () => {
    const result = reorderConstructionProjectsInputSchema.safeParse({
      positions: [{ projectId: PROJECT_A, position: -1 }],
      settlementId: SETTLEMENT_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    const result = reorderConstructionProjectsInputSchema.safeParse({
      extra: "unexpected",
      positions: [],
      settlementId: SETTLEMENT_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields inside a position entry", () => {
    const result = reorderConstructionProjectsInputSchema.safeParse({
      positions: [{ extra: "bad", projectId: PROJECT_A, position: 1 }],
      settlementId: SETTLEMENT_ID,
    });

    expect(result.success).toBe(false);
  });
});
