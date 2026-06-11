import { describe, expect, it } from "vitest";

import { approveTradeRouteSideInputSchema } from "./approveTradeRouteSideSchemas";

const TRADE_ROUTE_ID = "11111111-1111-1111-1111-111111111111";
const CITIZEN_ID = "22222222-2222-2222-2222-222222222222";

const VALID_BASE = {
  approverCitizenId: CITIZEN_ID,
  side: "origin" as const,
  tradeRouteId: TRADE_ROUTE_ID,
};

describe("approveTradeRouteSideInputSchema", () => {
  it("accepts valid origin side input", () => {
    const result = approveTradeRouteSideInputSchema.safeParse(VALID_BASE);

    expect(result.success).toBe(true);
  });

  it("accepts valid destination side input", () => {
    const result = approveTradeRouteSideInputSchema.safeParse({
      ...VALID_BASE,
      side: "destination",
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown side value", () => {
    const result = approveTradeRouteSideInputSchema.safeParse({
      ...VALID_BASE,
      side: "both",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.side).toBeDefined();
    }
  });

  it("rejects invalid tradeRouteId", () => {
    const result = approveTradeRouteSideInputSchema.safeParse({
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

  it("rejects invalid approverCitizenId", () => {
    const result = approveTradeRouteSideInputSchema.safeParse({
      ...VALID_BASE,
      approverCitizenId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.approverCitizenId).toContain(
        "Select an approver.",
      );
    }
  });

  it("rejects unknown top-level fields", () => {
    const result = approveTradeRouteSideInputSchema.safeParse({
      ...VALID_BASE,
      unknownField: "value",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing tradeRouteId", () => {
    const { tradeRouteId: _omitted, ...rest } = VALID_BASE;
    const result = approveTradeRouteSideInputSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it("rejects missing approverCitizenId", () => {
    const { approverCitizenId: _omitted, ...rest } = VALID_BASE;
    const result = approveTradeRouteSideInputSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it("rejects missing side", () => {
    const { side: _omitted, ...rest } = VALID_BASE;
    const result = approveTradeRouteSideInputSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });
});
