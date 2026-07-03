import { describe, expect, it } from "vitest";

import { hardDeleteConstructionProjectInputSchema } from "./hardDeleteConstructionProjectSchemas";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

describe("hardDeleteConstructionProjectInputSchema", () => {
  it("accepts valid input", () => {
    const result = hardDeleteConstructionProjectInputSchema.safeParse({
      projectId: PROJECT_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid projectId", () => {
    const result = hardDeleteConstructionProjectInputSchema.safeParse({
      projectId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.projectId).toContain(
        "Select a project.",
      );
    }
  });

  it("rejects missing projectId", () => {
    const result = hardDeleteConstructionProjectInputSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.projectId).toBeDefined();
    }
  });

  it("rejects unknown fields", () => {
    const result = hardDeleteConstructionProjectInputSchema.safeParse({
      projectId: PROJECT_ID,
      extraField: "unexpected",
    });

    expect(result.success).toBe(false);
  });
});
