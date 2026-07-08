import { describe, expect, it } from "vitest";

import { runSimulation } from "./runSimulation.ts";

import type {
  SimBuildingBlueprint,
  SimBuildingTier,
  SimCitizen,
  SimCitizenAssignment,
  SimJob,
  SimSettlement,
  SimStockpile,
  SimulationInputState,
} from "./simulationTypes.ts";

// ---------------------------------------------------------------------------
// Shared test helpers
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

const BASE_POPULATION_RULES: SimulationInputState["populationRules"] = {
  fertilityChance: 0,
  foodConsumptionPerCitizen: 0,
  homelessnessDecliningRate: 0,
  incestPreventionDepth: 0,
  maximumFertilityAgeTurns: null,
  minimumPartnershipAgeTurns: 0,
  mourningPeriodTurns: 0,
  partnershipSeekChance: 1.0,
  starvationSeverityMultiplier: 0,
  waterConsumptionPerCitizen: 0,
};

function makeInput(
  overrides: Partial<SimulationInputState>,
): SimulationInputState {
  return {
    buildingBlueprints: [],
    buildingTiers: [],
    calendarConfig: CALENDAR_CONFIG,
    citizenAssignments: [],
    citizens: [],
    constructionProjects: [],
    depositTypes: [],
    deposits: [],
    educationEnrollments: [],
    educationLevels: [],
    events: [],
    jobs: [],
    managedPopulationTypes: [],
    managedPopulations: [],
    nationCurrencies: [],
    nationCurrencyLedgerEntries: [],
    nationOffices: [],
    nationRelationships: [],
    nationResourceStockpiles: [],
    nationTreaties: [],
    nations: [],
    partnerships: [],
    populationRules: BASE_POPULATION_RULES,
    resources: [],
    settlementBuildings: [],
    settlements: [{ id: "s1", name: "Testville" }],
    stockpiles: [],
    systemResourceIds: { foodId: "food", freshWaterId: "water" },
    tradeRoutes: [],
    turnNumber: 5,
    unitSoldiers: [],
    worldId: "w1",
    ...overrides,
  };
}

function makeSettlement(id: string): SimSettlement {
  return { id, name: id };
}

function makeMaleNpc(id: string, settlementId: string): SimCitizen {
  return {
    bornOnTurnNumber: 1,
    citizenType: "npc",
    cultureId: null,
    educationLevelId: null,
    givenName: id,
    id,
    namesetId: null,
    parentACitizenId: null,
    parentBCitizenId: null,
    religionId: null,
    roleNationId: null,
    roleSettlementId: null,
    roleType: "none",
    settlementId,
    sex: "male",
    status: "alive",
    surname: null,
  };
}

function makeFemaleNpc(id: string, settlementId: string): SimCitizen {
  return {
    bornOnTurnNumber: 1,
    citizenType: "npc",
    cultureId: null,
    educationLevelId: null,
    givenName: id,
    id,
    namesetId: null,
    parentACitizenId: null,
    parentBCitizenId: null,
    religionId: null,
    roleNationId: null,
    roleSettlementId: null,
    roleType: "none",
    settlementId,
    sex: "female",
    status: "alive",
    surname: null,
  };
}

function makeStockpile(
  settlementId: string,
  resourceId: string,
  quantity: number,
  cap = 500,
): SimStockpile {
  return { cap, quantity, resourceId, settlementId };
}

function makeBuildingBlueprint(): SimBuildingBlueprint {
  return {
    gracePeriodTurns: 0,
    id: "bp1",
    maxInstancesPerSettlement: null,
    name: "Housing",
  };
}

function makeBuildingTier(): SimBuildingTier {
  return {
    buildingBlueprintId: "bp1",
    constructionCostsJson: [],
    educationConfigJson: null,
    effectsJson: [
      {
        amount: 1,
        type: "population_cap_increase",
      },
    ],
    id: "tier1",
    tierNumber: 1,
    upkeepCostsJson: [],
    workerTurnsRequired: 0,
  };
}

// ---------------------------------------------------------------------------
// Partnership + homelessness interaction
// ---------------------------------------------------------------------------

