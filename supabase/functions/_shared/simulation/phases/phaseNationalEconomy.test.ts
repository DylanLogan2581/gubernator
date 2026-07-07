// Unit tests for phaseNationalEconomy — tax collection in kind from
// settlement production to the settlement's nation (#1083).
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseNationalEconomy } from "./phaseNationalEconomy.ts";
import { makeContext, makeNation, makeSettlement } from "./testFixtures.ts";

import type { StockpileDelta } from "../simulationTypes.ts";

function production(
  settlementId: string,
  resourceId: string,
  delta: number,
): StockpileDelta {
  return { delta, resourceId, settlementId };
}

describe("phaseNationalEconomy — regression-safe default", () => {
  it("collects nothing when tax_rate is 0", () => {
    const ctx = makeContext({
      nations: [makeNation({ id: "n1", taxRate: 0 })],
      settlements: [makeSettlement({ id: "s1", nationId: "n1" })],
    });
    ctx.shared.pendingStockpiles.set("s1:food", 100);

    const result = phaseNationalEconomy(ctx, [production("s1", "food", 50)]);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.nationStockpileDeltas).toHaveLength(0);
    expect(result.nationTurnSnapshots).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
  });

  it("collects nothing for a settlement with no nation", () => {
    const ctx = makeContext({
      settlements: [makeSettlement({ id: "s1" })],
    });
    ctx.shared.pendingStockpiles.set("s1:food", 100);

    const result = phaseNationalEconomy(ctx, [production("s1", "food", 50)]);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.nationStockpileDeltas).toHaveLength(0);
    expect(result.nationTurnSnapshots).toHaveLength(0);
  });
});

describe("phaseNationalEconomy — government efficiency", () => {
  it("taxes production x tax_rate x efficiency for monarchy (1.0)", () => {
    const ctx = makeContext({
      nations: [makeNation({ governmentType: "monarchy", id: "n1", taxRate: 0.1 })],
      settlements: [makeSettlement({ id: "s1", nationId: "n1" })],
    });
    ctx.shared.pendingStockpiles.set("s1:food", 200);

    const result = phaseNationalEconomy(ctx, [production("s1", "food", 100)]);

    // 100 * 0.1 * 1.0 = 10
    expect(result.stockpileDeltas).toEqual([
      { delta: -10, resourceId: "food", settlementId: "s1" },
    ]);
    expect(result.nationStockpileDeltas).toEqual([
      { delta: 10, nationId: "n1", resourceId: "food" },
    ]);
    expect(result.nationTurnSnapshots).toEqual([
      { nationId: "n1", taxCollectedByResource: { food: 10 } },
    ]);
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]).toMatchObject({
      category: "economy",
      nationId: "n1",
      phase: "nationalEconomy",
      payload: {
        bySettlement: [{ amount: 10, resourceId: "food", settlementId: "s1" }],
        totalsByResource: { food: 10 },
      },
    });
  });

  it("taxes production x tax_rate x efficiency for republic (1.1)", () => {
    const ctx = makeContext({
      nations: [makeNation({ governmentType: "republic", id: "n1", taxRate: 0.1 })],
      settlements: [makeSettlement({ id: "s1", nationId: "n1" })],
    });
    ctx.shared.pendingStockpiles.set("s1:food", 200);

    const result = phaseNationalEconomy(ctx, [production("s1", "food", 100)]);

    // 100 * 0.1 * 1.1 = 11
    expect(result.stockpileDeltas).toEqual([
      { delta: -11, resourceId: "food", settlementId: "s1" },
    ]);
    expect(result.nationStockpileDeltas).toEqual([
      { delta: 11, nationId: "n1", resourceId: "food" },
    ]);
  });

  it("floors the computed tax rather than rounding", () => {
    const ctx = makeContext({
      nations: [makeNation({ governmentType: "theocracy", id: "n1", taxRate: 0.33 })],
      settlements: [makeSettlement({ id: "s1", nationId: "n1" })],
    });
    ctx.shared.pendingStockpiles.set("s1:food", 200);

    const result = phaseNationalEconomy(ctx, [production("s1", "food", 100)]);

    // 100 * 0.33 * 0.9 = 29.7 -> floors to 29.7 (already at 4dp scale, no rounding up)
    expect(result.nationStockpileDeltas).toEqual([
      { delta: 29.7, nationId: "n1", resourceId: "food" },
    ]);
  });
});

describe("phaseNationalEconomy — caps at available stock", () => {
  it("caps tax at the settlement's currently available stockpile", () => {
    const ctx = makeContext({
      nations: [makeNation({ governmentType: "monarchy", id: "n1", taxRate: 0.5 })],
      settlements: [makeSettlement({ id: "s1", nationId: "n1" })],
    });
    ctx.shared.pendingStockpiles.set("s1:food", 200);

    // 1000 * 0.5 * 1.0 = 500, but only 200 is available.
    const result = phaseNationalEconomy(ctx, [production("s1", "food", 1000)]);

    expect(result.stockpileDeltas).toEqual([
      { delta: -200, resourceId: "food", settlementId: "s1" },
    ]);
    expect(result.nationStockpileDeltas).toEqual([
      { delta: 200, nationId: "n1", resourceId: "food" },
    ]);
  });

  it("collects nothing when the settlement has no stock available", () => {
    const ctx = makeContext({
      nations: [makeNation({ id: "n1", taxRate: 0.5 })],
      settlements: [makeSettlement({ id: "s1", nationId: "n1" })],
    });
    ctx.shared.pendingStockpiles.set("s1:food", 0);

    const result = phaseNationalEconomy(ctx, [production("s1", "food", 100)]);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.nationStockpileDeltas).toHaveLength(0);
    expect(result.nationTurnSnapshots).toHaveLength(0);
  });
});

describe("phaseNationalEconomy — aggregation across settlements", () => {
  it("credits one nation-level delta and snapshot for multiple settlements", () => {
    const ctx = makeContext({
      nations: [makeNation({ governmentType: "monarchy", id: "n1", taxRate: 0.1 })],
      settlements: [
        makeSettlement({ id: "s1", nationId: "n1" }),
        makeSettlement({ id: "s2", nationId: "n1" }),
      ],
    });
    ctx.shared.pendingStockpiles.set("s1:food", 200);
    ctx.shared.pendingStockpiles.set("s2:food", 200);

    const result = phaseNationalEconomy(ctx, [
      production("s1", "food", 100),
      production("s2", "food", 50),
    ]);

    expect(result.stockpileDeltas).toEqual([
      { delta: -10, resourceId: "food", settlementId: "s1" },
      { delta: -5, resourceId: "food", settlementId: "s2" },
    ]);
    expect(result.nationStockpileDeltas).toEqual([
      { delta: 15, nationId: "n1", resourceId: "food" },
    ]);
    expect(result.nationTurnSnapshots).toEqual([
      { nationId: "n1", taxCollectedByResource: { food: 15 } },
    ]);
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].payload).toEqual({
      bySettlement: [
        { amount: 10, resourceId: "food", settlementId: "s1" },
        { amount: 5, resourceId: "food", settlementId: "s2" },
      ],
      totalsByResource: { food: 15 },
    });
  });
});
