// Unit tests for phaseBuildingUpkeep — upkeep deduction, suspension, recovery,
// and auto-deconstruction state machine.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseBuildingUpkeep } from "./phaseBuildingUpkeep.ts";
import { makeContext, makeSettlement } from "./testFixtures.ts";

import type {
  SimBuildingBlueprint,
  SimBuildingTier,
  SimSettlementBuilding,
  SimulationContext,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBlueprint(
  overrides?: Partial<SimBuildingBlueprint>,
): SimBuildingBlueprint {
  return {
    gracePeriodTurns: 2,
    id: "blueprint-1",
    maxInstancesPerSettlement: null,
    name: "Sawmill",
    ...overrides,
  };
}

function makeTier(overrides?: Partial<SimBuildingTier>): SimBuildingTier {
  return {
    buildingBlueprintId: "blueprint-1",
    constructionCostsJson: [],
    effectsJson: [],
    id: "tier-1",
    tierNumber: 1,
    upkeepCostsJson: [{ amount: 10, resourceId: "wood" }],
    workerTurnsRequired: 0,
    ...overrides,
  };
}

function makeBuilding(
  overrides: Partial<SimSettlementBuilding> & { id: string },
): SimSettlementBuilding {
  return {
    activatedOnTurnNumber: 1,
    buildingBlueprintId: "blueprint-1",
    currentTierId: "tier-1",
    missedUpkeepCount: 0,
    settlementId: "s1",
    sourceProjectId: null,
    state: "active",
    ...overrides,
  };
}

/** Builds a context and pre-seeds shared.pendingStockpiles from key/value pairs. */
function makeUpkeepContext(
  overrides: Parameters<typeof makeContext>[0] & {
    pendingStockpiles?: Record<string, number>;
  },
): SimulationContext {
  const { pendingStockpiles = {}, ...rest } = overrides;
  const ctx = makeContext(rest);
  for (const [key, value] of Object.entries(pendingStockpiles)) {
    ctx.shared.pendingStockpiles.set(key, value);
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseBuildingUpkeep — sufficient resources", () => {
  it("deducts upkeep cost from stockpile deltas and leaves building active", () => {
    const ctx = makeUpkeepContext({
      buildingBlueprints: [makeBlueprint()],
      buildingTiers: [makeTier()],
      settlementBuildings: [makeBuilding({ id: "b1" })],
      pendingStockpiles: { "s1:wood": 10 },
    });

    const result = phaseBuildingUpkeep(ctx);

    expect(result.stockpileDeltas).toEqual([
      { delta: -10, resourceId: "wood", settlementId: "s1" },
    ]);
    expect(result.buildingStateChanges).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("recovers a suspended building whose upkeep can now be paid", () => {
    const ctx = makeUpkeepContext({
      buildingBlueprints: [makeBlueprint()],
      buildingTiers: [makeTier()],
      settlementBuildings: [
        makeBuilding({ id: "b1", missedUpkeepCount: 1, state: "suspended" }),
      ],
      pendingStockpiles: { "s1:wood": 10 },
    });

    const result = phaseBuildingUpkeep(ctx);

    expect(result.buildingStateChanges).toEqual([
      {
        missedUpkeepCountDelta: -1,
        settlementBuildingId: "b1",
        toState: "active",
      },
    ]);
    const log = result.logs.find((l) => l.category === "building.recovered");
    expect(log).toBeDefined();
    expect(log?.settlementId).toBe("s1");
    const notification = result.notifications.find(
      (n) => n.notificationType === "building.recovered",
    );
    expect(notification).toBeDefined();
    expect(notification?.settlementId).toBe("s1");
  });
});

describe("phaseBuildingUpkeep — insufficient resources", () => {
  it("suspends an active building when missed count stays within grace period", () => {
    // gracePeriodTurns=2, missedUpkeepCount=0 -> newMissedCount=1, 1 > 2 is false -> suspend.
    const ctx = makeUpkeepContext({
      buildingBlueprints: [makeBlueprint({ gracePeriodTurns: 2 })],
      buildingTiers: [makeTier()],
      settlementBuildings: [makeBuilding({ id: "b1", missedUpkeepCount: 0 })],
      pendingStockpiles: { "s1:wood": 0 },
    });

    const result = phaseBuildingUpkeep(ctx);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.buildingStateChanges).toEqual([
      {
        missedUpkeepCountDelta: 1,
        settlementBuildingId: "b1",
        toState: "suspended",
      },
    ]);
    const log = result.logs.find((l) => l.category === "building.suspended");
    expect(log).toBeDefined();
    expect(log?.payload).toMatchObject({
      blueprintId: "blueprint-1",
      buildingId: "b1",
      missedUpkeepCount: 1,
    });
    const notification = result.notifications.find(
      (n) => n.notificationType === "building.suspended",
    );
    expect(notification).toBeDefined();
  });

  it("auto-deconstructs a building once missed count exceeds the grace period", () => {
    // gracePeriodTurns=2, missedUpkeepCount=2 -> newMissedCount=3, 3 > 2 -> auto_deconstructed.
    const ctx = makeUpkeepContext({
      buildingBlueprints: [makeBlueprint({ gracePeriodTurns: 2 })],
      buildingTiers: [makeTier()],
      settlementBuildings: [makeBuilding({ id: "b1", missedUpkeepCount: 2 })],
      pendingStockpiles: { "s1:wood": 0 },
    });

    const result = phaseBuildingUpkeep(ctx);

    expect(result.buildingStateChanges).toEqual([
      {
        missedUpkeepCountDelta: 1,
        settlementBuildingId: "b1",
        toState: "auto_deconstructed",
      },
    ]);
    const log = result.logs.find(
      (l) => l.category === "building.auto_deconstructed",
    );
    expect(log).toBeDefined();
    expect(log?.payload).toMatchObject({
      blueprintId: "blueprint-1",
      buildingId: "b1",
      gracePeriodTurns: 2,
      missedUpkeepCount: 3,
    });
    const notification = result.notifications.find(
      (n) => n.notificationType === "building.auto_deconstructed",
    );
    expect(notification).toBeDefined();
  });

  it("suspends when the stockpile covers only part of the upkeep cost", () => {
    const ctx = makeUpkeepContext({
      buildingBlueprints: [makeBlueprint()],
      buildingTiers: [makeTier()],
      settlementBuildings: [makeBuilding({ id: "b1" })],
      pendingStockpiles: { "s1:wood": 9 },
    });

    const result = phaseBuildingUpkeep(ctx);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.buildingStateChanges[0]?.toState).toBe("suspended");
  });
});

describe("phaseBuildingUpkeep — multi-building / multi-settlement isolation", () => {
  it("evaluates each building's stockpile independently by settlement", () => {
    const ctx = makeUpkeepContext({
      buildingBlueprints: [makeBlueprint()],
      buildingTiers: [makeTier()],
      settlementBuildings: [
        makeBuilding({ id: "b-rich", settlementId: "s1" }),
        makeBuilding({ id: "b-poor", settlementId: "s2" }),
      ],
      settlements: [makeSettlement({ id: "s1" }), makeSettlement({ id: "s2" })],
      pendingStockpiles: { "s1:wood": 10, "s2:wood": 0 },
    });

    const result = phaseBuildingUpkeep(ctx);

    expect(result.stockpileDeltas).toEqual([
      { delta: -10, resourceId: "wood", settlementId: "s1" },
    ]);
    expect(result.buildingStateChanges).toEqual([
      {
        missedUpkeepCountDelta: 1,
        settlementBuildingId: "b-poor",
        toState: "suspended",
      },
    ]);
  });

  it("deducts sequentially so a second building cannot double-spend the same stockpile", () => {
    const tier = makeTier();
    const ctx = makeUpkeepContext({
      buildingBlueprints: [makeBlueprint()],
      buildingTiers: [tier],
      settlementBuildings: [
        makeBuilding({ id: "b1", settlementId: "s1" }),
        makeBuilding({ id: "b2", settlementId: "s1" }),
      ],
      pendingStockpiles: { "s1:wood": 10 },
    });

    const result = phaseBuildingUpkeep(ctx);

    // Only enough wood for one building's upkeep — the second must suspend.
    expect(result.stockpileDeltas).toEqual([
      { delta: -10, resourceId: "wood", settlementId: "s1" },
    ]);
    const suspended = result.buildingStateChanges.find(
      (c) => c.settlementBuildingId === "b2",
    );
    expect(suspended?.toState).toBe("suspended");
  });

  it("skips buildings that are not active or suspended", () => {
    const ctx = makeUpkeepContext({
      buildingBlueprints: [makeBlueprint()],
      buildingTiers: [makeTier()],
      settlementBuildings: [
        makeBuilding({ id: "b1", state: "auto_deconstructed" }),
        makeBuilding({ id: "b2", state: "manually_deconstructed" }),
      ],
      pendingStockpiles: { "s1:wood": 10 },
    });

    const result = phaseBuildingUpkeep(ctx);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.buildingStateChanges).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
  });
});

