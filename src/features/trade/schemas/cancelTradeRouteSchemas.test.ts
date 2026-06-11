import { describe, expect, it } from "vitest";

import { cancelTradeRouteInputSchema } from "./cancelTradeRouteSchemas";

const TRADE_ROUTE_ID = "11111111-1111-1111-1111-111111111111";

const VALID_BASE = {
  tradeRouteId: TRADE_ROUTE_ID,
};

describe("cancelTradeRouteInputSchema", () => {
  it("accepts a valid tradeRouteId", () => {
    const result = cancelTradeRouteInputSchema.safeParse(VALID_BASE);

    expect(result.success).toBe(true);
  });

  it("rejects invalid tradeRouteId", () => {
    const result = cancelTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      tradeRouteId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.tradeRouteId).toContain(
        "Select a trade route.",
      );
    }
  });

  it("rejects missing tradeRouteId", () => {
    const result = cancelTradeRouteInputSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    const result = cancelTradeRouteInputSchema.safeParse({
      ...VALID_BASE,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });
});