describe("runSimulation — partnership formed then dies in homelessness same turn", () => {
  it("drops phantom partnership log/notification/snapshot count when partner dies in phase 10", () => {
    // Setup: two citizens, no population cap, high homelessness rate.
    // Expected: phase 9 forms partnership, phase 10 kills the younger citizen.
    // Result: no partnership.formed log, notification, or count in snapshot.

    const input = makeInput({
      settlements: [makeSettlement("s1")],
      citizens: [makeMaleNpc("male1", "s1"), makeFemaleNpc("female1", "s1")],
      buildingBlueprints: [makeBuildingBlueprint()],
      buildingTiers: [makeBuildingTier()],
      settlementBuildings: [
        {
          activatedOnTurnNumber: 0,
          buildingBlueprintId: "bp1",
          currentTierId: "tier1",
          id: "b1",
          missedUpkeepCount: 0,
          settlementId: "s1",
          sourceProjectId: null,
          state: "active",
        },
      ],
      stockpiles: [
        makeStockpile("s1", "food", 100),
        makeStockpile("s1", "water", 100),
      ],
      populationRules: {
        ...BASE_POPULATION_RULES,
        // 1 population cap + 100% declining rate = 1 homeless citizen dies
        homelessnessDecliningRate: 1.0,
        partnershipSeekChance: 1.0,
      },
    });

    const result = runSimulation(input, "form-then-die-uuid");

    // Verify no partnership.formed logs
    const partnershipLogs = result.logEntries.filter(
      (log) => log.category === "partnership.formed",
    );
    expect(partnershipLogs).toHaveLength(0);

    // Verify no partnership.formed notifications
    const partnershipNotifs = result.notifications.filter(
      (notif) => notif.notificationType === "partnership.formed",
    );
    expect(partnershipNotifs).toHaveLength(0);

    // Verify partnershipsFormedCount is 0 in snapshot
    const snapshot = result.settlementSnapshots.find(
      (s) => s.settlementId === "s1",
    );
    expect(snapshot).toBeDefined();
    if (snapshot !== undefined) {
      expect(snapshot.partnershipsFormedCount).toBe(0);
    }

    // Verify one citizen died (from homelessness in phase 10)
    expect(result.citizenDeaths).toHaveLength(1);
    expect(result.citizenDeaths[0].category).toBe("homeless");

    // Verify no partnership changes persisted
    expect(result.partnershipChanges).toHaveLength(0);
  });
});

describe("runSimulation — managed_population_change event delta", () => {
  it("applies event delta to managed population current_count", () => {
    const input = makeInput({
      managedPopulationTypes: [
        {
          cullingJobId: "cull-job",
          cullingOutputsJson: [],
          growthRate: 0,
          husbandryJobId: "husb-job",
          husbandryWorkersPerNAnimals: 0,
          id: "mpt1",
          maintenanceRulesJson: [],
          name: "Chickens",
          regularOutputsJson: [],
        },
      ],
      managedPopulations: [
        {
          configuredCullQuantity: 0,
          currentCount: 20,
          id: "mp1",
          managedPopulationTypeId: "mpt1",
          name: "Chickens",
          settlementId: "s1",
          status: "active",
        },
      ],
      events: [
        {
          activateOnTransitionAfterTurnNumber: 0,
          durationType: "instant",
          effectPayloadJsonb: { delta: -10, managedPopulationId: "mp1" },
          effectType: "managed_population_change",
          effects: [],
          id: "evt1",
          remainingTransitions: null,
          status: "active",
        },
      ],
    });

    const result = runSimulation(input, "test-transition-id");

    const update = result.managedPopulationUpdates.find(
      (u) => u.managedPopulationInstanceId === "mp1",
    );
    expect(update).toBeDefined();
    expect(update?.countDelta).toBe(-10);
    expect(update?.toStatus).toBeNull();
  });

  it("clamps event delta so count cannot go below zero", () => {
    const input = makeInput({
      managedPopulationTypes: [
        {
          cullingJobId: "cull-job",
          cullingOutputsJson: [],
          growthRate: 0,
          husbandryJobId: "husb-job",
          husbandryWorkersPerNAnimals: 0,
          id: "mpt1",
          maintenanceRulesJson: [],
          name: "Chickens",
          regularOutputsJson: [],
        },
      ],
      managedPopulations: [
        {
          configuredCullQuantity: 0,
          currentCount: 5,
          id: "mp1",
          managedPopulationTypeId: "mpt1",
          name: "Chickens",
          settlementId: "s1",
          status: "active",
        },
      ],
      events: [
        {
          activateOnTransitionAfterTurnNumber: 0,
          durationType: "instant",
          effectPayloadJsonb: { delta: -100, managedPopulationId: "mp1" },
          effectType: "managed_population_change",
          effects: [],
          id: "evt1",
          remainingTransitions: null,
          status: "active",
        },
      ],
    });

    const result = runSimulation(input, "test-transition-id");

    const update = result.managedPopulationUpdates.find(
      (u) => u.managedPopulationInstanceId === "mp1",
    );
    expect(update).toBeDefined();
    expect(update?.countDelta).toBe(-5);
    expect(update?.toStatus).toBe("extinct");
  });
});

// ---------------------------------------------------------------------------
// Officeholder job/deposit/trade exclusion (#1081)
// ---------------------------------------------------------------------------

