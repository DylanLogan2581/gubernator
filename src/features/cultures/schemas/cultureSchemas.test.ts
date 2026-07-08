import { describe, expect, it } from "vitest";

import {
  createCultureInputSchema,
  deleteCultureInputSchema,
  updateCultureInputSchema,
} from "./cultureSchemas";

const CULTURE_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";

describe("createCultureInputSchema", () => {
  it("accepts a valid create payload with all fields", () => {
    const result = createCultureInputSchema.safeParse({
      color: "#123abc",
      description: "A seafaring people.",
      name: "Coastal Folk",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe("#123abc");
      expect(result.data.description).toBe("A seafaring people.");
      expect(result.data.name).toBe("Coastal Folk");
    }
  });

  it("defaults color when omitted", () => {
    const result = createCultureInputSchema.safeParse({
      name: "Coastal Folk",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe("#6b7280");
    }
  });

  it("trims a blank description to null", () => {
    const result = createCultureInputSchema.safeParse({
      description: "   ",
      name: "Coastal Folk",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
    }
  });

  it("rejects a blank name", () => {
    const result = createCultureInputSchema.safeParse({
      name: "   ",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "Culture name is required.",
      );
    }
  });

  it("rejects a name that is too long", () => {
    const result = createCultureInputSchema.safeParse({
      name: "a".repeat(65),
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a description that is too long", () => {
    const result = createCultureInputSchema.safeParse({
      description: "a".repeat(1001),
      name: "Coastal Folk",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid color", () => {
    const result = createCultureInputSchema.safeParse({
      color: "blue",
      name: "Coastal Folk",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("accepts an uppercase color and preserves it", () => {
    const result = createCultureInputSchema.safeParse({
      color: "#ABCDEF",
      name: "Coastal Folk",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid worldId", () => {
    const result = createCultureInputSchema.safeParse({
      name: "Coastal Folk",
      worldId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = createCultureInputSchema.safeParse({
      name: "Coastal Folk",
      worldId: WORLD_ID,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateCultureInputSchema", () => {
  it("accepts a valid update with all updatable fields", () => {
    const result = updateCultureInputSchema.safeParse({
      color: "#111111",
      cultureId: CULTURE_ID,
      description: "Updated description.",
      name: "Renamed Culture",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only name", () => {
    const result = updateCultureInputSchema.safeParse({
      cultureId: CULTURE_ID,
      name: "Renamed Culture",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only color", () => {
    const result = updateCultureInputSchema.safeParse({
      color: "#222222",
      cultureId: CULTURE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an update with no updatable fields", () => {
    const result = updateCultureInputSchema.safeParse({
      cultureId: CULTURE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "At least one of name, description, or color must be provided.",
      );
    }
  });

  it("rejects an invalid cultureId", () => {
    const result = updateCultureInputSchema.safeParse({
      cultureId: "not-a-uuid",
      name: "Renamed Culture",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("deleteCultureInputSchema", () => {
  it("accepts a valid delete request", () => {
    const result = deleteCultureInputSchema.safeParse({
      cultureId: CULTURE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown fields", () => {
    const result = deleteCultureInputSchema.safeParse({
      cultureId: CULTURE_ID,
      extra: "field",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});
