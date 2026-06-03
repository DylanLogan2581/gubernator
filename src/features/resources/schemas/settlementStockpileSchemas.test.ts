import { describe, expect, it } from "vitest";

import { updateSettlementStockpileInputSchema } from "./settlementStockpileSchemas";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const RESOURCE_ID = "22222222-2222-2222-2222-222222222222";

describe("updateSettlementStockpileInputSchema", () => {
  it("accepts valid whole-number quantity", () => {
    const result = updateSettlementStockpileInputSchema.safeParse({
      quantity: "100",
      resourceId: RESOURCE_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(100);
    }
  });

  it("accepts valid decimal quantity with up to four decimal places", () => {
    const result = updateSettlementStockpileInputSchema.safeParse({
      quantity: "99.1234",
      resourceId: RESOURCE_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBeCloseTo(99.1234, 4);
    }
  });

  it("accepts zero quantity", () => {
    const result = updateSettlementStockpileInputSchema.safeParse({
      quantity: "0",
      resourceId: RESOURCE_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(0);
    }
  });

  it("rejects negative quantity", () => {
    const result = updateSettlementStockpileInputSchema.safeParse({
      quantity: "-1",
      resourceId: RESOURCE_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-decimal string quantity", () => {
    const result = updateSettlementStockpileInputSchema.safeParse({
      quantity: "not-a-number",
      resourceId: RESOURCE_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects quantity with more than four decimal places", () => {
    const result = updateSettlementStockpileInputSchema.safeParse({
      quantity: "1.12345",
      resourceId: RESOURCE_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid settlementId", () => {
    const result = updateSettlementStockpileInputSchema.safeParse({
      quantity: "10",
      resourceId: RESOURCE_ID,
      settlementId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid resourceId", () => {
    const result = updateSettlementStockpileInputSchema.safeParse({
      quantity: "10",
      resourceId: "not-a-uuid",
      settlementId: SETTLEMENT_ID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = updateSettlementStockpileInputSchema.safeParse({
      settlementId: SETTLEMENT_ID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strictObject)", () => {
    const result = updateSettlementStockpileInputSchema.safeParse({
      extra: "field",
      quantity: "10",
      resourceId: RESOURCE_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(result.success).toBe(false);
  });
});
