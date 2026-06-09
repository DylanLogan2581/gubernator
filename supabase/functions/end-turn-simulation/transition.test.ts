import { describe, expect, it } from "vitest";

import {
  mapSimulationResultToPayload,
  planSimulationTransition,
} from "./transition.ts";

import type {
  SimulationInputState,
  SimulationResult,
} from "../_shared/simulation/simulationTypes.ts";

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000002";
const RESOURCE_ID = "00000000-0000-0000-0000-000000000010";
const FOOD_ID = "00000000-0000-0000-0000-000000000011";
const WATER_ID = "00000000-0000-0000-0000-000000000012";
const BUILDING_ID = "00000000-0000-0000-0000-000000000020";
const BLUEPRINT_ID = "00000000-0000-0000-0000-000000000030";
const TIER_ID = "00000000-0000-0000-0000-000000000031";
const PROJECT_ID = "00000000-0000-0000-0000-000000000040";
const DEPOSIT_ID = "00000000-0000-0000-0000-000000000050";
const MANAGED_POP_ID = "00000000-0000-0000-0000-000000000060";
const TRADE_ROUTE_ID = "00000000-0000-0000-0000-000000000070";
const CITIZEN_A_ID = "00000000-0000-0000-0000-000000000080";
const CITIZEN_B_ID = "00000000-0000-0000-0000-000000000081";
const PARTNERSHIP_ID = "00000000-0000-0000-0000-000000000090";

function makeMinimalCalendarConfig(): SimulationInputState["calendarConfig"] {
  return {
    dateFormatTemplate: "{year}",
    months: [{ dayCount: 30, index: 0, name: "Monthone" }],
    startingDayOfMonth: 1,
    startingMonthIndex: 0,
    startingWeekdayOffset: 0,
    startingYear: 1,
    weekdays: [{ index: 0, name: "Dayone" }],
  };
}

function makeMinimalPopulationRules(): SimulationInputState["populationRules"] {
  return {
    fertilityChance: 0.1,
    foodConsumptionPerCitizen: 1,
    homelessnessDecliningRate: 0.2,
    incestPreventionDepth: 4,
    maximumFertilityAgeTurns: null,
    minimumPartnershipAgeTurns: 18,
    mourningPeriodTurns: 3,
    partnershipSeekChance: 0.5,
    starvationSeverityMultiplier: 1,
    waterConsumptionPerCitizen: 1,
  };
}

function makeBaseInput(
  overrides: Partial<SimulationInputState> = {},
): SimulationInputState {
  return {
    buildingBlueprints: [],
    buildingTiers: [],
    calendarConfig: makeMinimalCalendarConfig(),
    citizenAssignments: [],
    citizens: [],
    constructionProjects: [],
    depositTypes: [],
    deposits: [],
    events: [],
    jobs: [],
    managedPopulationTypes: [],
    managedPopulations: [],
    npcFlavorConfig: null,
    partnerships: [],
    populationRules: makeMinimalPopulationRules(),
    resources: [],
    settlementBuildings: [],
    settlements: [{ id: SETTLEMENT_ID, name: "Test Settlement" }],
    stockpiles: [],
    systemResourceIds: { foodId: FOOD_ID, freshWaterId: WATER_ID },
    tradeRoutes: [],
    turnNumber: 5,
    worldId: WORLD_ID,
    ...overrides,
  };
}

function makeEmptyResult(): SimulationResult {
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
      readyPercentage: 100,
      readySettlementCount: 1,
      totalSettlementCount: 1,
    },
    resourceSnapshots: [],
    settlementSnapshots: [],
    stockpileDeltas: [],
    tradeRouteOutcomes: [],
  };
}

// ---------------------------------------------------------------------------
// planSimulationTransition
// ---------------------------------------------------------------------------

const FIXED_TRANSITION_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("planSimulationTransition", () => {
  it("returns ok:false with status 409 for an archived world", () => {
    const input = makeBaseInput({ isWorldArchived: true });
    const result = planSimulationTransition(input, FIXED_TRANSITION_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error.error.code).toBe("end_turn_world_archived");
    }
  });

  it("returns ok:true and echoes the transitionId from the caller", () => {
    const input = makeBaseInput();
    const result = planSimulationTransition(input, FIXED_TRANSITION_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.transitionId).toBe(FIXED_TRANSITION_ID);
      expect(result.payload).toBeDefined();
    }
  });

  it("uses the provided transitionId as the RNG seed (same id → same payload)", () => {
    const input = makeBaseInput();
    const r1 = planSimulationTransition(input, FIXED_TRANSITION_ID);
    const r2 = planSimulationTransition(input, FIXED_TRANSITION_ID);
    if (r1.ok && r2.ok) {
      expect(r1.transitionId).toBe(r2.transitionId);
    }
  });
});

