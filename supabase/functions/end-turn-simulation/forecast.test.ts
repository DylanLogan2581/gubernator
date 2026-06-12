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
      assignmentClears: [],
      buildingStateChanges: [],
      buildingsCreated: [],
      citizenBirths: [],
      citizenDeaths: [],
      citizenPatches: [],
      constructionUpdates: [],
      depositUpdates: [],
      eventStatusPatches: [],
      logEntries: [],
      managedPopulationUpdates: [],
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
});
