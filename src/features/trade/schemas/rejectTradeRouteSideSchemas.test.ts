import { describe, expect, it } from "vitest";

import { rejectTradeRouteSideInputSchema } from "./rejectTradeRouteSideSchemas";

const TRADE_ROUTE_ID = "11111111-1111-1111-1111-111111111111";
const CITIZEN_ID = "22222222-2222-2222-2222-222222222222";

const VALID_BASE = {
  rejectorCitizenId: CITIZEN_ID,
  side: "origin" as const,
  tradeRouteId: TRADE_ROUTE_ID,
};

describe("rejectTradeRouteSideInputSchema", () => {
  it("accepts valid origin side input", () => {
    const result = rejectTradeRouteSideInputSchema.safeParse(VALID_BASE);

    expect(result.success).toBe(true);
  });

  it("accepts valid destination side input", () => {
    const result = rejectTradeRouteSideInputSchema.safeParse({
      ...VALID_BASE,
      side: "destination",
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown side value", () => {
    const result = rejectTradeRouteSideInputSchema.safeParse({
      ...VALID_BASE,
      side: "both",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.side).toBeDefined();
    }
  });

  it("rejects invalid tradeRouteId", () => {
    const result = rejectTradeRouteSideInputSchema.safeParse({
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

  it("rejects invalid rejectorCitizenId", () => {
    const result = rejectTradeRouteSideInputSchema.safeParse({
      ...VALID_BASE,
      rejectorCitizenId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.rejectorCitizenId).toContain(
        "Select a rejector.",
      );
    }
  });

  it("rejects unknown top-level fields", () => {
    const result = rejectTradeRouteSideInputSchema.safeParse({
      ...VALID_BASE,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing tradeRouteId", () => {
    const { tradeRouteId: _omitted, ...rest } = VALID_BASE;
    const result = rejectTradeRouteSideInputSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it("rejects missing rejectorCitizenId", () => {
    const { rejectorCitizenId: _omitted, ...rest } = VALID_BASE;
    const result = rejectTradeRouteSideInputSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it("rejects missing side", () => {
    const { side: _omitted, ...rest } = VALID_BASE;
    const result = rejectTradeRouteSideInputSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });
});
