import { describe, expect, it } from "vitest";

import { makeGoldenWorldInput } from "./goldenWorldFixture.ts";
import { runSimulation } from "./runSimulation.ts";

import type {
  SimArmy,
  SimArmyUnit,
  SimBuildingBlueprint,
  SimBuildingTier,
  SimCitizen,
  SimCitizenAssignment,
  SimJob,
  SimSettlement,
  SimStockpile,
  SimulationInputState,
  SimulationPhaseName,
  SimUnitSoldier,
  SimUnitType,
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
    armies: [],
    armyUnits: [],
    buildingBlueprints: [],
    buildingTiers: [],
    calendarConfig: CALENDAR_CONFIG,
    citizenAssignments: [],
    citizens: [],
    constructionProjects: [],
    depositTypeJobs: [],
    depositTypes: [],
    deposits: [],
    educationEnrollments: [],
    educationLevels: [],
    events: [],
    jobs: [],
    managedPopulationCullingJobs: [],
    managedPopulationHusbandryJobs: [],
    managedPopulationTypes: [],
    managedPopulations: [],
    nationCurrencies: [],
    nationCurrencyLedgerEntries: [],
    nationOffices: [],
    nationRelationships: [],
    nationResourceStockpiles: [],
    nationTaxPolicies: [],
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
    unitTypes: [],
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

function makeArmy(
  id: string,
  stationedSettlementId: string,
  overrides: Partial<SimArmy> = {},
): SimArmy {
  return {
    fundingSource: "host_settlement",
    id,
    name: "1st Spears",
    nationId: "n1",
    stationedSettlementId,
    ...overrides,
  };
}

function makeArmyUnit(id: string, armyId: string): SimArmyUnit {
  return { armyId, id, unitTypeId: "ut1" };
}

function makeUnitSoldier(
  id: string,
  citizenId: string,
  unitId: string,
  homeSettlementId: string | null = null,
): SimUnitSoldier {
  return { citizenId, homeSettlementId, id, unitId };
}

function makeUnitType(id = "ut1"): SimUnitType {
  return { desertionRate: 0, id, upkeepCostsJson: [] };
}

// ---------------------------------------------------------------------------
// Partnership + homelessness interaction
// ---------------------------------------------------------------------------

describe("runSimulation — partnership formed then dies in homelessness same turn", () => {
  it("drops phantom partnership log/notification/snapshot count when partner dies in phase 10", async () => {
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

    const result = await runSimulation(input, "form-then-die-uuid");

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
  it("applies event delta to managed population current_count", async () => {
    const input = makeInput({
      managedPopulationTypes: [
        {
          cullingOutputsJson: [],
          growthRate: 0,
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

    const result = await runSimulation(input, "test-transition-id");

    const update = result.managedPopulationUpdates.find(
      (u) => u.managedPopulationInstanceId === "mp1",
    );
    expect(update).toBeDefined();
    expect(update?.countDelta).toBe(-10);
    expect(update?.toStatus).toBeNull();
  });

  it("clamps event delta so count cannot go below zero", async () => {
    const input = makeInput({
      managedPopulationTypes: [
        {
          cullingOutputsJson: [],
          growthRate: 0,
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

    const result = await runSimulation(input, "test-transition-id");

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
  it("a citizen holding a nation office contributes zero job production that transition", async () => {
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

    const withoutOffice = await runSimulation(makeInput(baseInput), "t1");
    const withOffice = await runSimulation(
      makeInput({ ...baseInput, nationOffices: [{ citizenId: "c1", excludesFromLabor: true }] }),
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
  it("citizen consumption sees the post-tax stockpile", async () => {
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
        { governmentType: "monarchy" as const, id: "n1", name: "Taxland", taxRate: 1.0, tradePolicy: "free" as const },
      ],
      nationTaxPolicies: [
        {
          exempt: false,
          flatAmount: 0,
          method: "percent_production" as const,
          minStockpileFloor: 0,
          nationId: "n1",
          rate: 1.0,
          settlementId: null,
          taxedResourceIds: null,
        },
      ],
      populationRules: { ...BASE_POPULATION_RULES, foodConsumptionPerCitizen: 10 },
      settlements: [{ id: "s1", name: "s1", nationId: "n1" }],
      stockpiles: [makeStockpile("s1", "food", 0)],
    };

    const taxedResult = await runSimulation(makeInput(baseInput), "t-tax");
    const taxedLog = taxedResult.logEntries.find(
      (l) => l.category === "citizen.consumed_food_water",
    );
    expect(taxedLog).toMatchObject({ payload: { foodStock: 0 } });

    const untaxedResult = await runSimulation(
      makeInput({
        ...baseInput,
        nations: [
          { governmentType: "monarchy" as const, id: "n1", name: "Taxland", taxRate: 0, tradePolicy: "free" as const },
        ],
        nationTaxPolicies: [],
      }),
      "t-notax",
    );
    const untaxedLog = untaxedResult.logEntries.find(
      (l) => l.category === "citizen.consumed_food_water",
    );
    expect(untaxedLog).toMatchObject({ payload: { foodStock: 10 } });
  });

  it("does nothing when tax_rate is 0 (regression-safe default)", async () => {
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

    const result = await runSimulation(
      makeInput({
        citizenAssignments: [assignment],
        citizens: [makeMaleNpc("worker", "s1")],
        jobs: [job],
        nations: [
          { governmentType: "monarchy" as const, id: "n1", name: "Taxland", taxRate: 0, tradePolicy: "free" as const },
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

// ---------------------------------------------------------------------------
// Soldier lifecycle (#1111): consumption residency, death cascade, army
// stationing never mutates citizens.settlement_id.
// ---------------------------------------------------------------------------

describe("runSimulation — soldier lifecycle (#1111)", () => {
  it("a soldier consumes food at their army's stationed settlement, not their home settlement", async () => {
    const soldier = makeMaleNpc("soldier1", "home");

    const result = await runSimulation(
      makeInput({
        armies: [makeArmy("a1", "stationed")],
        armyUnits: [makeArmyUnit("u1", "a1")],
        citizens: [soldier],
        populationRules: {
          ...BASE_POPULATION_RULES,
          foodConsumptionPerCitizen: 1,
        },
        settlements: [makeSettlement("home"), makeSettlement("stationed")],
        stockpiles: [
          makeStockpile("home", "food", 100),
          makeStockpile("stationed", "food", 100),
        ],
        unitSoldiers: [makeUnitSoldier("us1", "soldier1", "u1", "home")],
        unitTypes: [makeUnitType()],
      }),
      "t-soldier-consumption",
    );

    const foodDeltas = result.stockpileDeltas.filter((d) => d.resourceId === "food");
    expect(foodDeltas).toEqual([{ delta: -1, resourceId: "food", settlementId: "stationed" }]);

    // citizens.settlement_id must never be mutated by stationing.
    expect(result.citizenPatches).toHaveLength(0);
  });

  it("starvation death removes the soldier's unit_soldiers row, logs it, and disbands an emptied unit", async () => {
    const soldier = makeMaleNpc("soldier1", "home");

    const result = await runSimulation(
      makeInput({
        armies: [makeArmy("a1", "stationed")],
        armyUnits: [makeArmyUnit("u1", "a1")],
        citizens: [soldier],
        populationRules: {
          ...BASE_POPULATION_RULES,
          foodConsumptionPerCitizen: 1,
          starvationSeverityMultiplier: 10,
        },
        settlements: [makeSettlement("home"), makeSettlement("stationed")],
        // No food at the stationed settlement -> full deficit -> starves.
        stockpiles: [makeStockpile("stationed", "food", 0)],
        unitSoldiers: [makeUnitSoldier("us1", "soldier1", "u1", "home")],
        unitTypes: [makeUnitType()],
      }),
      "t-soldier-starvation",
    );

    expect(result.citizenDeaths.map((d) => d.citizenId)).toEqual(["soldier1"]);
    expect(result.deceasedSoldierIds).toEqual(["us1"]);
    expect(result.disbandedUnits).toContainEqual({ armyId: "a1", unitId: "u1" });
    expect(
      result.logEntries.some((l) => l.category === "military.soldiers_died"),
    ).toBe(true);
    expect(
      result.logEntries.some(
        (l) => l.category === "military.unit_disbanded" && l.payload.unitId === "u1",
      ),
    ).toBe(true);
  });

  it("a soldier is never counted as homeless at their home settlement while enlisted", async () => {
    const soldier = makeMaleNpc("soldier1", "home");

    const result = await runSimulation(
      makeInput({
        armies: [makeArmy("a1", "stationed")],
        armyUnits: [makeArmyUnit("u1", "a1")],
        citizens: [soldier],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        // No buildings -> population cap 0 at "home". Without the soldier
        // exclusion this would drive one homelessness death.
        settlements: [makeSettlement("home"), makeSettlement("stationed")],
        unitSoldiers: [makeUnitSoldier("us1", "soldier1", "u1", "home")],
        unitTypes: [makeUnitType()],
      }),
      "t-soldier-homelessness",
    );

    expect(result.citizenDeaths).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Treaty tribute applied exactly once (#1127): phaseTreaties must not mutate
// context.shared.pendingNationStockpiles directly AND return deltas the
// orchestrator re-applies — that double-charges the payer / double-credits
// the payee, so downstream phaseMilitaryUpkeep (nation-funded army) can see
// a balance that's wrong by one tribute payment.
// ---------------------------------------------------------------------------

describe("runSimulation — treaty tribute applied once (#1127)", () => {
  it("a nation-funded army affordable at 1x tribute debit does not desert", async () => {
    const soldier = makeMaleNpc("soldier1", "stationed");

    const result = await runSimulation(
      makeInput({
        armies: [
          makeArmy("a1", "stationed", { fundingSource: "nation", nationId: "payer" }),
        ],
        armyUnits: [makeArmyUnit("u1", "a1")],
        citizens: [soldier],
        nationResourceStockpiles: [{ nationId: "payer", quantity: 10, resourceId: "gold" }],
        nationTreaties: [
          {
            endsTurnNumber: null,
            id: "t1",
            marriageCitizenAId: null,
            marriageCitizenBId: null,
            proposerNationId: "payer",
            responderNationId: "payee",
            treatyType: "tribute",
            tributePayer: "proposer",
            tributeQuantityPerTurn: 3,
            tributeResourceId: "gold",
          },
        ],
        settlements: [makeSettlement("stationed")],
        unitSoldiers: [makeUnitSoldier("us1", "soldier1", "u1", "stationed")],
        // desertionRate 1 with a single soldier makes any shortfall
        // deterministic (exactly one deserter, no RNG-dependent count).
        unitTypes: [
          { desertionRate: 1, id: "ut1", upkeepCostsJson: [{ amount: 6, resourceId: "gold" }] },
        ],
      }),
      "t-treaty-tribute-once",
    );

    // Correct (single-apply) balance: 10 - 3 (tribute) - 6 (upkeep) = 1, so
    // upkeep is fully paid and nobody deserts. With the #1127 double-apply
    // bug the payer would see 10 - 6 (tribute double-applied) = 4 at the
    // upkeep check, short of the 6 required, and the soldier would desert.
    expect(result.desertedSoldiers).toHaveLength(0);
    expect(result.armyTurnSnapshots).toContainEqual(
      expect.objectContaining({ armyId: "a1", upkeepPaid: true }),
    );

    // The two nation deltas emitted (tribute -3, upkeep -6) must be the only
    // ones — applied once each, matching the phase-level unit test's direct
    // assertion of the same invariant.
    const goldDeltasForPayer = result.nationStockpileDeltas.filter(
      (d) => d.nationId === "payer" && d.resourceId === "gold",
    );
    expect(goldDeltasForPayer).toEqual([{ delta: -3, nationId: "payer", resourceId: "gold" }, {
      delta: -6,
      nationId: "payer",
      resourceId: "gold",
    }]);
  });
});

describe("runSimulation onPhase", () => {
  it("reports every phase once, in run order", async () => {
    const seen: SimulationPhaseName[] = [];

    await runSimulation(makeGoldenWorldInput(), "tt-phase-test", {
      onPhase: (phase) => {
        seen.push(phase);
      },
    });

    expect(seen).toEqual([
      "standard_jobs",
      "deposit_extraction",
      "construction",
      "building_upkeep",
      "education",
      "passive_effects",
      "trade_routes",
      "national_economy",
      "treaties",
      "managed_populations",
      "military_upkeep",
      "citizen_consumption",
      "partnerships",
      "homelessness",
      "events",
      "stockpile_clamp",
      "resource_decay",
      "succession",
      "treaty_marriage_notes",
      "logs_and_snapshots",
    ]);
  });

  it("yields to the event loop between phases", async () => {
    let ticked = false;
    setTimeout(() => {
      ticked = true;
    }, 0);

    await runSimulation(makeGoldenWorldInput(), "tt-yield-test");

    expect(ticked).toBe(true);
  });
});