describe("phaseBuildingUpkeep — event multipliers", () => {
  it("applies a blueprint-specific upkeep multiplier over the global one", () => {
    const ctx = makeUpkeepContext({
      buildingBlueprints: [makeBlueprint()],
      buildingTiers: [makeTier({ upkeepCostsJson: [{ amount: 10, resourceId: "wood" }] })],
      settlementBuildings: [makeBuilding({ id: "b1" })],
      pendingStockpiles: { "s1:wood": 20 },
    });
    ctx.shared.pendingEventMultipliers.set("s1", {
      consumption: 1,
      productionByBuildingId: new Map(),
      productionByJobId: new Map(),
      upkeep: 1,
      upkeepByBlueprintId: new Map([["blueprint-1", 2]]),
    });

    const result = phaseBuildingUpkeep(ctx);

    // adjustedCost = 10 * 2 = 20, which the stockpile of 20 exactly covers.
    expect(result.stockpileDeltas).toEqual([
      { delta: -20, resourceId: "wood", settlementId: "s1" },
    ]);
    expect(result.buildingStateChanges).toHaveLength(0);
  });

  it("falls back to the global upkeep multiplier when no blueprint-specific entry exists", () => {
    const ctx = makeUpkeepContext({
      buildingBlueprints: [makeBlueprint()],
      buildingTiers: [makeTier({ upkeepCostsJson: [{ amount: 10, resourceId: "wood" }] })],
      settlementBuildings: [makeBuilding({ id: "b1" })],
      pendingStockpiles: { "s1:wood": 5 },
    });
    ctx.shared.pendingEventMultipliers.set("s1", {
      consumption: 1,
      productionByBuildingId: new Map(),
      productionByJobId: new Map(),
      upkeep: 0.5,
      upkeepByBlueprintId: new Map(),
    });

    const result = phaseBuildingUpkeep(ctx);

    // adjustedCost = 10 * 0.5 = 5, which the stockpile of 5 exactly covers.
    expect(result.stockpileDeltas).toEqual([
      { delta: -5, resourceId: "wood", settlementId: "s1" },
    ]);
    expect(result.buildingStateChanges).toHaveLength(0);
  });
});
