import { describe, expect, it } from "vitest";

import {
  createResourceInputSchema,
  softDeleteResourceInputSchema,
  updateResourceInputSchema,
} from "./resourceSchemas";

const RESOURCE_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";

describe("createResourceInputSchema", () => {
  it("accepts a valid create payload with all fields", () => {
    const result = createResourceInputSchema.safeParse({
      baseStockpileCap: "100.5000",
      name: "Iron Ore",
      slug: "iron-ore",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.baseStockpileCap).toBe(100.5);
      expect(result.data.name).toBe("Iron Ore");
      expect(result.data.slug).toBe("iron-ore");
    }
  });

  it("accepts a valid create payload without baseStockpileCap", () => {
    const result = createResourceInputSchema.safeParse({
      name: "Coal",
      slug: "coal",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("transforms baseStockpileCap string to a number", () => {
    const result = createResourceInputSchema.safeParse({
      baseStockpileCap: "250",
      name: "Timber",
      slug: "timber",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.baseStockpileCap).toBe("number");
      expect(result.data.baseStockpileCap).toBe(250);
    }
  });

  it("rejects a blank name", () => {
    const result = createResourceInputSchema.safeParse({
      name: "   ",
      slug: "iron-ore",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "Resource name is required.",
      );
    }
  });

  it("rejects a name that is too long", () => {
    const result = createResourceInputSchema.safeParse({
      name: "a".repeat(65),
      slug: "iron-ore",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "Resource name is too long.",
      );
    }
  });

  it("rejects a blank slug", () => {
    const result = createResourceInputSchema.safeParse({
      name: "Iron Ore",
      slug: "   ",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.slug).toContain(
        "Resource slug is required.",
      );
    }
  });

  it("rejects a slug that is too long", () => {
    const result = createResourceInputSchema.safeParse({
      name: "Iron Ore",
      slug: "a".repeat(65),
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.slug).toContain(
        "Resource slug is too long.",
      );
    }
  });

  it("rejects a non-decimal baseStockpileCap", () => {
    const result = createResourceInputSchema.safeParse({
      baseStockpileCap: "not-a-number",
      name: "Iron Ore",
      slug: "iron-ore",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a baseStockpileCap with more than four decimal places", () => {
    const result = createResourceInputSchema.safeParse({
      baseStockpileCap: "100.12345",
      name: "Iron Ore",
      slug: "iron-ore",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a negative baseStockpileCap", () => {
    const result = createResourceInputSchema.safeParse({
      baseStockpileCap: "-10",
      name: "Iron Ore",
      slug: "iron-ore",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid worldId", () => {
    const result = createResourceInputSchema.safeParse({
      name: "Iron Ore",
      slug: "iron-ore",
      worldId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = createResourceInputSchema.safeParse({
      name: "Iron Ore",
      slug: "iron-ore",
      worldId: WORLD_ID,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateResourceInputSchema", () => {
  it("accepts a valid update with all updatable fields", () => {
    const result = updateResourceInputSchema.safeParse({
      baseStockpileCap: "500.0000",
      name: "Refined Iron",
      resourceId: RESOURCE_ID,
      slug: "refined-iron",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.baseStockpileCap).toBe(500);
      expect(result.data.name).toBe("Refined Iron");
    }
  });

  it("accepts a partial update with only name", () => {
    const result = updateResourceInputSchema.safeParse({
      name: "Refined Iron",
      resourceId: RESOURCE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only slug", () => {
    const result = updateResourceInputSchema.safeParse({
      resourceId: RESOURCE_ID,
      slug: "new-slug",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only baseStockpileCap", () => {
    const result = updateResourceInputSchema.safeParse({
      baseStockpileCap: "999",
      resourceId: RESOURCE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an update with no updatable fields", () => {
    const result = updateResourceInputSchema.safeParse({
      resourceId: RESOURCE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "At least one of name, slug, or baseStockpileCap must be provided.",
      );
    }
  });

  it("rejects a blank name in update", () => {
    const result = updateResourceInputSchema.safeParse({
      name: "   ",
      resourceId: RESOURCE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid resourceId", () => {
    const result = updateResourceInputSchema.safeParse({
      name: "Iron Ore",
      resourceId: "not-a-uuid",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("softDeleteResourceInputSchema", () => {
  it("accepts a valid soft-delete request", () => {
    const result = softDeleteResourceInputSchema.safeParse({
      resourceId: RESOURCE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid resourceId", () => {
    const result = softDeleteResourceInputSchema.safeParse({
      resourceId: "not-a-uuid",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid worldId", () => {
    const result = softDeleteResourceInputSchema.safeParse({
      resourceId: RESOURCE_ID,
      worldId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = softDeleteResourceInputSchema.safeParse({
      resourceId: RESOURCE_ID,
      worldId: WORLD_ID,
      extra: "field",
    });

    expect(result.success).toBe(false);
  });
});
