import { describe, expect, it } from "vitest";

import { phasePassiveEffects } from "./phasePassiveEffects.ts";

import type {
  SimBuildingTier,
  SimSettlementBuilding,
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

function makeTier(
  id: string,
  blueprintId: string,
  passiveProduction: { resourceId: string; amount: number }[] = [],
): SimBuildingTier {
  return {
    buildingBlueprintId: blueprintId,
    constructionCostsJson: [],
    effectsJson: passiveProduction.map((p) => ({
      amount: p.amount,
      resourceId: p.resourceId,
      type: "passive_resource_production" as const,
    })),
    id,
    tierNumber: 1,
    upkeepCostsJson: [],
    workerTurnsRequired: 1,
  };
}

function makeBuilding(
  id: string,
  settlementId: string,
  tierId: string,
  blueprintId: string,
  state: SimSettlementBuilding["state"] = "active",
): SimSettlementBuilding {
  return {
    activatedOnTurnNumber: 1,
    buildingBlueprintId: blueprintId,
    currentTierId: tierId,
    id,
    missedUpkeepCount: 0,
    settlementId,
    sourceProjectId: null,
    state,
  };
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
    events: [],
    tradeRoutes: [],
    turnNumber: 1,
    worldId: "w1",
    ...overrides,
  };
  const pendingStockpiles = new Map<string, number>();
  for (const sp of input.stockpiles) {
    pendingStockpiles.set(`${sp.settlementId}:${sp.resourceId}`, sp.quantity);
  }
  return {
    input,
    shared: {
      pendingDeaths: new Set<string>(),
      pendingPopCapBySettlement: new Map(),
      pendingStockpiles,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phasePassiveEffects", () => {
  it("returns empty output when no buildings exist", () => {
    const ctx = makeContext({});
    const result = phasePassiveEffects(ctx);

    expect(result.logs).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
  });

  it("returns empty output when no active buildings exist", () => {
    const tier = makeTier("t1", "bp1", [{ resourceId: "gold", amount: 10 }]);
    const building = makeBuilding("b1", "s1", "t1", "bp1", "suspended");
    const ctx = makeContext({
      buildingTiers: [tier],
      settlementBuildings: [building],
    });

    const result = phasePassiveEffects(ctx);

    expect(result.logs).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
  });

  it("produces a delta and log for one active building with one passive effect", () => {
    const tier = makeTier("t1", "bp1", [{ resourceId: "gold", amount: 5 }]);
    const building = makeBuilding("b1", "s1", "t1", "bp1");
    const ctx = makeContext({
      buildingTiers: [tier],
      settlementBuildings: [building],
    });

    const result = phasePassiveEffects(ctx);

    expect(result.stockpileDeltas).toHaveLength(1);
    expect(result.stockpileDeltas[0]?.resourceId).toBe("gold");
    expect(result.stockpileDeltas[0]?.delta).toBe(5);
    expect(result.stockpileDeltas[0]?.settlementId).toBe("s1");

    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]?.category).toBe("passive_effect.applied");
    expect(result.logs[0]?.phase).toBe("passiveEffects");
    expect(result.logs[0]?.payload.buildingId).toBe("b1");
    expect(result.logs[0]?.payload.resourceId).toBe("gold");
    expect(result.logs[0]?.payload.amount).toBe(5);
  });

  it("stacks deltas when multiple buildings produce the same resource", () => {
    const tier = makeTier("t1", "bp1", [{ resourceId: "wood", amount: 3 }]);
    const b1 = makeBuilding("b1", "s1", "t1", "bp1");
    const b2 = makeBuilding("b2", "s1", "t1", "bp1");
    const ctx = makeContext({
      buildingTiers: [tier],
      settlementBuildings: [b1, b2],
    });

    const result = phasePassiveEffects(ctx);

    expect(result.stockpileDeltas).toHaveLength(2);
    const total = result.stockpileDeltas.reduce((sum, d) => sum + d.delta, 0);
    expect(total).toBe(6);
    expect(result.logs).toHaveLength(2);
  });

  it("emits one delta and log per effect when a building has multiple passive effects", () => {
    const tier = makeTier("t1", "bp1", [
      { resourceId: "gold", amount: 4 },
      { resourceId: "food", amount: 2 },
    ]);
    const building = makeBuilding("b1", "s1", "t1", "bp1");
    const ctx = makeContext({
      buildingTiers: [tier],
      settlementBuildings: [building],
    });

    const result = phasePassiveEffects(ctx);

    expect(result.stockpileDeltas).toHaveLength(2);
    const goldDelta = result.stockpileDeltas.find(
      (d) => d.resourceId === "gold",
    );
    const foodDelta = result.stockpileDeltas.find(
      (d) => d.resourceId === "food",
    );
    expect(goldDelta?.delta).toBe(4);
    expect(foodDelta?.delta).toBe(2);

    expect(result.logs).toHaveLength(2);
  });

  it("skips non-passive effects (storage, job_capacity, population_cap)", () => {
    const tier: SimBuildingTier = {
      buildingBlueprintId: "bp1",
      constructionCostsJson: [],
      effectsJson: [
        { amount: 100, resourceId: "gold", type: "resource_storage_increase" },
        { amount: 5, jobId: "j1", type: "job_capacity_increase" },
        { amount: 10, type: "population_cap_increase" },
      ],
      id: "t1",
      tierNumber: 1,
      upkeepCostsJson: [],
      workerTurnsRequired: 1,
    };
    const building = makeBuilding("b1", "s1", "t1", "bp1");
    const ctx = makeContext({
      buildingTiers: [tier],
      settlementBuildings: [building],
    });

    const result = phasePassiveEffects(ctx);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
  });

  it("suspended buildings produce nothing", () => {
    const tier = makeTier("t1", "bp1", [{ resourceId: "gold", amount: 10 }]);
    const suspended = makeBuilding("b1", "s1", "t1", "bp1", "suspended");
    const autoDeconstructed = makeBuilding(
      "b2",
      "s1",
      "t1",
      "bp1",
      "auto_deconstructed",
    );
    const manuallyDeconstructed = makeBuilding(
      "b3",
      "s1",
      "t1",
      "bp1",
      "manually_deconstructed",
    );
    const ctx = makeContext({
      buildingTiers: [tier],
      settlementBuildings: [
        suspended,
        autoDeconstructed,
        manuallyDeconstructed,
      ],
    });

    const result = phasePassiveEffects(ctx);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
  });
});
