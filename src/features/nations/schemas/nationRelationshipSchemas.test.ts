import { describe, expect, it } from "vitest";

import {
  proposeBilateralInputSchema,
  setUnilateralStanceInputSchema,
} from "./nationRelationshipSchemas";

const FROM_NATION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TO_NATION_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("setUnilateralStanceInputSchema", () => {
  it("accepts distinct nation IDs with a valid stance", () => {
    const result = setUnilateralStanceInputSchema.safeParse({
      fromNationId: FROM_NATION_ID,
      stance: "hostile",
      toNationId: TO_NATION_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects when fromNationId and toNationId are the same", () => {
    const result = setUnilateralStanceInputSchema.safeParse({
      fromNationId: FROM_NATION_ID,
      stance: "neutral",
      toNationId: FROM_NATION_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.toNationId).toContain(
        "A nation cannot have a relationship with itself.",
      );
    }
  });

  it("rejects an invalid stance enum value", () => {
    const result = setUnilateralStanceInputSchema.safeParse({
      fromNationId: FROM_NATION_ID,
      stance: "enemy",
      toNationId: TO_NATION_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("proposeBilateralInputSchema", () => {
  it("accepts distinct nation IDs with a valid stance", () => {
    const result = proposeBilateralInputSchema.safeParse({
      fromNationId: FROM_NATION_ID,
      stance: "allied",
      toNationId: TO_NATION_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects when fromNationId and toNationId are the same", () => {
    const result = proposeBilateralInputSchema.safeParse({
      fromNationId: FROM_NATION_ID,
      stance: "non_aggression_pact",
      toNationId: FROM_NATION_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.toNationId).toContain(
        "A nation cannot have a relationship with itself.",
      );
    }
  });
});
