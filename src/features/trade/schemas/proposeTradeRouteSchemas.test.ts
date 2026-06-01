import { describe, expect, it } from "vitest";

import { proposeTradeRouteInputSchema } from "./proposeTradeRouteSchemas";

const ORIGIN_ID = "11111111-1111-1111-1111-111111111111";
const DEST_ID = "22222222-2222-2222-2222-222222222222";
const RESOURCE_ID = "33333333-3333-3333-3333-333333333333";
const CITIZEN_ID = "44444444-4444-4444-4444-444444444444";

const VALID_BASE = {
  destinationSettlementId: DEST_ID,
  originSettlementId: ORIGIN_ID,
  proposingCitizenId: CITIZEN_ID,
  quantityPerTransition: 10,
  resourceId: RESOURCE_ID,
};

describe("proposeTradeRouteInputSchema", () => {
  it("accepts valid input", () => {
    const result = proposeTradeRouteInputSchema.safeParse(VALID_BASE);

    expect(result.success).toBe(true);
  });

  it("accepts fractional quantity", () => {
    const result = proposeTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      quantityPerTransition: 0.25,
    });

    expect(result.success).toBe(true);
  });

  it("rejects self-loop (same origin and destination)", () => {
    const result = proposeTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      destinationSettlementId: ORIGIN_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.destinationSettlementId,
      ).toContain("Origin and destination settlements must be different.");
    }
  });

  it("rejects quantity of zero", () => {
    const result = proposeTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      quantityPerTransition: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.quantityPerTransition,
      ).toBeDefined();
    }
  });

  it("rejects negative quantity", () => {
    const result = proposeTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      quantityPerTransition: -5,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.quantityPerTransition,
      ).toBeDefined();
    }
  });

  it("rejects invalid originSettlementId", () => {
    const result = proposeTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      originSettlementId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.originSettlementId).toContain(
        "Origin settlement id must be a valid UUID.",
      );
    }
  });

  it("rejects invalid destinationSettlementId", () => {
    const result = proposeTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      destinationSettlementId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.destinationSettlementId,
      ).toBeDefined();
    }
  });

  it("rejects invalid resourceId", () => {
    const result = proposeTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      resourceId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.resourceId).toContain(
        "Resource id must be a valid UUID.",
      );
    }
  });

  it("rejects invalid proposingCitizenId", () => {
    const result = proposeTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      proposingCitizenId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.proposingCitizenId).toContain(
        "Proposing citizen id must be a valid UUID.",
      );
    }
  });

  it("rejects unknown top-level fields", () => {
    const result = proposeTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });
});
