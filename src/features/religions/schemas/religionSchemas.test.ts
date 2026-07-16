import { describe, expect, it } from "vitest";

import {
  createReligionInputSchema,
  deleteReligionInputSchema,
  updateReligionInputSchema,
} from "./religionSchemas";

const RELIGION_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";

describe("createReligionInputSchema", () => {
  it("accepts a valid create payload with all fields", () => {
    const result = createReligionInputSchema.safeParse({
      color: "#123abc",
      description: "A seafaring people.",
      name: "Sun Cult",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe("#123abc");
      expect(result.data.description).toBe("A seafaring people.");
      expect(result.data.name).toBe("Sun Cult");
    }
  });

  it("defaults color when omitted", () => {
    const result = createReligionInputSchema.safeParse({
      name: "Sun Cult",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe("#6b7280");
    }
  });

  it("trims a blank description to null", () => {
    const result = createReligionInputSchema.safeParse({
      description: "   ",
      name: "Sun Cult",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
    }
  });

  it("rejects a blank name", () => {
    const result = createReligionInputSchema.safeParse({
      name: "   ",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "Religion name is required.",
      );
    }
  });

  it("rejects a name that is too long", () => {
    const result = createReligionInputSchema.safeParse({
      name: "a".repeat(65),
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a description that is too long", () => {
    const result = createReligionInputSchema.safeParse({
      description: "a".repeat(1001),
      name: "Sun Cult",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid color", () => {
    const result = createReligionInputSchema.safeParse({
      color: "blue",
      name: "Sun Cult",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("accepts an uppercase color and preserves it", () => {
    const result = createReligionInputSchema.safeParse({
      color: "#ABCDEF",
      name: "Sun Cult",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid worldId", () => {
    const result = createReligionInputSchema.safeParse({
      name: "Sun Cult",
      worldId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = createReligionInputSchema.safeParse({
      name: "Sun Cult",
      worldId: WORLD_ID,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateReligionInputSchema", () => {
  it("accepts a valid update with all updatable fields", () => {
    const result = updateReligionInputSchema.safeParse({
      color: "#111111",
      religionId: RELIGION_ID,
      description: "Updated description.",
      name: "Renamed Religion",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only name", () => {
    const result = updateReligionInputSchema.safeParse({
      religionId: RELIGION_ID,
      name: "Renamed Religion",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only color", () => {
    const result = updateReligionInputSchema.safeParse({
      color: "#222222",
      religionId: RELIGION_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an update with no updatable fields", () => {
    const result = updateReligionInputSchema.safeParse({
      religionId: RELIGION_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "At least one of name, description, color, or a lore field must be provided.",
      );
    }
  });

  it("rejects an invalid religionId", () => {
    const result = updateReligionInputSchema.safeParse({
      religionId: "not-a-uuid",
      name: "Renamed Religion",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("deleteReligionInputSchema", () => {
  it("accepts a valid delete request", () => {
    const result = deleteReligionInputSchema.safeParse({
      religionId: RELIGION_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown fields", () => {
    const result = deleteReligionInputSchema.safeParse({
      religionId: RELIGION_ID,
      extra: "field",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a reassignment target", () => {
    const result = deleteReligionInputSchema.safeParse({
      reassignToId: "33333333-3333-3333-3333-333333333333",
      religionId: RELIGION_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a null reassignment target", () => {
    const result = deleteReligionInputSchema.safeParse({
      reassignToId: null,
      religionId: RELIGION_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects reassigning a religion to itself", () => {
    const result = deleteReligionInputSchema.safeParse({
      reassignToId: RELIGION_ID,
      religionId: RELIGION_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("updateReligionInputSchema lore fields", () => {
  it("accepts an update with only a lore field", () => {
    const result = updateReligionInputSchema.safeParse({
      deities: "The Sunmother and her three sons.",
      religionId: RELIGION_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deities).toBe("The Sunmother and her three sons.");
    }
  });

  it("trims a blank lore field to null", () => {
    const result = updateReligionInputSchema.safeParse({
      deities: "   ",
      religionId: RELIGION_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deities).toBeNull();
    }
  });

  it("accepts a lore field at the max length", () => {
    const result = updateReligionInputSchema.safeParse({
      deities: "a".repeat(2000),
      religionId: RELIGION_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a lore field over the max length", () => {
    const result = updateReligionInputSchema.safeParse({
      deities: "a".repeat(2001),
      religionId: RELIGION_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("accepts an explicit null lore field", () => {
    const result = updateReligionInputSchema.safeParse({
      deities: null,
      religionId: RELIGION_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deities).toBeNull();
    }
  });
});