// ---------------------------------------------------------------------------
// mapSimulationResultToPayload — field mapping
// ---------------------------------------------------------------------------

describe("mapSimulationResultToPayload", () => {
  it("maps an empty result to an empty payload", () => {
    const input = makeBaseInput();
    const result = makeEmptyResult();
    const payload = mapSimulationResultToPayload(result, input);

    expect(payload.stockpileDeltas).toHaveLength(0);
    expect(payload.constructionUpdates).toHaveLength(0);
    expect(payload.buildingsCreated).toHaveLength(0);
    expect(payload.buildingStateChanges).toHaveLength(0);
    expect(payload.depositUpdates).toHaveLength(0);
    expect(payload.managedPopulationUpdates).toHaveLength(0);
    expect(payload.tradeRouteOutcomes).toHaveLength(0);
    expect(payload.bornOnTurnBackfill).toHaveLength(0);
    expect(payload.citizenBirths).toHaveLength(0);
    expect(payload.citizenDeaths).toHaveLength(0);
    expect(payload.partnershipChanges).toHaveLength(0);
    expect(payload.assignmentClears).toHaveLength(0);
    expect(payload.logEntries).toHaveLength(0);
    expect(payload.notifications).toHaveLength(0);
    expect(payload.settlementSnapshots).toHaveLength(0);
  });

  it("§C28: maps resourceSnapshots to stockpileDeltas (rename and shape)", () => {
    const input = makeBaseInput();
    const result: SimulationResult = {
      ...makeEmptyResult(),
      resourceSnapshots: [
        {
          consumed: 5,
          produced: 10,
          quantityAfter: 105,
          quantityBefore: 100,
          resourceId: RESOURCE_ID,
          settlementId: SETTLEMENT_ID,
          tradeIn: 3,
          tradeOut: 3,
          turnNumber: 5,
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);

    expect(payload.stockpileDeltas).toHaveLength(1);
    const delta = payload.stockpileDeltas[0];
    expect(delta.settlementId).toBe(SETTLEMENT_ID);
    expect(delta.resourceId).toBe(RESOURCE_ID);
    expect(delta.quantityBefore).toBe(100);
    expect(delta.quantityAfter).toBe(105);
    expect(delta.produced).toBe(10);
    expect(delta.consumed).toBe(5);
    expect(delta.tradeIn).toBe(3);
    expect(delta.tradeOut).toBe(3);
    // turnNumber should NOT appear in the payload entry (not consumed by the RPC)
    expect("turnNumber" in delta).toBe(false);
  });

  it("§C29a: maps constructionUpdates — delta to absolute progressWorkerTurns", () => {
    const input = makeBaseInput({
      constructionProjects: [
        {
          buildingBlueprintId: BLUEPRINT_ID,
          id: PROJECT_ID,
          progressWorkerTurns: 3,
          queuePosition: 1,
          settlementId: SETTLEMENT_ID,
          status: "in_progress",
          targetTierId: TIER_ID,
          workerTurnsRequired: 10,
        },
      ],
    });
    const result: SimulationResult = {
      ...makeEmptyResult(),
      constructionUpdates: [
        {
          progressWorkerTurnsDelta: 2,
          projectId: PROJECT_ID,
          settlementId: SETTLEMENT_ID,
          toStatus: null,
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);

    expect(payload.constructionUpdates).toHaveLength(1);
    const upd = payload.constructionUpdates[0];
    expect(upd.projectId).toBe(PROJECT_ID);
    expect(upd.progressWorkerTurns).toBe(5); // 3 + 2
    expect(upd.status).toBe("in_progress"); // preserved from input (toStatus is null)
    expect(upd.activatedOnTurnNumber).toBeUndefined(); // already in_progress, not first activation
  });

  it("§C29a: sets activatedOnTurnNumber when project transitions queued → in_progress", () => {
    const input = makeBaseInput({
      constructionProjects: [
        {
          buildingBlueprintId: BLUEPRINT_ID,
          id: PROJECT_ID,
          progressWorkerTurns: 0,
          queuePosition: 1,
          settlementId: SETTLEMENT_ID,
          status: "queued",
          targetTierId: TIER_ID,
          workerTurnsRequired: 10,
        },
      ],
    });
    const result: SimulationResult = {
      ...makeEmptyResult(),
      constructionUpdates: [
        {
          progressWorkerTurnsDelta: 2,
          projectId: PROJECT_ID,
          settlementId: SETTLEMENT_ID,
          toStatus: "in_progress",
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);

    const upd = payload.constructionUpdates[0];
    expect(upd.status).toBe("in_progress");
    expect(upd.activatedOnTurnNumber).toBe(6); // turnNumber + 1 = 5 + 1
  });

  it("§C29b: renames tierId → currentTierId in buildingsCreated", () => {
    const input = makeBaseInput();
    const result: SimulationResult = {
      ...makeEmptyResult(),
      buildingsCreated: [
        {
          buildingBlueprintId: BLUEPRINT_ID,
          settlementId: SETTLEMENT_ID,
          tierId: TIER_ID,
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);

    expect(payload.buildingsCreated).toHaveLength(1);
    const created = payload.buildingsCreated[0];
    expect(created.currentTierId).toBe(TIER_ID);
    expect(created.settlementId).toBe(SETTLEMENT_ID);
    expect(created.buildingBlueprintId).toBe(BLUEPRINT_ID);
    expect("tierId" in created).toBe(false);
  });

  it("§C29c: computes absolute missedUpkeepCount from delta + input", () => {
    const input = makeBaseInput({
      settlementBuildings: [
        {
          activatedOnTurnNumber: 1,
          buildingBlueprintId: BLUEPRINT_ID,
          currentTierId: TIER_ID,
          id: BUILDING_ID,
          missedUpkeepCount: 2,
          settlementId: SETTLEMENT_ID,
          sourceProjectId: null,
          state: "active",
        },
      ],
    });
    const result: SimulationResult = {
      ...makeEmptyResult(),
      buildingStateChanges: [
        {
          missedUpkeepCountDelta: 1,
          settlementBuildingId: BUILDING_ID,
          toState: "suspended",
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);

    expect(payload.buildingStateChanges).toHaveLength(1);
    const sc = payload.buildingStateChanges[0];
    expect(sc.buildingId).toBe(BUILDING_ID);
    expect(sc.state).toBe("suspended");
    expect(sc.missedUpkeepCount).toBe(3); // 2 + 1
    expect("settlementBuildingId" in sc).toBe(false);
  });

  it("§C29c: treats null missedUpkeepCountDelta as 0", () => {
    const input = makeBaseInput({
      settlementBuildings: [
        {
          activatedOnTurnNumber: 1,
          buildingBlueprintId: BLUEPRINT_ID,
          currentTierId: TIER_ID,
          id: BUILDING_ID,
          missedUpkeepCount: 3,
          settlementId: SETTLEMENT_ID,
          sourceProjectId: null,
          state: "suspended",
        },
      ],
    });
    const result: SimulationResult = {
      ...makeEmptyResult(),
      buildingStateChanges: [
        {
          missedUpkeepCountDelta: null,
          settlementBuildingId: BUILDING_ID,
          toState: "active",
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);

    expect(payload.buildingStateChanges[0].missedUpkeepCount).toBe(3);
  });

  it("§C31: derives toStatus 'paused' when pauseReason is set", () => {
    const input = makeBaseInput();
    const result: SimulationResult = {
      ...makeEmptyResult(),
      tradeRouteOutcomes: [
        {
          delivered: false,
          pauseReason: "insufficient_origin_stock",
          quantityTransferred: 0,
          tradeRouteId: TRADE_ROUTE_ID,
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);

    const outcome = payload.tradeRouteOutcomes[0];
    expect(outcome.toStatus).toBe("paused");
    expect(outcome.pauseReason).toBe("insufficient_origin_stock");
    expect(outcome.tradeRouteId).toBe(TRADE_ROUTE_ID);
  });

  it("§C31: derives toStatus 'active' when pauseReason is null (delivery)", () => {
    const input = makeBaseInput();
    const result: SimulationResult = {
      ...makeEmptyResult(),
      tradeRouteOutcomes: [
        {
          delivered: true,
          pauseReason: null,
          quantityTransferred: 20,
          tradeRouteId: TRADE_ROUTE_ID,
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);

    expect(payload.tradeRouteOutcomes[0].toStatus).toBe("active");
  });

  it("§C32 pre-pass: passes citizenPatches through as bornOnTurnBackfill", () => {
    const input = makeBaseInput();
    const result: SimulationResult = {
      ...makeEmptyResult(),
      citizenPatches: [{ bornOnTurnNumber: 3, citizenId: CITIZEN_A_ID }],
    };

    const payload = mapSimulationResultToPayload(result, input);

    expect(payload.bornOnTurnBackfill).toHaveLength(1);
    expect(payload.bornOnTurnBackfill[0].citizenId).toBe(CITIZEN_A_ID);
    expect(payload.bornOnTurnBackfill[0].bornOnTurnNumber).toBe(3);
  });

  it("§C32a: adds bornOnTurnNumber = turnNumber + 1 to citizenBirths", () => {
    const input = makeBaseInput(); // turnNumber = 5
    const result: SimulationResult = {
      ...makeEmptyResult(),
      citizenBirths: [
        {
          givenName: "Newborn",
          npcFlaw: "cowardly",
          npcGoal: "power",
          npcSecretContradiction: null,
          npcTrait1: "brave",
          npcTrait2: null,
          parentACitizenId: CITIZEN_A_ID,
          parentBCitizenId: CITIZEN_B_ID,
          sex: "male",
          settlementId: SETTLEMENT_ID,
          surname: null,
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);

    expect(payload.citizenBirths).toHaveLength(1);
    const birth = payload.citizenBirths[0];
    expect(birth.bornOnTurnNumber).toBe(6); // 5 + 1
    expect(birth.sex).toBe("male");
    expect(birth.settlementId).toBe(SETTLEMENT_ID);
    expect(birth.npcTrait1).toBe("brave");
    expect(birth.parentACitizenId).toBe(CITIZEN_A_ID);
  });

  it("§C32b: renames citizenDeath fields (category → deathCauseCategory, detail → deathCause)", () => {
    const input = makeBaseInput();
    const result: SimulationResult = {
      ...makeEmptyResult(),
      citizenDeaths: [
        {
          category: "starvation",
          citizenId: CITIZEN_A_ID,
          detail: "prolonged food shortage",
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);

    expect(payload.citizenDeaths).toHaveLength(1);
    const death = payload.citizenDeaths[0];
    expect(death.citizenId).toBe(CITIZEN_A_ID);
    expect(death.deathCauseCategory).toBe("starvation");
    expect(death.deathCause).toBe("prolonged food shortage");
    expect("category" in death).toBe(false);
    expect("detail" in death).toBe(false);
  });

  it("§C32c: maps 'formed' partnershipChange to flat entry with toStatus 'active'", () => {
    const input = makeBaseInput(); // turnNumber = 5
    const result: SimulationResult = {
      ...makeEmptyResult(),
      partnershipChanges: [
        {
          citizenAId: CITIZEN_A_ID,
          citizenBId: CITIZEN_B_ID,
          type: "formed",
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);

    expect(payload.partnershipChanges).toHaveLength(1);
    const pc = payload.partnershipChanges[0];
    expect(pc.citizenAId).toBe(CITIZEN_A_ID);
    expect(pc.citizenBId).toBe(CITIZEN_B_ID);
    expect(pc.toStatus).toBe("active");
    expect(pc.formedOnTurnNumber).toBe(6); // 5 + 1
    expect(pc.endedOnTurnNumber).toBeUndefined();
  });

  it("§C32c: maps 'status_changed' partnershipChange — resolves citizenIds from input", () => {
    const input = makeBaseInput({
      partnerships: [
        {
          citizenAId: CITIZEN_A_ID,
          citizenBId: CITIZEN_B_ID,
          endedOnTurnNumber: null,
          formedOnTurnNumber: 1,
          id: PARTNERSHIP_ID,
          status: "active",
        },
      ],
    }); // turnNumber = 5
    const result: SimulationResult = {
      ...makeEmptyResult(),
      partnershipChanges: [
        {
          partnershipId: PARTNERSHIP_ID,
          reason: "death",
          toStatus: "widowed",
          type: "status_changed",
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);

    const pc = payload.partnershipChanges[0];
    expect(pc.citizenAId).toBe(CITIZEN_A_ID);
    expect(pc.citizenBId).toBe(CITIZEN_B_ID);
    expect(pc.toStatus).toBe("widowed");
    expect(pc.endedOnTurnNumber).toBe(6); // 5 + 1
    expect(pc.formedOnTurnNumber).toBeUndefined();
  });

  it("passes through depositUpdates, managedPopulationUpdates, notifications, logEntries, settlementSnapshots, readinessSummary unchanged", () => {
    const input = makeBaseInput();
    const result: SimulationResult = {
      ...makeEmptyResult(),
      depositUpdates: [
        {
          depositInstanceId: DEPOSIT_ID,
          resourceDeltas: [{ delta: -10, resourceId: RESOURCE_ID }],
          toStatus: "depleted",
        },
      ],
      managedPopulationUpdates: [
        {
          countDelta: -2,
          managedPopulationInstanceId: MANAGED_POP_ID,
          toStatus: null,
        },
      ],
      notifications: [
        {
          messageText: "A citizen died.",
          notificationType: "citizen.died",
          scope: "settlement",
          settlementId: SETTLEMENT_ID,
        },
      ],
      logEntries: [
        {
          category: "citizen.death",
          citizenId: CITIZEN_A_ID,
          payload: { cause: "starvation" },
          phase: "citizenConsumption",
          settlementId: SETTLEMENT_ID,
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);

    expect(payload.depositUpdates[0].depositInstanceId).toBe(DEPOSIT_ID);
    expect(payload.depositUpdates[0].toStatus).toBe("depleted");
    expect(payload.managedPopulationUpdates[0].countDelta).toBe(-2);
    expect(payload.notifications[0].messageText).toBe("A citizen died.");
    expect(payload.logEntries[0].category).toBe("citizen.death");
  });

  it("passes through assignmentClears unchanged", () => {
    const input = makeBaseInput();
    const result: SimulationResult = {
      ...makeEmptyResult(),
      assignmentClears: [{ citizenId: CITIZEN_A_ID, reason: "citizen_died" }],
    };

    const payload = mapSimulationResultToPayload(result, input);

    expect(payload.assignmentClears[0].citizenId).toBe(CITIZEN_A_ID);
    expect(payload.assignmentClears[0].reason).toBe("citizen_died");
  });
});

// ---------------------------------------------------------------------------
// Numeric precision round-trip
// ---------------------------------------------------------------------------

describe("numeric precision through JSON", () => {
  it("preserves decimal values (4dp) through JSON.parse(JSON.stringify(...))", () => {
    const input = makeBaseInput();
    const result: SimulationResult = {
      ...makeEmptyResult(),
      resourceSnapshots: [
        {
          consumed: 1234.5678,
          produced: 9876.5432,
          quantityAfter: 11111.1111,
          quantityBefore: 1111.1111,
          resourceId: RESOURCE_ID,
          settlementId: SETTLEMENT_ID,
          tradeIn: 100.0001,
          tradeOut: 99.9999,
          turnNumber: 5,
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);
    const roundTripped = JSON.parse(JSON.stringify(payload)) as typeof payload;

    const delta = roundTripped.stockpileDeltas[0];
    expect(delta.consumed).toBe(1234.5678);
    expect(delta.produced).toBe(9876.5432);
    expect(delta.quantityAfter).toBe(11111.1111);
    expect(delta.quantityBefore).toBe(1111.1111);
    expect(delta.tradeIn).toBe(100.0001);
    expect(delta.tradeOut).toBe(99.9999);
  });

  it("preserves integer turn numbers through JSON.parse(JSON.stringify(...))", () => {
    const input = makeBaseInput(); // turnNumber = 5
    const result: SimulationResult = {
      ...makeEmptyResult(),
      citizenBirths: [
        {
          givenName: "Newborn",
          npcFlaw: null,
          npcGoal: null,
          npcSecretContradiction: null,
          npcTrait1: null,
          npcTrait2: null,
          parentACitizenId: CITIZEN_A_ID,
          parentBCitizenId: CITIZEN_B_ID,
          sex: "female",
          settlementId: SETTLEMENT_ID,
          surname: null,
        },
      ],
    };

    const payload = mapSimulationResultToPayload(result, input);
    const roundTripped = JSON.parse(JSON.stringify(payload)) as typeof payload;

    expect(roundTripped.citizenBirths[0].bornOnTurnNumber).toBe(6);
  });
});
