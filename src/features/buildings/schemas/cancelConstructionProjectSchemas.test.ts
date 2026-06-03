import { describe, expect, it } from "vitest";

import { cancelConstructionProjectInputSchema } from "./cancelConstructionProjectSchemas";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

describe("cancelConstructionProjectInputSchema", () => {
  it("accepts valid input", () => {
    const result = cancelConstructionProjectInputSchema.safeParse({
      projectId: PROJECT_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid projectId", () => {
    const result = cancelConstructionProjectInputSchema.safeParse({
      projectId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.projectId).toContain(
        "Project id must be a valid UUID.",
      );
    }
  });

  it("rejects missing projectId", () => {
    const result = cancelConstructionProjectInputSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.projectId).toBeDefined();
    }
  });

  it("rejects unknown fields", () => {
    const result = cancelConstructionProjectInputSchema.safeParse({
      projectId: PROJECT_ID,
      extraField: "unexpected",
    });

    expect(result.success).toBe(false);
  });
});
