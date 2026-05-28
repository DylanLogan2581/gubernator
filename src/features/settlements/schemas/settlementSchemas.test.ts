import { describe, expect, it } from "vitest";

import {
  createSettlementInputSchema,
  updateSettlementCoordinatesInputSchema,
} from "./settlementSchemas";

const NATION_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const SETTLEMENT_ID = "33333333-3333-3333-3333-333333333333";

describe("coordinateSchema", () => {
  it("accepts a finite number", () => {
    const result = updateSettlementCoordinatesInputSchema.safeParse({
      coordX: 100,
      coordZ: -200,
      nationId: NATION_ID,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects Infinity", () => {
    const result = updateSettlementCoordinatesInputSchema.safeParse({
      coordX: Infinity,
      coordZ: 0,
      nationId: NATION_ID,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects -Infinity", () => {
    const result = updateSettlementCoordinatesInputSchema.safeParse({
      coordX: 0,
      coordZ: -Infinity,
      nationId: NATION_ID,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects NaN", () => {
    const result = updateSettlementCoordinatesInputSchema.safeParse({
      coordX: NaN,
      coordZ: 0,
      nationId: NATION_ID,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("settlementDescriptionSchema", () => {
  it("passes a non-empty string through unchanged", () => {
    const result = createSettlementInputSchema.safeParse({
      description: "A fortress city.",
      name: "Ironhold",
      nationId: NATION_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.description).toBe("A fortress city.");
    }
  });

  it("trims a whitespace-only string to null", () => {
    const result = createSettlementInputSchema.safeParse({
      description: "   ",
      name: "Ironhold",
      nationId: NATION_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.description).toBeNull();
    }
  });

  it("trims an empty string to null", () => {
    const result = createSettlementInputSchema.safeParse({
      description: "",
      name: "Ironhold",
      nationId: NATION_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.description).toBeNull();
    }
  });
});
