import { describe, expect, it } from "vitest";

import { phaseStockpileClamp } from "./phaseStockpileClamp.ts";

import type {
  SimulationContext,
  SimulationInputState,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Minimal test helpers
// ---------------------------------------------------------------------------

const CALENDAR_CONFIG: SimulationInputState["calendarConfig"] = {
  dateFormatTemplate: "{year}",
  months: [{ dayCount: 30, index: 0, name: "Jan" }],
  startingDayOfMonth: 1,
  startingMonthIndex: 0,
  startingWeekdayOffset: 0,
  startingYear: 1,
  weekdays: [{ index: 0, name: "Mon" }],
};

const POPULATION_RULES: SimulationInputState["populationRules"] = {
  fertilityChance: 0,
  foodConsumptionPerCitizen: 0,
  homelessnessDecliningRate: 0,
  incestPreventionDepth: 0,
  maximumFertilityAgeTurns: null,
  minimumPartnershipAgeTurns: 0,
  mourningPeriodTurns: 0,
  partnershipSeekChance: 0,
  starvationSeverityMultiplier: 0,
  waterConsumptionPerCitizen: 0,
};

function makeContext(
  overrides: Partial<SimulationInputState>,
): SimulationContext {
  const input: SimulationInputState = {
    buildingBlueprints: [],
    buildingTiers: [],
    calendarConfig: CALENDAR_CONFIG,
    citizenAssignments: [],
    citizens: [],
    constructionProjects: [],
    deconstructOvershootLedger: [],
    depositTypes: [],
    deposits: [],
    events: [],
    jobs: [],
    managedPopulationTypes: [],
    managedPopulations: [],
    partnerships: [],
    populationRules: POPULATION_RULES,
    settlementBuildings: [],
    settlementId: "s1",
    settlements: [],
    stockpiles: [],
    systemResourceIds: { foodId: "food", freshWaterId: "fresh-water" },
    tradeRoutes: [],
    turnNumber: 1,
    worldId: "w1",
    ...overrides,
  };
  return { input };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseStockpileClamp", () => {
  it("returns empty output when pending stockpiles map is empty", () => {
    const ctx = makeContext({});
    const pending = new Map<string, number>();
    const result = phaseStockpileClamp(ctx, pending, new Map());

    expect(result.logs).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
  });

  it("clamps negative pre-clamp quantity to 0", () => {
    const ctx = makeContext({
      stockpiles: [
        { cap: 100, quantity: 0, resourceId: "r1", settlementId: "s1" },
      ],
    });
    const pending = new Map([["s1:r1", -10]]);
    const result = phaseStockpileClamp(ctx, pending, new Map([["s1:r1", 100]]));

    expect(result.stockpileDeltas).toHaveLength(1);
    expect(result.stockpileDeltas[0]?.delta).toBe(10);
    expect(result.stockpileDeltas[0]?.settlementId).toBe("s1");
    expect(result.stockpileDeltas[0]?.resourceId).toBe("r1");

    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]?.category).toBe("stockpile.clamped");
    expect(result.logs[0]?.phase).toBe("stockpileClamp");
    expect(result.logs[0]?.payload.pre).toBe(-10);
    expect(result.logs[0]?.payload.post).toBe(0);
    expect(result.logs[0]?.payload.reason).toBe("negative");

    expect(pending.get("s1:r1")).toBe(0);
  });

  it("clamps over-cap quantity down to effectiveStorageCap", () => {
    const ctx = makeContext({
      stockpiles: [
        { cap: 100, quantity: 0, resourceId: "r1", settlementId: "s1" },
      ],
    });
    const pending = new Map([["s1:r1", 150]]);
    const result = phaseStockpileClamp(ctx, pending, new Map([["s1:r1", 100]]));

    expect(result.stockpileDeltas).toHaveLength(1);
    expect(result.stockpileDeltas[0]?.delta).toBe(-50);

    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]?.payload.pre).toBe(150);
    expect(result.logs[0]?.payload.post).toBe(100);
    expect(result.logs[0]?.payload.reason).toBe("over_cap");
    expect(result.logs[0]?.payload.effectiveCap).toBe(100);

    expect(pending.get("s1:r1")).toBe(100);
  });

  it("does not clamp quantity exactly equal to effectiveStorageCap", () => {
    const ctx = makeContext({
      stockpiles: [
        { cap: 100, quantity: 0, resourceId: "r1", settlementId: "s1" },
      ],
    });
    const pending = new Map([["s1:r1", 100]]);
    const result = phaseStockpileClamp(ctx, pending, new Map([["s1:r1", 100]]));

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(pending.get("s1:r1")).toBe(100);
  });

  it("does not clamp quantity below effectiveStorageCap", () => {
    const ctx = makeContext({
      stockpiles: [
        { cap: 100, quantity: 0, resourceId: "r1", settlementId: "s1" },
      ],
    });
    const pending = new Map([["s1:r1", 50]]);
    const result = phaseStockpileClamp(ctx, pending, new Map([["s1:r1", 100]]));

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(pending.get("s1:r1")).toBe(50);
  });

  it("defaults to base resource cap from stockpile when effectiveStorageCaps has no entry", () => {
    const ctx = makeContext({
      stockpiles: [
        { cap: 80, quantity: 0, resourceId: "r1", settlementId: "s1" },
      ],
    });
    const pending = new Map([["s1:r1", 120]]);
    // empty effectiveStorageCaps — falls back to sp.cap = 80
    const result = phaseStockpileClamp(ctx, pending, new Map());

    expect(result.stockpileDeltas).toHaveLength(1);
    expect(result.stockpileDeltas[0]?.delta).toBe(-40);
    expect(result.logs[0]?.payload.effectiveCap).toBe(80);
    expect(pending.get("s1:r1")).toBe(80);
  });

  it("clamps multiple stockpiles independently, skipping those within range", () => {
    const ctx = makeContext({
      stockpiles: [
        { cap: 100, quantity: 0, resourceId: "r1", settlementId: "s1" },
        { cap: 50, quantity: 0, resourceId: "r2", settlementId: "s1" },
      ],
    });
    const pending = new Map([
      ["s1:r1", 200],
      ["s1:r2", 30],
    ]);
    const effectiveCaps = new Map([
      ["s1:r1", 100],
      ["s1:r2", 50],
    ]);
    const result = phaseStockpileClamp(ctx, pending, effectiveCaps);

    expect(result.stockpileDeltas).toHaveLength(1);
    expect(result.stockpileDeltas[0]?.resourceId).toBe("r1");
    expect(result.stockpileDeltas[0]?.delta).toBe(-100);
    expect(result.logs).toHaveLength(1);

    expect(pending.get("s1:r1")).toBe(100);
    expect(pending.get("s1:r2")).toBe(30);
  });

  it("property: post-clamp values are always in [0, effectiveStorageCap]", () => {
    const ctx = makeContext({
      stockpiles: [
        { cap: 100, quantity: 0, resourceId: "r1", settlementId: "s1" },
        { cap: 100, quantity: 0, resourceId: "r2", settlementId: "s1" },
        { cap: 100, quantity: 0, resourceId: "r3", settlementId: "s1" },
        { cap: 100, quantity: 0, resourceId: "r4", settlementId: "s1" },
      ],
    });
    const pending = new Map([
      ["s1:r1", -50],
      ["s1:r2", 150],
      ["s1:r3", 100],
      ["s1:r4", 75],
    ]);
    const effectiveCaps = new Map([
      ["s1:r1", 100],
      ["s1:r2", 100],
      ["s1:r3", 100],
      ["s1:r4", 100],
    ]);

    phaseStockpileClamp(ctx, pending, effectiveCaps);

    for (const [key, qty] of pending) {
      const cap = effectiveCaps.get(key) ?? 100;
      expect(qty).toBeGreaterThanOrEqual(0);
      expect(qty).toBeLessThanOrEqual(cap);
    }
  });
});
