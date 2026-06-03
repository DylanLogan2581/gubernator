import { describe, expect, it } from "vitest";

import { phaseBuildingUpkeep } from "./phaseBuildingUpkeep.ts";

import type {
  SimBuildingBlueprint,
  SimBuildingTier,
  SimSettlement,
  SimSettlementBuilding,
  SimStockpile,
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

function makeSettlement(id: string, name = id): SimSettlement {
  return { id, name };
}

function makeBlueprint(
  id: string,
  gracePeriodTurns: number,
): SimBuildingBlueprint {
  return { gracePeriodTurns, id, maxInstancesPerSettlement: null, name: id };
}

function makeTier(
  id: string,
  blueprintId: string,
  upkeepCosts: { resourceId: string; amount: number }[] = [],
): SimBuildingTier {
  return {
    buildingBlueprintId: blueprintId,
    constructionCostsJson: [],
    effectsJson: [],
    id,
    tierNumber: 1,
    upkeepCostsJson: upkeepCosts,
    workerTurnsRequired: 1,
  };
}

function makeBuilding(
  id: string,
  settlementId: string,
  tierId: string,
  blueprintId: string,
  opts: {
    state?: SimSettlementBuilding["state"];
    missedUpkeepCount?: number;
  } = {},
): SimSettlementBuilding {
  return {
    activatedOnTurnNumber: 1,
    buildingBlueprintId: blueprintId,
    currentTierId: tierId,
    id,
    missedUpkeepCount: opts.missedUpkeepCount ?? 0,
    settlementId,
    sourceProjectId: null,
    state: opts.state ?? "active",
  };
}

function makeStockpile(
  settlementId: string,
  resourceId: string,
  quantity: number,
  cap = 9999,
): SimStockpile {
  return { cap, quantity, resourceId, settlementId };
}

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

describe("phaseBuildingUpkeep", () => {
  it("returns empty output when no active buildings exist", () => {
    const ctx = makeContext({ settlements: [makeSettlement("s1")] });
    const result = phaseBuildingUpkeep(ctx);

    expect(result.buildingStateChanges).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
  });

  it("pays upkeep and deducts from stockpile when resources are sufficient", () => {
    const blueprint = makeBlueprint("bp1", 2);
    const tier = makeTier("t1", "bp1", [{ resourceId: "wood", amount: 5 }]);
    const building = makeBuilding("b1", "s1", "t1", "bp1");
    const ctx = makeContext({
      buildingBlueprints: [blueprint],
      buildingTiers: [tier],
      settlements: [makeSettlement("s1")],
      settlementBuildings: [building],
      stockpiles: [makeStockpile("s1", "wood", 100)],
    });

    const result = phaseBuildingUpkeep(ctx);

    // Upkeep paid — no state changes
    expect(result.buildingStateChanges).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);

    // Stockpile deducted by 5
    expect(result.stockpileDeltas).toHaveLength(1);
    expect(result.stockpileDeltas[0]?.resourceId).toBe("wood");
    expect(result.stockpileDeltas[0]?.delta).toBe(-5);
    expect(result.stockpileDeltas[0]?.settlementId).toBe("s1");
  });

  it("suspends building on resource shortfall and emits log + notification", () => {
    const blueprint = makeBlueprint("bp1", 3); // grace = 3
    const tier = makeTier("t1", "bp1", [{ resourceId: "wood", amount: 10 }]);
    const building = makeBuilding("b1", "s1", "t1", "bp1", {
      missedUpkeepCount: 0,
    });
    const ctx = makeContext({
      buildingBlueprints: [blueprint],
      buildingTiers: [tier],
      settlements: [makeSettlement("s1", "Oakvale")],
      settlementBuildings: [building],
      stockpiles: [makeStockpile("s1", "wood", 3)], // insufficient
    });

    const result = phaseBuildingUpkeep(ctx);

    expect(result.stockpileDeltas).toHaveLength(0); // no deduction on shortfall

    expect(result.buildingStateChanges).toHaveLength(1);
    const change = result.buildingStateChanges[0];
    expect(change?.settlementBuildingId).toBe("b1");
    expect(change?.toState).toBe("suspended");
    expect(change?.missedUpkeepCountDelta).toBe(1);

    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]?.category).toBe("building.suspended");
    expect(result.logs[0]?.phase).toBe("buildingUpkeep");
    expect(result.logs[0]?.payload.buildingId).toBe("b1");
    expect(result.logs[0]?.payload.missedUpkeepCount).toBe(1);

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.notificationType).toBe(
      "simulation.building.suspended",
    );
    expect(result.notifications[0]?.messageText).toContain("Oakvale");
  });

  it("auto-deconstructs when missed count exceeds grace period", () => {
    const blueprint = makeBlueprint("bp1", 2); // grace = 2
    const tier = makeTier("t1", "bp1", [{ resourceId: "wood", amount: 10 }]);
    // missed = 2 → new count will be 3, which exceeds grace of 2
    const building = makeBuilding("b1", "s1", "t1", "bp1", {
      missedUpkeepCount: 2,
    });
    const ctx = makeContext({
      buildingBlueprints: [blueprint],
      buildingTiers: [tier],
      settlements: [makeSettlement("s1", "Ashford")],
      settlementBuildings: [building],
      stockpiles: [], // no resources
    });

    const result = phaseBuildingUpkeep(ctx);

    expect(result.stockpileDeltas).toHaveLength(0);

    expect(result.buildingStateChanges).toHaveLength(1);
    const change = result.buildingStateChanges[0];
    expect(change?.toState).toBe("auto_deconstructed");
    expect(change?.settlementBuildingId).toBe("b1");
    expect(change?.missedUpkeepCountDelta).toBe(1);

    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]?.category).toBe("building.auto_deconstructed");
    expect(result.logs[0]?.payload.missedUpkeepCount).toBe(3);
    expect(result.logs[0]?.payload.gracePeriodTurns).toBe(2);

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.notificationType).toBe(
      "simulation.building.auto_deconstructed",
    );
    expect(result.notifications[0]?.messageText).toContain("Ashford");
  });

  it("suspends (not auto-deconstructs) when missed count equals grace period", () => {
    // grace = 2, missed = 1 → new count = 2, which equals grace but does NOT exceed it
    const blueprint = makeBlueprint("bp1", 2);
    const tier = makeTier("t1", "bp1", [{ resourceId: "food", amount: 5 }]);
    const building = makeBuilding("b1", "s1", "t1", "bp1", {
      missedUpkeepCount: 1,
    });
    const ctx = makeContext({
      buildingBlueprints: [blueprint],
      buildingTiers: [tier],
      settlements: [makeSettlement("s1")],
      settlementBuildings: [building],
      stockpiles: [],
    });

    const result = phaseBuildingUpkeep(ctx);

    expect(result.buildingStateChanges[0]?.toState).toBe("suspended");
  });

  it("skips non-active buildings (suspended, auto_deconstructed, manually_deconstructed)", () => {
    const blueprint = makeBlueprint("bp1", 2);
    const tier = makeTier("t1", "bp1", [{ resourceId: "wood", amount: 5 }]);
    const suspended = makeBuilding("b1", "s1", "t1", "bp1", {
      state: "suspended",
    });
    const autoDeconstructed = makeBuilding("b2", "s1", "t1", "bp1", {
      state: "auto_deconstructed",
    });
    const manuallyDeconstructed = makeBuilding("b3", "s1", "t1", "bp1", {
      state: "manually_deconstructed",
    });
    const ctx = makeContext({
      buildingBlueprints: [blueprint],
      buildingTiers: [tier],
      settlements: [makeSettlement("s1")],
      settlementBuildings: [
        suspended,
        autoDeconstructed,
        manuallyDeconstructed,
      ],
      stockpiles: [makeStockpile("s1", "wood", 1000)],
    });

    const result = phaseBuildingUpkeep(ctx);

    expect(result.buildingStateChanges).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
  });

  it("zero-upkeep building pays successfully with empty stockpile", () => {
    const blueprint = makeBlueprint("bp1", 2);
    const tier = makeTier("t1", "bp1", []); // no upkeep costs
    const building = makeBuilding("b1", "s1", "t1", "bp1");
    const ctx = makeContext({
      buildingBlueprints: [blueprint],
      buildingTiers: [tier],
      settlements: [makeSettlement("s1")],
      settlementBuildings: [building],
      stockpiles: [],
    });

    const result = phaseBuildingUpkeep(ctx);

    expect(result.buildingStateChanges).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("accumulates stockpile deltas across multiple buildings that all pay", () => {
    const blueprint = makeBlueprint("bp1", 2);
    const tier = makeTier("t1", "bp1", [{ resourceId: "wood", amount: 3 }]);
    const b1 = makeBuilding("b1", "s1", "t1", "bp1");
    const b2 = makeBuilding("b2", "s1", "t1", "bp1");
    const ctx = makeContext({
      buildingBlueprints: [blueprint],
      buildingTiers: [tier],
      settlements: [makeSettlement("s1")],
      settlementBuildings: [b1, b2],
      stockpiles: [makeStockpile("s1", "wood", 100)],
    });

    const result = phaseBuildingUpkeep(ctx);

    expect(result.buildingStateChanges).toHaveLength(0);
    const totalWoodDeducted = result.stockpileDeltas
      .filter((d) => d.resourceId === "wood")
      .reduce((sum, d) => sum + d.delta, 0);
    expect(totalWoodDeducted).toBe(-6);
  });

  it("second building fails when first building exhausts the stockpile", () => {
    // Two buildings each need 60 wood; stockpile has 100 → first pays, second fails
    const blueprint = makeBlueprint("bp1", 3);
    const tier = makeTier("t1", "bp1", [{ resourceId: "wood", amount: 60 }]);
    const b1 = makeBuilding("b1", "s1", "t1", "bp1");
    const b2 = makeBuilding("b2", "s1", "t1", "bp1");
    const ctx = makeContext({
      buildingBlueprints: [blueprint],
      buildingTiers: [tier],
      settlements: [makeSettlement("s1")],
      settlementBuildings: [b1, b2],
      stockpiles: [makeStockpile("s1", "wood", 100)],
    });

    const result = phaseBuildingUpkeep(ctx);

    // First building pays; second is suspended
    const woodDeltas = result.stockpileDeltas.filter(
      (d) => d.resourceId === "wood",
    );
    expect(woodDeltas).toHaveLength(1);
    expect(woodDeltas[0]?.delta).toBe(-60);

    expect(result.buildingStateChanges).toHaveLength(1);
    expect(result.buildingStateChanges[0]?.settlementBuildingId).toBe("b2");
    expect(result.buildingStateChanges[0]?.toState).toBe("suspended");
  });

  describe("property: a building that pays upkeep N times in a row never auto-deconstructs", () => {
    it("missed count stays 0 across multiple successful payments", () => {
      const blueprint = makeBlueprint("bp1", 2);
      const tier = makeTier("t1", "bp1", [{ resourceId: "food", amount: 1 }]);
      const building = makeBuilding("b1", "s1", "t1", "bp1", {
        missedUpkeepCount: 0,
      });
      const baseCtx = {
        buildingBlueprints: [blueprint],
        buildingTiers: [tier],
        settlements: [makeSettlement("s1")],
        settlementBuildings: [building],
        stockpiles: [makeStockpile("s1", "food", 1000)],
      };

      for (let turn = 0; turn < 10; turn++) {
        const ctx = makeContext(baseCtx);
        const result = phaseBuildingUpkeep(ctx);
        // No state changes → building never suspended or auto-deconstructed
        expect(result.buildingStateChanges).toHaveLength(0);
      }
    });
  });
});
