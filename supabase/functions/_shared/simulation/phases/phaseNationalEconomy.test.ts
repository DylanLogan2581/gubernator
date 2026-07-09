// Unit tests for phaseNationalEconomy — tax collection in kind from
// settlement production to the settlement's nation (#1083).
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseNationalEconomy } from "./phaseNationalEconomy.ts";
import { makeContext, makeCurrency, makeLedgerEntry, makeNation, makeSettlement } from "./testFixtures.ts";

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
      {
  nationId: "n1",
  taxCollectedByResource: { food: 10 },
  tributePaidByResource: {},
  tributeReceivedByResource: {},
},
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
      {
  nationId: "n1",
  taxCollectedByResource: { food: 15 },
  tributePaidByResource: {},
  tributeReceivedByResource: {},
},
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

describe("phaseNationalEconomy — currency confidence (#1094)", () => {
  it("drops fiat confidence when overminting exceeds the 5%/turn growth threshold", () => {
    const ctx = makeContext({
      nationCurrencies: [
        makeCurrency({
          id: "c1",
          nationId: "n1",
          confidence: 1,
          currencyType: "fiat",
          moneySupply: 1000,
        }),
      ],
      nationCurrencyLedgerEntries: [
        makeLedgerEntry({ currencyId: "c1", action: "mint", amount: 200 }),
      ],
    });

    const result = phaseNationalEconomy(ctx, []);

    // moneySupplyStart = 1000 - 200 = 800; growth = 200/800 = 0.25
    // penalty = (0.25 - 0.05) * 0.5 = 0.1; confidence = 1 - 0.1 + 0.02 = 0.92
    expect(result.nationCurrencySnapshots).toEqual([
      {
        burned: 0,
        confidence: 0.92,
        currencyId: "c1",
        minted: 200,
        moneySupply: 1000,
        nationId: "n1",
        reserveQuantity: 0,
      },
    ]);
    expect(result.nationCurrencyUpdates).toEqual([
      { confidence: 0.92, currencyId: "c1", isInDefault: false },
    ]);
    expect(result.notifications).toHaveLength(0);
  });

  it("recovers fiat confidence toward 1 by 0.02/turn when supply is stable", () => {
    const ctx = makeContext({
      nationCurrencies: [
        makeCurrency({
          id: "c1",
          nationId: "n1",
          confidence: 0.5,
          currencyType: "fiat",
          moneySupply: 1000,
        }),
      ],
    });

    const result = phaseNationalEconomy(ctx, []);

    expect(result.nationCurrencySnapshots[0]).toMatchObject({ confidence: 0.52 });
  });

  it("emits a collapsing-confidence warning notification below 0.25", () => {
    const ctx = makeContext({
      nationCurrencies: [
        makeCurrency({
          id: "c1",
          nationId: "n1",
          confidence: 0.1,
          currencyType: "fiat",
          moneySupply: 1000,
          name: "Testmark",
        }),
      ],
    });

    const result = phaseNationalEconomy(ctx, []);

    expect(result.nationCurrencySnapshots[0].confidence).toBeCloseTo(0.12);
    expect(result.notifications).toEqual([
      {
        messageText: "Confidence in Testmark is collapsing.",
        nationId: "n1",
        notificationType: "currency.confidence_collapsing",
        scope: "nation",
      },
    ]);
  });

  it("emits a currency_default log + notification when reserves no longer back the money supply", () => {
    const ctx = makeContext({
      nationCurrencies: [
        makeCurrency({
          id: "c1",
          nationId: "n1",
          backingRatio: 1,
          confidence: 1,
          currencyType: "resource_backed",
          moneySupply: 100,
          reserveQuantity: 50,
          name: "Goldmark",
        }),
      ],
    });

    const result = phaseNationalEconomy(ctx, []);

    expect(result.nationCurrencySnapshots).toEqual([
      {
        burned: 0,
        confidence: 0,
        currencyId: "c1",
        minted: 0,
        moneySupply: 100,
        nationId: "n1",
        reserveQuantity: 50,
      },
    ]);
    expect(result.nationCurrencyUpdates).toEqual([
      { confidence: 0, currencyId: "c1", isInDefault: true },
    ]);
    expect(result.logs).toEqual([
      {
        category: "currency_default",
        nationId: "n1",
        payload: { backingRatio: 1, currencyId: "c1", moneySupply: 100, reserveQuantity: 50 },
        phase: "nationalEconomy",
      },
    ]);
    expect(result.notifications).toEqual([
      {
        messageText: "Goldmark has defaulted — reserves no longer back the money supply.",
        nationId: "n1",
        notificationType: "currency.default",
        scope: "nation",
      },
    ]);
  });

  it("#1135: does not re-emit currency_default log/notification while a currency stays in default", () => {
    const ctx = makeContext({
      nationCurrencies: [
        makeCurrency({
          id: "c1",
          nationId: "n1",
          backingRatio: 1,
          confidence: 0,
          currencyType: "resource_backed",
          isInDefault: true,
          moneySupply: 100,
          reserveQuantity: 50,
          name: "Goldmark",
        }),
      ],
    });

    const result = phaseNationalEconomy(ctx, []);

    expect(result.nationCurrencyUpdates).toEqual([
      { confidence: 0, currencyId: "c1", isInDefault: true },
    ]);
    expect(result.logs).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("keeps a fully-backed resource_backed currency out of default", () => {
    const ctx = makeContext({
      nationCurrencies: [
        makeCurrency({
          id: "c1",
          nationId: "n1",
          backingRatio: 1,
          confidence: 1,
          currencyType: "resource_backed",
          moneySupply: 50,
          reserveQuantity: 100,
        }),
      ],
    });

    const result = phaseNationalEconomy(ctx, []);

    expect(result.nationCurrencySnapshots[0]).toMatchObject({ confidence: 1 });
    expect(result.nationCurrencyUpdates).toEqual([
      { confidence: 1, currencyId: "c1", isInDefault: false },
    ]);
    expect(result.logs).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("sums minted/burned ledger amounts per currency for the snapshot row", () => {
    const ctx = makeContext({
      nationCurrencies: [
        makeCurrency({ id: "c1", nationId: "n1", currencyType: "fiat", moneySupply: 500 }),
      ],
      nationCurrencyLedgerEntries: [
        makeLedgerEntry({ currencyId: "c1", action: "mint", amount: 100 }),
        makeLedgerEntry({ currencyId: "c1", action: "mint", amount: 50 }),
        makeLedgerEntry({ currencyId: "c1", action: "burn", amount: 30 }),
        // deposit/redeem entries never affect minted/burned totals.
        makeLedgerEntry({ currencyId: "c1", action: "deposit", amount: null }),
      ],
    });

    const result = phaseNationalEconomy(ctx, []);

    expect(result.nationCurrencySnapshots[0]).toMatchObject({
      burned: 30,
      currencyId: "c1",
      minted: 150,
      nationId: "n1",
    });
  });
});
