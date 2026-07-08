import { describe, expect, it } from "vitest";

import {
  createEducationLevelInputSchema,
  deleteEducationLevelInputSchema,
  reorderEducationLevelInputSchema,
  updateEducationLevelInputSchema,
} from "./educationLevelSchemas";

const EDUCATION_LEVEL_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";

describe("createEducationLevelInputSchema", () => {
  it("accepts a valid create payload with all fields", () => {
    const result = createEducationLevelInputSchema.safeParse({
      description: "Cannot read or write.",
      name: "Illiterate",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("Cannot read or write.");
      expect(result.data.name).toBe("Illiterate");
    }
  });

  it("trims a blank description to null", () => {
    const result = createEducationLevelInputSchema.safeParse({
      description: "   ",
      name: "Illiterate",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
    }
  });

  it("rejects a blank name", () => {
    const result = createEducationLevelInputSchema.safeParse({
      name: "   ",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "Education level name is required.",
      );
    }
  });

  it("rejects a name that is too long", () => {
    const result = createEducationLevelInputSchema.safeParse({
      name: "a".repeat(65),
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a description that is too long", () => {
    const result = createEducationLevelInputSchema.safeParse({
      description: "a".repeat(1001),
      name: "Illiterate",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid worldId", () => {
    const result = createEducationLevelInputSchema.safeParse({
      name: "Illiterate",
      worldId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = createEducationLevelInputSchema.safeParse({
      name: "Illiterate",
      worldId: WORLD_ID,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateEducationLevelInputSchema", () => {
  it("accepts a valid update with all updatable fields", () => {
    const result = updateEducationLevelInputSchema.safeParse({
      description: "Updated description.",
      educationLevelId: EDUCATION_LEVEL_ID,
      name: "Renamed Level",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only name", () => {
    const result = updateEducationLevelInputSchema.safeParse({
      educationLevelId: EDUCATION_LEVEL_ID,
      name: "Renamed Level",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an update with no updatable fields", () => {
    const result = updateEducationLevelInputSchema.safeParse({
      educationLevelId: EDUCATION_LEVEL_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "At least one of name or description must be provided.",
      );
    }
  });

  it("rejects an invalid educationLevelId", () => {
    const result = updateEducationLevelInputSchema.safeParse({
      educationLevelId: "not-a-uuid",
      name: "Renamed Level",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("deleteEducationLevelInputSchema", () => {
  it("accepts a valid delete request", () => {
    const result = deleteEducationLevelInputSchema.safeParse({
      educationLevelId: EDUCATION_LEVEL_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown fields", () => {
    const result = deleteEducationLevelInputSchema.safeParse({
      educationLevelId: EDUCATION_LEVEL_ID,
      extra: "field",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("reorderEducationLevelInputSchema", () => {
  it("accepts a valid up reorder request", () => {
    const result = reorderEducationLevelInputSchema.safeParse({
      direction: "up",
      educationLevelId: EDUCATION_LEVEL_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid down reorder request", () => {
    const result = reorderEducationLevelInputSchema.safeParse({
      direction: "down",
      educationLevelId: EDUCATION_LEVEL_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid direction", () => {
    const result = reorderEducationLevelInputSchema.safeParse({
      direction: "sideways",
      educationLevelId: EDUCATION_LEVEL_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});
