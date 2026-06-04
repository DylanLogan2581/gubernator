// Type-only tests for SimulationResult JSON round-trip.
//
// Verifies that SimulationResult is JSON-serializable: every field can survive
// JSON.parse(JSON.stringify(...)) and the resulting value is still assignable
// to SimulationResult.

import { assertType, describe, it } from "vitest";

import type { SimulationResult } from "./simulationTypes.ts";

const exampleResult: SimulationResult = {
  assignmentClears: [{ citizenId: "c-1", reason: "project_complete" }],
  buildingStateChanges: [
    {
      missedUpkeepCountDelta: null,
      settlementBuildingId: "sb-1",
      toState: "suspended",
    },
  ],
  buildingsCreated: [
    {
      buildingBlueprintId: "bp-1",
      settlementId: "s-1",
      tierId: "tier-1",
    },
  ],
  citizenBirths: [
    {
      npcFlaw: null,
      npcGoal: "a seat on the council",
      npcSecretContradiction: null,
      npcTrait1: "earnest",
      npcTrait2: null,
      parentACitizenId: "c-2",
      parentBCitizenId: "c-3",
      sex: "female",
      settlementId: "s-1",
    },
  ],
  citizenPatches: [{ bornOnTurnNumber: 5, citizenId: "c-99" }],
  citizenDeaths: [
    { category: "starvation", citizenId: "c-4", detail: null },
    { category: "homeless", citizenId: "c-5", detail: "prolonged exposure" },
  ],
  constructionUpdates: [
    {
      progressWorkerTurnsDelta: 2,
      projectId: "proj-1",
      settlementId: "s-1",
      toStatus: null,
    },
  ],
  depositUpdates: [
    {
      depositInstanceId: "dep-1",
      resourceDeltas: [{ delta: -10, resourceId: "res-1" }],
      toStatus: "depleted",
    },
  ],
  logEntries: [
    {
      category: "construction",
      payload: { projectId: "proj-1" },
      phase: "construction",
    },
  ],
  managedPopulationUpdates: [
    {
      countDelta: 5,
      managedPopulationInstanceId: "mpi-1",
      toStatus: null,
    },
  ],
  notifications: [
    {
      messageText: "Turn simulated.",
      notificationType: "turn.completed",
      scope: "world" as const,
    },
  ],
  partnershipChanges: [
    { citizenAId: "c-6", citizenBId: "c-7", type: "formed" },
    {
      partnershipId: "p-1",
      reason: "death",
      toStatus: "widowed",
      type: "status_changed",
    },
  ],
  readinessSummary: {
    notReadySettlementCount: 1,
    readyPercentage: 50,
    readySettlementCount: 1,
    totalSettlementCount: 2,
  },
  resourceSnapshots: [
    {
      consumed: 10,
      produced: 20,
      quantityAfter: 110,
      quantityBefore: 100,
      resourceId: "res-1",
      settlementId: "s-1",
      tradeIn: 5,
      tradeOut: 0,
      turnNumber: 5,
    },
  ],
  settlementSnapshots: [
    {
      aliveNpc: 8,
      alivePc: 2,
      aliveTotal: 10,
      birthCount: 1,
      buildingSummary: {
        active: 2,
        auto_deconstructed: 0,
        manually_deconstructed: 0,
        suspended: 1,
      },
      deathCount: 0,
      homelessDeathsCount: 0,
      managedPopulationSummary: [],
      partnershipsFormedCount: 1,
      populationCap: 20,
      settlementId: "s-1",
      starvationDeathsCount: 0,
      tradeSummary: [],
      turnNumber: 5,
      warnings: { depletedDepositIds: [], pausedProjectIds: [] },
    },
  ],
  stockpileDeltas: [{ delta: -5, resourceId: "res-1", settlementId: "s-1" }],
  tradeRouteOutcomes: [
    {
      delivered: true,
      pauseReason: null,
      quantityTransferred: 20,
      tradeRouteId: "tr-1",
    },
  ],
};

describe("SimulationResult JSON round-trip", () => {
  it("is assignable after JSON.parse(JSON.stringify(...))", () => {
    const serialized = JSON.stringify(exampleResult);
    const parsed = JSON.parse(serialized) as SimulationResult;
    assertType<SimulationResult>(parsed);
  });

  it("preserves all top-level keys through serialization", () => {
    const serialized = JSON.stringify(exampleResult);
    const parsed = JSON.parse(serialized) as SimulationResult;
    assertType<typeof exampleResult>(parsed);
  });

  it("round-trips nested discriminated union PartnershipChange", () => {
    const changes = exampleResult.partnershipChanges;
    const serialized = JSON.stringify(changes);
    const parsed = JSON.parse(
      serialized,
    ) as SimulationResult["partnershipChanges"];
    assertType<SimulationResult["partnershipChanges"]>(parsed);
  });

  it("round-trips CitizenDeath with DeathCauseCategory", () => {
    const deaths = exampleResult.citizenDeaths;
    const serialized = JSON.stringify(deaths);
    const parsed = JSON.parse(serialized) as SimulationResult["citizenDeaths"];
    assertType<SimulationResult["citizenDeaths"]>(parsed);
  });
});
