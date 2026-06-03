// Simulation orchestrator stub — filled by #B24.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  SimulationInputState,
  SimulationResult,
} from "./simulationTypes.ts";

export function runSimulation(_input: SimulationInputState): SimulationResult {
  return {
    assignmentClears: [],
    buildingStateChanges: [],
    buildingsCreated: [],
    citizenBirths: [],
    citizenDeaths: [],
    citizenPatches: [],
    constructionUpdates: [],
    depositUpdates: [],
    logEntries: [],
    managedPopulationUpdates: [],
    notifications: [],
    partnershipChanges: [],
    readinessSummary: {
      notReadySettlementCount: 0,
      readyPercentage: 0,
      readySettlementCount: 0,
      totalSettlementCount: 0,
    },
    resourceSnapshots: [],
    settlementSnapshots: [],
    stockpileDeltas: [],
    tradeRouteOutcomes: [],
  };
}
