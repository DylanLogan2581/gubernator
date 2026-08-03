// Unit tests for forecast computation: verifies forecast extraction is pure
// (zero side effects, no database writes).

import { describe, expect, it } from "vitest";

import { computeForecastSnapshot } from "./forecast.ts";

import type {
  SimulationInputState,
  SimulationResult,
} from "../_shared/simulation/simulationTypes.ts";

describe("forecast computation", () => {
  it("computeForecastSnapshot is pure (no mutations)", () => {
    // Minimal input/result for testing purity: verify the function
    // doesn't modify input structures and returns independent data.
    // Minimal fixture — only fields accessed by computeForecastSnapshot.
    // Cast bypasses required-field checking for this purity-only test.
    const input = {
      isWorldArchived: false,
      turnNumber: 0,
      settlements: [{ id: "settlement-1", name: "Test Settlement" }],
      resources: [],
      stockpiles: [],
      buildingTiers: [],
      settlementBuildings: [],
      constructionProjects: [],
      tradeRoutes: [],
      partnerships: [],
      citizens: [],
      deposits: [],
      events: [],
    } as unknown as SimulationInputState;

    const result: SimulationResult = {
      armyTurnSnapshots: [],
    assignmentClears: [],
      buildingStateChanges: [],
      buildingTierUpgrades: [],
      buildingsCreated: [],
      citizenBirths: [],
      citizenDeaths: [],
      citizenEducationPatches: [],
      citizenPatches: [],
      constructionUpdates: [],
      deceasedSoldierIds: [],
      depositUpdates: [],
    desertedSoldiers: [],
    disbandedUnits: [],
      enrollmentGraduations: [],
      enrollmentProgressUpdates: [],
      eventStatusPatches: [],
      logEntries: [],
      managedPopulationUpdates: [],
      nationCurrencySnapshots: [],
      nationCurrencyUpdates: [],
      nationStockpileDeltas: [],
      nationTurnSnapshots: [],
      notifications: [],
      partnershipChanges: [],
      readinessSummary: {
        notReadySettlementCount: 1,
        readyPercentage: 0,
        readySettlementCount: 0,
        totalSettlementCount: 1,
      },
      resourceSnapshots: [],
      settlementSnapshots: [],
      stockpileDeltas: [],
      tradeRouteOutcomes: [],
      treatyStatusChanges: [],
    };

    const inputBefore = JSON.stringify(input);
    const resultBefore = JSON.stringify(result);

    const forecast = computeForecastSnapshot(result, input);

    // Verify input and result weren't mutated
    expect(JSON.stringify(input)).toBe(inputBefore);
    expect(JSON.stringify(result)).toBe(resultBefore);

    // Verify forecast structure is valid
    expect(forecast).toHaveProperty("bySettlement");
    expect(forecast.bySettlement).toHaveProperty("settlement-1");
    expect(forecast.bySettlement["settlement-1"]).toHaveProperty("resourceDeltas");
    expect(forecast.bySettlement["settlement-1"]).toHaveProperty("deathsBy");
    expect(forecast.bySettlement["settlement-1"]).toHaveProperty("completedProjects");
    expect(forecast.bySettlement["settlement-1"]).toHaveProperty("buildingUpkeepFailures");
    expect(forecast.bySettlement["settlement-1"]).toHaveProperty("tradeChanges");
  });

  it("deathsBy is populated from settlement snapshots in a starvation scenario", () => {
    const input = {
      isWorldArchived: false,
      turnNumber: 1,
      settlements: [{ id: "settlement-1", name: "Starving Town" }],
      resources: [],
      stockpiles: [],
      buildingTiers: [],
      settlementBuildings: [],
      constructionProjects: [],
      tradeRoutes: [],
      partnerships: [],
      citizens: [],
      deposits: [],
      events: [],
    } as unknown as SimulationInputState;

    const result: SimulationResult = {
      armyTurnSnapshots: [],
    assignmentClears: [],
      buildingStateChanges: [],
      buildingTierUpgrades: [],
      buildingsCreated: [],
      citizenBirths: [],
      citizenDeaths: [],
      citizenEducationPatches: [],
      citizenPatches: [],
      constructionUpdates: [],
      deceasedSoldierIds: [],
      depositUpdates: [],
    desertedSoldiers: [],
    disbandedUnits: [],
      enrollmentGraduations: [],
      enrollmentProgressUpdates: [],
      eventStatusPatches: [],
      logEntries: [],
      managedPopulationUpdates: [],
      nationCurrencySnapshots: [],
      nationCurrencyUpdates: [],
      nationStockpileDeltas: [],
      nationTurnSnapshots: [],
      notifications: [],
      partnershipChanges: [],
      readinessSummary: {
        notReadySettlementCount: 1,
        readyPercentage: 0,
        readySettlementCount: 0,
        totalSettlementCount: 1,
      },
      resourceSnapshots: [],
      settlementSnapshots: [
        {
          aliveNpc: 7,
          alivePc: 0,
          aliveTotal: 7,
          birthCount: 0,
          buildingSummary: {
            active: 0,
            auto_deconstructed: 0,
            manually_deconstructed: 0,
            suspended: 0,
          },
          deathCount: 5,
          educationSummary: { countsByLevelId: {}, graduationsThisTurn: 0 },
          homelessDeathsCount: 1,
          managedPopulationSummary: [],
          partnershipsFormedCount: 0,
          populationCap: 10,
          settlementId: "settlement-1",
          starvationDeathsCount: 3,
          tradeSummary: [],
          turnNumber: 1,
          warnings: { depletedDepositIds: [], pausedProjectIds: [] },
        },
      ],
      stockpileDeltas: [],
      tradeRouteOutcomes: [],
      treatyStatusChanges: [],
    };

    const forecast = computeForecastSnapshot(result, input);
    const deaths = forecast.bySettlement["settlement-1"]?.deathsBy;

    expect(deaths?.starvation).toBe(3);
    expect(deaths?.homelessness).toBe(1);
    expect(deaths?.other).toBe(1); // 5 total - 3 starvation - 1 homeless
  });

  it("resolves upkeep failures and trade changes across many buildings and routes", () => {
    const settlementCount = 20;
    const perSettlement = 25;

    const settlements = Array.from({ length: settlementCount }, (_, s) => ({
      id: `settlement-${s}`,
      name: `Settlement ${s}`,
    }));
    const settlementBuildings = settlements.flatMap((settlement, s) =>
      Array.from({ length: perSettlement }, (_, b) => ({
        id: `building-${s}-${b}`,
        settlementId: settlement.id,
      }))
    );
    const tradeRoutes = settlements.flatMap((settlement, s) =>
      Array.from({ length: perSettlement }, (_, r) => ({
        id: `route-${s}-${r}`,
        originSettlementId: settlement.id,
      }))
    );

    const input = {
      isWorldArchived: false,
      turnNumber: 1,
      settlements,
      resources: [],
      stockpiles: [],
      buildingTiers: [],
      settlementBuildings,
      constructionProjects: [],
      tradeRoutes,
      partnerships: [],
      citizens: [],
      deposits: [],
      events: [],
    } as unknown as SimulationInputState;

    // Every building misses upkeep; one unknown id must be ignored.
    const buildingStateChanges = [
      ...settlementBuildings.map((b) => ({
        settlementBuildingId: b.id,
        missedUpkeepCountDelta: 1,
      })),
      { settlementBuildingId: "building-missing", missedUpkeepCountDelta: 1 },
      { settlementBuildingId: "building-0-0", missedUpkeepCountDelta: 0 },
    ];
    const tradeRouteOutcomes = [
      ...tradeRoutes.map((r, i) => ({
        tradeRouteId: r.id,
        delivered: i % 2 === 0,
        pauseReason: i % 2 === 0 ? null : "insufficient_stock",
        quantityTransferred: i,
      })),
      {
        tradeRouteId: "route-missing",
        delivered: false,
        pauseReason: "gone",
        quantityTransferred: 0,
      },
    ];

    const result = {
      buildingStateChanges,
      constructionUpdates: [],
      resourceSnapshots: [],
      settlementSnapshots: [],
      tradeRouteOutcomes,
    } as unknown as SimulationResult;

    const forecast = computeForecastSnapshot(result, input);

    expect(Object.keys(forecast.bySettlement)).toHaveLength(settlementCount);
    for (let s = 0; s < settlementCount; s += 1) {
      const entry = forecast.bySettlement[`settlement-${s}`];
      expect(entry?.buildingUpkeepFailures).toEqual(
        Array.from({ length: perSettlement }, (_, b) => `building-${s}-${b}`),
      );
      expect(entry?.tradeChanges.map((c) => c.tradeRouteId)).toEqual(
        Array.from({ length: perSettlement }, (_, r) => `route-${s}-${r}`),
      );
    }

    const firstChange = forecast.bySettlement["settlement-0"]?.tradeChanges[1];
    expect(firstChange).toEqual({
      tradeRouteId: "route-0-1",
      delivered: false,
      pauseReason: "insufficient_stock",
      quantityTransferred: 1,
    });
  });
});
