import { describe, expect, it } from "vitest";

import { replaceTradeRouteInputSchema } from "./replaceTradeRouteSchemas";

const OLD_ROUTE_ID = "00000000-0000-0000-0000-000000000001";
const ORIGIN_ID = "11111111-1111-1111-1111-111111111111";
const DEST_ID = "22222222-2222-2222-2222-222222222222";
const RESOURCE_ID = "33333333-3333-3333-3333-333333333333";
const CITIZEN_ID = "44444444-4444-4444-4444-444444444444";

const VALID_BASE = {
  newRoutePayload: {
    destinationSettlementId: DEST_ID,
    originSettlementId: ORIGIN_ID,
    quantityPerTransition: 10,
    resourceId: RESOURCE_ID,
  },
  oldRouteId: OLD_ROUTE_ID,
  proposingCitizenId: CITIZEN_ID,
};

describe("replaceTradeRouteInputSchema", () => {
  it("accepts valid input", () => {
    const result = replaceTradeRouteInputSchema.safeParse(VALID_BASE);

    expect(result.success).toBe(true);
  });

  it("accepts fractional quantity", () => {
    const result = replaceTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      newRoutePayload: {
        ...VALID_BASE.newRoutePayload,
        quantityPerTransition: 0.5,
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects self-loop (same origin and destination)", () => {
    const result = replaceTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      newRoutePayload: {
        ...VALID_BASE.newRoutePayload,
        destinationSettlementId: ORIGIN_ID,
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toBeDefined();
    }
  });

  it("rejects quantity of zero", () => {
    const result = replaceTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      newRoutePayload: {
        ...VALID_BASE.newRoutePayload,
        quantityPerTransition: 0,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative quantity", () => {
    const result = replaceTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      newRoutePayload: {
        ...VALID_BASE.newRoutePayload,
        quantityPerTransition: -1,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid oldRouteId", () => {
    const result = replaceTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      oldRouteId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.oldRouteId).toContain(
        "Old route id must be a valid UUID.",
      );
    }
  });

  it("rejects invalid proposingCitizenId", () => {
    const result = replaceTradeRouteInputSchema.safeParse({
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

  it("rejects invalid originSettlementId in payload", () => {
    const result = replaceTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      newRoutePayload: {
        ...VALID_BASE.newRoutePayload,
        originSettlementId: "not-a-uuid",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid resourceId in payload", () => {
    const result = replaceTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      newRoutePayload: {
        ...VALID_BASE.newRoutePayload,
        resourceId: "not-a-uuid",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    const result = replaceTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields in newRoutePayload", () => {
    const result = replaceTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      newRoutePayload: { ...VALID_BASE.newRoutePayload, unknownField: "value" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing newRoutePayload", () => {
    const result = replaceTradeRouteInputSchema.safeParse({
      oldRouteId: OLD_ROUTE_ID,
      proposingCitizenId: CITIZEN_ID,
    });

    expect(result.success).toBe(false);
  });
});