describe("runSimulation — officeholders leave the settlement labor pool", () => {
  it("a citizen holding a nation office contributes zero job production that transition", () => {
    const job: SimJob = {
      baseCapacity: null,
      id: "job1",
      inputsJson: [],
      jobType: "standard",
      linkedDepositTypeId: null,
      linkedManagedPopulationTypeId: null,
      name: "Farming",
      outputsJson: [{ amountPerWorker: 10, resourceId: "food" }],
      requiredEducationLevelId: null,
      traderCapacityPerWorker: null,
    };
    const assignment: SimCitizenAssignment = {
      assignedOnTurnNumber: 1,
      assignmentType: "standard_job",
      citizenId: "c1",
      constructionProjectId: null,
      depositInstanceId: null,
      jobId: "job1",
      managedPopulationInstanceId: null,
      tradeRouteEnd: null,
      tradeRouteId: null,
    };

    const baseInput = {
      settlements: [makeSettlement("s1")],
      citizens: [makeMaleNpc("c1", "s1")],
      citizenAssignments: [assignment],
      jobs: [job],
      stockpiles: [makeStockpile("s1", "food", 0)],
    };

    const withoutOffice = runSimulation(makeInput(baseInput), "t1");
    const withOffice = runSimulation(
      makeInput({ ...baseInput, nationOffices: [{ citizenId: "c1" }] }),
      "t2",
    );

    const foodDeltaWithout = withoutOffice.stockpileDeltas
      .filter((d) => d.resourceId === "food")
      .reduce((sum, d) => sum + d.delta, 0);
    const foodDeltaWithOffice = withOffice.stockpileDeltas
      .filter((d) => d.resourceId === "food")
      .reduce((sum, d) => sum + d.delta, 0);

    expect(foodDeltaWithout).toBe(10);
    expect(foodDeltaWithOffice).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// National economy tax collection (#1083)
// ---------------------------------------------------------------------------

describe("runSimulation — national economy tax collection", () => {
  it("citizen consumption sees the post-tax stockpile", () => {
    const job: SimJob = {
      baseCapacity: null,
      id: "job1",
      inputsJson: [],
      jobType: "standard",
      linkedDepositTypeId: null,
      linkedManagedPopulationTypeId: null,
      name: "Farming",
      outputsJson: [{ amountPerWorker: 10, resourceId: "food" }],
      requiredEducationLevelId: null,
      traderCapacityPerWorker: null,
    };
    const assignment: SimCitizenAssignment = {
      assignedOnTurnNumber: 1,
      assignmentType: "standard_job",
      citizenId: "worker",
      constructionProjectId: null,
      depositInstanceId: null,
      jobId: "job1",
      managedPopulationInstanceId: null,
      tradeRouteEnd: null,
      tradeRouteId: null,
    };

    const baseInput = {
      citizenAssignments: [assignment],
      citizens: [makeMaleNpc("worker", "s1")],
      jobs: [job],
      nations: [
        { governmentType: "monarchy" as const, id: "n1", name: "Taxland", taxRate: 1.0 },
      ],
      populationRules: { ...BASE_POPULATION_RULES, foodConsumptionPerCitizen: 10 },
      settlements: [{ id: "s1", name: "s1", nationId: "n1" }],
      stockpiles: [makeStockpile("s1", "food", 0)],
    };

    const taxedResult = runSimulation(makeInput(baseInput), "t-tax");
    const taxedLog = taxedResult.logEntries.find(
      (l) => l.category === "citizen.consumed_food_water",
    );
    expect(taxedLog).toMatchObject({ payload: { foodStock: 0 } });

    const untaxedResult = runSimulation(
      makeInput({
        ...baseInput,
        nations: [
          { governmentType: "monarchy" as const, id: "n1", name: "Taxland", taxRate: 0 },
        ],
      }),
      "t-notax",
    );
    const untaxedLog = untaxedResult.logEntries.find(
      (l) => l.category === "citizen.consumed_food_water",
    );
    expect(untaxedLog).toMatchObject({ payload: { foodStock: 10 } });
  });

  it("does nothing when tax_rate is 0 (regression-safe default)", () => {
    const job: SimJob = {
      baseCapacity: null,
      id: "job1",
      inputsJson: [],
      jobType: "standard",
      linkedDepositTypeId: null,
      linkedManagedPopulationTypeId: null,
      name: "Farming",
      outputsJson: [{ amountPerWorker: 10, resourceId: "food" }],
      requiredEducationLevelId: null,
      traderCapacityPerWorker: null,
    };
    const assignment: SimCitizenAssignment = {
      assignedOnTurnNumber: 1,
      assignmentType: "standard_job",
      citizenId: "worker",
      constructionProjectId: null,
      depositInstanceId: null,
      jobId: "job1",
      managedPopulationInstanceId: null,
      tradeRouteEnd: null,
      tradeRouteId: null,
    };

    const result = runSimulation(
      makeInput({
        citizenAssignments: [assignment],
        citizens: [makeMaleNpc("worker", "s1")],
        jobs: [job],
        nations: [
          { governmentType: "monarchy" as const, id: "n1", name: "Taxland", taxRate: 0 },
        ],
        settlements: [{ id: "s1", name: "s1", nationId: "n1" }],
        stockpiles: [makeStockpile("s1", "food", 0)],
      }),
      "t-notax-default",
    );

    expect(result.nationStockpileDeltas).toHaveLength(0);
    expect(result.nationTurnSnapshots).toHaveLength(0);
    expect(result.logEntries.filter((l) => l.category === "economy")).toHaveLength(0);
  });
});
