import { describe, expect, it } from "vitest";

import { createEventGroupInputSchema, eventEffectSchema } from "./eventSchemas";

const TEST_UUID = "123e4567-e89b-42d3-a456-426614174000";

// ---------------------------------------------------------------------------
// eventEffectSchema — per-type required-field validation
// ---------------------------------------------------------------------------
describe("eventEffectSchema", () => {
  describe("amount-based types", () => {
    const amountTypes = [
      "population_boost",
      "population_loss",
      "managed_population_change",
      "resource_grant",
      "resource_drain",
    ] as const;

    const extraForType = (type: string): Record<string, unknown> => {
      if (type === "resource_grant" || type === "resource_drain") {
        return { resourceId: TEST_UUID };
      }
      return {};
    };

    for (const type of amountTypes) {
      it(`${type}: rejects null amountValue`, () => {
        const result = eventEffectSchema.safeParse({
          effectType: type,
          amountValue: null,
          ...extraForType(type),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(
            result.error.issues.some((i) => i.path.includes("amountValue")),
          ).toBe(true);
        }
      });

      it(`${type}: rejects zero amountValue`, () => {
        const result = eventEffectSchema.safeParse({
          effectType: type,
          amountValue: 0,
          ...extraForType(type),
        });
        expect(result.success).toBe(false);
      });

      it(`${type}: accepts non-zero amountValue`, () => {
        const result = eventEffectSchema.safeParse({
          effectType: type,
          amountValue: 10,
          ...extraForType(type),
        });
        expect(result.success).toBe(true);
      });
    }
  });

  describe("multiplier types", () => {
    const multiplierTypes = [
      "consumption_multiplier",
      "production_multiplier",
      "upkeep_multiplier",
    ] as const;

    for (const type of multiplierTypes) {
      it(`${type}: rejects null multiplierValue`, () => {
        const result = eventEffectSchema.safeParse({ effectType: type });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(
            result.error.issues.some((i) => i.path.includes("multiplierValue")),
          ).toBe(true);
        }
      });

      it(`${type}: rejects zero multiplierValue`, () => {
        const result = eventEffectSchema.safeParse({
          effectType: type,
          multiplierValue: 0,
        });
        expect(result.success).toBe(false);
      });

      it(`${type}: accepts non-zero multiplierValue`, () => {
        const result = eventEffectSchema.safeParse({
          effectType: type,
          multiplierValue: 1.5,
        });
        expect(result.success).toBe(true);
      });
    }
  });

  describe("resource effects", () => {
    it("resource_grant: rejects missing resourceId", () => {
      const result = eventEffectSchema.safeParse({
        effectType: "resource_grant",
        amountValue: 5,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path.includes("resourceId")),
        ).toBe(true);
      }
    });

    it("resource_drain: rejects missing resourceId", () => {
      const result = eventEffectSchema.safeParse({
        effectType: "resource_drain",
        amountValue: 5,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path.includes("resourceId")),
        ).toBe(true);
      }
    });
  });

  describe("deposit_destroyed", () => {
    it("rejects missing depositInstanceId", () => {
      const result = eventEffectSchema.safeParse({
        effectType: "deposit_destroyed",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path.includes("depositInstanceId")),
        ).toBe(true);
      }
    });

    it("accepts valid depositInstanceId", () => {
      const result = eventEffectSchema.safeParse({
        effectType: "deposit_destroyed",
        depositInstanceId: TEST_UUID,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("building_destroyed", () => {
    it("rejects missing settlementBuildingId", () => {
      const result = eventEffectSchema.safeParse({
        effectType: "building_destroyed",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.path.includes("settlementBuildingId"),
          ),
        ).toBe(true);
      }
    });

    it("accepts valid settlementBuildingId", () => {
      const result = eventEffectSchema.safeParse({
        effectType: "building_destroyed",
        settlementBuildingId: TEST_UUID,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("deposit_discovered (no extra required fields)", () => {
    it("accepts without any optional fields", () => {
      const result = eventEffectSchema.safeParse({
        effectType: "deposit_discovered",
      });
      expect(result.success).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// createEventGroupInputSchema — narrative-only (empty effects) allowed
// ---------------------------------------------------------------------------
describe("createEventGroupInputSchema", () => {
  const baseInput = {
    worldId: TEST_UUID,
    groupName: "Test Event",
    effects: [],
    scopeType: "world" as const,
    targets: [{ scope_name: "World" }],
    durationType: "instant" as const,
    activationTurn: 1,
    createCitizenMemories: false,
  };

  it("accepts empty effects array (narrative-only event)", () => {
    const result = createEventGroupInputSchema.safeParse(baseInput);
    expect(result.success).toBe(true);
  });

  it("rejects an effect with missing required fields inside the array", () => {
    const result = createEventGroupInputSchema.safeParse({
      ...baseInput,
      effects: [{ effectType: "resource_grant", amountValue: 5 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Path: ["effects", 0, "resourceId"]
      expect(
        result.error.issues.some(
          (i) =>
            i.path[0] === "effects" &&
            i.path[1] === 0 &&
            i.path[2] === "resourceId",
        ),
      ).toBe(true);
    }
  });
});
