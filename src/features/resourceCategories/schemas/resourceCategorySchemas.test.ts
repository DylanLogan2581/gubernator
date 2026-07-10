import { describe, expect, it } from "vitest";

import {
  createResourceCategoryInputSchema,
  deleteResourceCategoryInputSchema,
  reorderResourceCategoryInputSchema,
  updateResourceCategoryInputSchema,
} from "./resourceCategorySchemas";

const CATEGORY_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";

describe("createResourceCategoryInputSchema", () => {
  it("accepts a valid create payload with all fields", () => {
    const result = createResourceCategoryInputSchema.safeParse({
      color: "#123abc",
      icon: "pickaxe",
      name: "Raw Materials",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe("#123abc");
      expect(result.data.icon).toBe("pickaxe");
      expect(result.data.name).toBe("Raw Materials");
    }
  });

  it("defaults color when omitted", () => {
    const result = createResourceCategoryInputSchema.safeParse({
      name: "Raw Materials",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe("#6b7280");
    }
  });

  it("rejects a blank name", () => {
    const result = createResourceCategoryInputSchema.safeParse({
      name: "   ",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "Resource category name is required.",
      );
    }
  });

  it("rejects a name that is too long", () => {
    const result = createResourceCategoryInputSchema.safeParse({
      name: "a".repeat(65),
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid color", () => {
    const result = createResourceCategoryInputSchema.safeParse({
      color: "blue",
      name: "Raw Materials",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid worldId", () => {
    const result = createResourceCategoryInputSchema.safeParse({
      name: "Raw Materials",
      worldId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = createResourceCategoryInputSchema.safeParse({
      name: "Raw Materials",
      worldId: WORLD_ID,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateResourceCategoryInputSchema", () => {
  it("accepts a valid update with all updatable fields", () => {
    const result = updateResourceCategoryInputSchema.safeParse({
      categoryId: CATEGORY_ID,
      color: "#111111",
      icon: "wheat",
      name: "Renamed Category",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only name", () => {
    const result = updateResourceCategoryInputSchema.safeParse({
      categoryId: CATEGORY_ID,
      name: "Renamed Category",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an update with no updatable fields", () => {
    const result = updateResourceCategoryInputSchema.safeParse({
      categoryId: CATEGORY_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "At least one of name, color, or icon must be provided.",
      );
    }
  });

  it("rejects an invalid categoryId", () => {
    const result = updateResourceCategoryInputSchema.safeParse({
      categoryId: "not-a-uuid",
      name: "Renamed Category",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("deleteResourceCategoryInputSchema", () => {
  it("accepts a valid delete request", () => {
    const result = deleteResourceCategoryInputSchema.safeParse({
      categoryId: CATEGORY_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown fields", () => {
    const result = deleteResourceCategoryInputSchema.safeParse({
      categoryId: CATEGORY_ID,
      extra: "field",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("reorderResourceCategoryInputSchema", () => {
  it("accepts a valid reorder request", () => {
    const result = reorderResourceCategoryInputSchema.safeParse({
      categoryId: CATEGORY_ID,
      direction: "up",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid direction", () => {
    const result = reorderResourceCategoryInputSchema.safeParse({
      categoryId: CATEGORY_ID,
      direction: "sideways",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});
