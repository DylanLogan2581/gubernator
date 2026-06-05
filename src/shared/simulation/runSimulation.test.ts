import { describe, expect, it } from "vitest";

import { runSimulation, SimulationRejectionError } from "./runSimulation.ts";

import type {
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
  minimumPartnershipAgeTurns: 999,
  mourningPeriodTurns: 0,
  partnershipSeekChance: 0,
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
    events: [],
    jobs: [],
    managedPopulationTypes: [],
    managedPopulations: [],
    partnerships: [],
    populationRules: BASE_POPULATION_RULES,
    settlementBuildings: [],
    settlements: [{ id: "s1", name: "Testville" }],
    stockpiles: [],
    systemResourceIds: { foodId: "food", freshWaterId: "water" },
    tradeRoutes: [],
    turnNumber: 5,
    worldId: "w1",
    ...overrides,
  };
}

function makeSettlement(id: string): SimSettlement {
  return { id, name: id };
}

function makeNpc(id: string, settlementId: string): SimCitizen {
  return {
    bornOnTurnNumber: 1,
    citizenType: "npc",
    id,
    name: id,
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId,
    sex: "female",
    status: "alive",
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

function makeJob(
  id: string,
  inputs: { resourceId: string; amountPerWorker: number }[],
  outputs: { resourceId: string; amountPerWorker: number }[],
): SimJob {
  return {
    baseCapacity: null,
    id,
    inputsJson: inputs,
    jobType: "standard",
    linkedDepositTypeId: null,
    linkedManagedPopulationTypeId: null,
    name: id,
    outputsJson: outputs,
    traderCapacityPerWorker: null,
  };
}

function makeAssignment(
  citizenId: string,
  jobId: string,
): SimCitizenAssignment {
  return {
    assignedOnTurnNumber: 1,
    assignmentType: "standard_job",
    citizenId,
    constructionProjectId: null,
    depositInstanceId: null,
    jobId,
    managedPopulationInstanceId: null,
    tradeRouteEnd: null,
    tradeRouteId: null,
  };
}

// ---------------------------------------------------------------------------
// Archived world rejection
// ---------------------------------------------------------------------------

describe("runSimulation — archived world", () => {
  it("throws SimulationRejectionError before any phase runs when isWorldArchived is true", () => {
    const input = makeInput({ isWorldArchived: true });

    expect(() => runSimulation(input, "transition-uuid-1")).toThrow(
      SimulationRejectionError,
    );
  });

  it("rejection error carries code world_archived", () => {
    const input = makeInput({ isWorldArchived: true });

    let caught: unknown;
    try {
      runSimulation(input, "transition-uuid-1");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(SimulationRejectionError);
    if (caught instanceof SimulationRejectionError) {
      expect(caught.code).toBe("world_archived");
    }
  });

  it("does not throw when isWorldArchived is false", () => {
    const input = makeInput({ isWorldArchived: false });

    expect(() => runSimulation(input, "transition-uuid-1")).not.toThrow();
  });

  it("does not throw when isWorldArchived is omitted", () => {
    const input = makeInput({});

    expect(() => runSimulation(input, "transition-uuid-1")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Happy turn: resource flow across phases
// ---------------------------------------------------------------------------

describe("runSimulation — happy turn end-to-end", () => {
  it("phase 1 + 8: job produces/consumes resources and citizen consumption deducts food/water", () => {
    // 2 lumber → 1 plank via sawmill job; each citizen eats 1 food and 1 water.
    const input = makeInput({
      settlements: [makeSettlement("s1")],
      citizens: [makeNpc("c1", "s1"), makeNpc("c2", "s1")],
      citizenAssignments: [makeAssignment("c1", "sawmill")],
      jobs: [
        makeJob(
          "sawmill",
          [{ resourceId: "lumber", amountPerWorker: 2 }],
          [{ resourceId: "planks", amountPerWorker: 1 }],
        ),
      ],
      stockpiles: [
        makeStockpile("s1", "lumber", 100),
        makeStockpile("s1", "planks", 0),
        makeStockpile("s1", "food", 80),
        makeStockpile("s1", "water", 80),
      ],
      populationRules: {
        ...BASE_POPULATION_RULES,
        foodConsumptionPerCitizen: 1,
        waterConsumptionPerCitizen: 1,
      },
    });

    const result = runSimulation(input, "test-transition-happy");

    // --- stockpile deltas --------------------------------------------------
    const sumDeltaFor = (resourceId: string): number =>
      result.stockpileDeltas
        .filter((d) => d.settlementId === "s1" && d.resourceId === resourceId)
        .reduce((acc, d) => acc + d.delta, 0);

    expect(sumDeltaFor("lumber")).toBe(-2); // 1 worker × 2/worker consumed
    expect(sumDeltaFor("planks")).toBe(1); // 1 worker × 1/worker produced
    expect(sumDeltaFor("food")).toBe(-2); // 2 citizens × 1 each
    expect(sumDeltaFor("water")).toBe(-2); // 2 citizens × 1 each

    // --- resource snapshots -----------------------------------------------
    const snap = (
      resourceId: string,
    ): (typeof result.resourceSnapshots)[number] | undefined =>
      result.resourceSnapshots.find(
        (s) => s.settlementId === "s1" && s.resourceId === resourceId,
      );

    const lumberSnap = snap("lumber");
    expect(lumberSnap).toBeDefined();
    expect(lumberSnap?.quantityBefore).toBe(100);
    expect(lumberSnap?.quantityAfter).toBe(98);
    expect(lumberSnap?.consumed).toBe(2);
    expect(lumberSnap?.produced).toBe(0);

    const planksSnap = snap("planks");
    expect(planksSnap).toBeDefined();
    expect(planksSnap?.quantityBefore).toBe(0);
    expect(planksSnap?.quantityAfter).toBe(1);
    expect(planksSnap?.produced).toBe(1);
    expect(planksSnap?.consumed).toBe(0);

    const foodSnap = snap("food");
    expect(foodSnap).toBeDefined();
    expect(foodSnap?.quantityBefore).toBe(80);
    expect(foodSnap?.quantityAfter).toBe(78);
    expect(foodSnap?.consumed).toBe(2);

    // --- settlement snapshot -----------------------------------------------
    const sSnap = result.settlementSnapshots.find(
      (s) => s.settlementId === "s1",
    );
    expect(sSnap).toBeDefined();
    expect(sSnap?.aliveTotal).toBe(2);
    expect(sSnap?.deathCount).toBe(0);
    expect(sSnap?.turnNumber).toBe(5);
  });

  it("phase 5: passive resource production from an active building adds to stockpile", () => {
    const tier = {
      buildingBlueprintId: "bp1",
      constructionCostsJson: [],
      effectsJson: [
        {
          amount: 5,
          resourceId: "gold",
          type: "passive_resource_production" as const,
        },
      ],
      id: "tier1",
      tierNumber: 1,
      upkeepCostsJson: [],
      workerTurnsRequired: 10,
    };
    const building = {
      activatedOnTurnNumber: 1,
      buildingBlueprintId: "bp1",
      currentTierId: "tier1",
      id: "bld1",
      missedUpkeepCount: 0,
      settlementId: "s1",
      sourceProjectId: null,
      state: "active" as const,
    };

    const input = makeInput({
      settlements: [makeSettlement("s1")],
      buildingTiers: [tier],
      settlementBuildings: [building],
      stockpiles: [makeStockpile("s1", "gold", 10)],
    });

    const result = runSimulation(input, "test-transition-passive");

    const goldSnap = result.resourceSnapshots.find(
      (s) => s.settlementId === "s1" && s.resourceId === "gold",
    );
    expect(goldSnap?.produced).toBe(5);
    expect(goldSnap?.quantityAfter).toBe(15);
  });

  it("phase 12: stockpile clamp prevents exceeding cap", () => {
    // Job produces 10 planks but cap is only 5.
    const input = makeInput({
      settlements: [makeSettlement("s1")],
      citizens: [makeNpc("c1", "s1")],
      citizenAssignments: [makeAssignment("c1", "mill")],
      jobs: [
        makeJob("mill", [], [{ resourceId: "planks", amountPerWorker: 10 }]),
      ],
      stockpiles: [makeStockpile("s1", "planks", 0, 5)],
    });

    const result = runSimulation(input, "test-transition-clamp");

    const planksSnap = result.resourceSnapshots.find(
      (s) => s.settlementId === "s1" && s.resourceId === "planks",
    );
    // Output uncapped = 10, but cap = 5 — clamp kicks in.
    expect(planksSnap?.quantityAfter).toBe(5);
  });

  it("produces deterministic output for the same transitionId", () => {
    const input = makeInput({
      settlements: [makeSettlement("s1")],
      citizens: [makeNpc("c1", "s1")],
      citizenAssignments: [makeAssignment("c1", "sawmill")],
      jobs: [
        makeJob("sawmill", [], [{ resourceId: "planks", amountPerWorker: 2 }]),
      ],
      stockpiles: [makeStockpile("s1", "planks", 0)],
    });

    const r1 = runSimulation(input, "same-transition-id");
    const r2 = runSimulation(input, "same-transition-id");

    expect(r1.stockpileDeltas).toEqual(r2.stockpileDeltas);
    expect(r1.resourceSnapshots).toEqual(r2.resourceSnapshots);
    expect(r1.settlementSnapshots).toEqual(r2.settlementSnapshots);
  });

  it("returns readiness summary derived from input settlement state", () => {
    const input = makeInput({
      settlements: [
        {
          id: "s1",
          name: "Testville",
          isReadyCurrentTurn: true,
          autoReadyEnabled: false,
        },
      ],
    });

    const result = runSimulation(input, "transition-readiness");

    expect(result.readinessSummary).toEqual({
      notReadySettlementCount: 0,
      readyPercentage: 100,
      readySettlementCount: 1,
      totalSettlementCount: 1,
    });
  });

  it("assembles log entries from all active phases", () => {
    const input = makeInput({
      settlements: [makeSettlement("s1")],
      citizens: [makeNpc("c1", "s1")],
      citizenAssignments: [makeAssignment("c1", "sawmill")],
      jobs: [
        makeJob("sawmill", [], [{ resourceId: "planks", amountPerWorker: 1 }]),
      ],
      stockpiles: [makeStockpile("s1", "planks", 0)],
    });

    const result = runSimulation(input, "test-transition-logs");

    const phases = [...new Set(result.logEntries.map((e) => e.phase))];
    expect(phases).toContain("standardJobs");
  });
});

// ---------------------------------------------------------------------------
// readinessSummary: computed from input settlements
// ---------------------------------------------------------------------------

describe("runSimulation — readinessSummary", () => {
  it("reports 0/0 ready for an empty settlements list", () => {
    const input = makeInput({ settlements: [] });
    const result = runSimulation(input, "t-readiness-empty");
    expect(result.readinessSummary).toEqual({
      notReadySettlementCount: 0,
      readyPercentage: 0,
      readySettlementCount: 0,
      totalSettlementCount: 0,
    });
  });

  it("reports 0/1 when the single settlement is not ready", () => {
    const input = makeInput({
      settlements: [
        {
          id: "s1",
          name: "s1",
          isReadyCurrentTurn: false,
          autoReadyEnabled: false,
        },
      ],
    });
    const result = runSimulation(input, "t-readiness-none");
    expect(result.readinessSummary).toEqual({
      notReadySettlementCount: 1,
      readyPercentage: 0,
      readySettlementCount: 0,
      totalSettlementCount: 1,
    });
  });

  it("reports 1/1 when the settlement is manually marked ready", () => {
    const input = makeInput({
      settlements: [
        {
          id: "s1",
          name: "s1",
          isReadyCurrentTurn: true,
          autoReadyEnabled: false,
        },
      ],
    });
    const result = runSimulation(input, "t-readiness-manual");
    expect(result.readinessSummary).toEqual({
      notReadySettlementCount: 0,
      readyPercentage: 100,
      readySettlementCount: 1,
      totalSettlementCount: 1,
    });
  });

  it("reports 1/1 when the settlement has auto-ready enabled", () => {
    const input = makeInput({
      settlements: [
        {
          id: "s1",
          name: "s1",
          isReadyCurrentTurn: false,
          autoReadyEnabled: true,
        },
      ],
    });
    const result = runSimulation(input, "t-readiness-auto");
    expect(result.readinessSummary).toEqual({
      notReadySettlementCount: 0,
      readyPercentage: 100,
      readySettlementCount: 1,
      totalSettlementCount: 1,
    });
  });

  it("reports 2/4 ready (50%) for a four-settlement world with two ready", () => {
    const input = makeInput({
      settlements: [
        {
          id: "s1",
          name: "s1",
          isReadyCurrentTurn: true,
          autoReadyEnabled: false,
        },
        {
          id: "s2",
          name: "s2",
          isReadyCurrentTurn: false,
          autoReadyEnabled: true,
        },
        {
          id: "s3",
          name: "s3",
          isReadyCurrentTurn: false,
          autoReadyEnabled: false,
        },
        {
          id: "s4",
          name: "s4",
          isReadyCurrentTurn: false,
          autoReadyEnabled: false,
        },
      ],
    });
    const result = runSimulation(input, "t-readiness-partial");
    expect(result.readinessSummary).toEqual({
      notReadySettlementCount: 2,
      readyPercentage: 50,
      readySettlementCount: 2,
      totalSettlementCount: 4,
    });
  });

  it("treats missing readiness fields as not-ready (undefined → false)", () => {
    const input = makeInput({
      settlements: [makeSettlement("s1"), makeSettlement("s2")],
    });
    const result = runSimulation(input, "t-readiness-missing-fields");
    expect(result.readinessSummary).toEqual({
      notReadySettlementCount: 2,
      readyPercentage: 0,
      readySettlementCount: 0,
      totalSettlementCount: 2,
    });
  });
});

// ---------------------------------------------------------------------------
// assignmentClears: deaths in phase 8 (starvation) and phase 10 (homelessness)
// ---------------------------------------------------------------------------

describe("runSimulation — assignmentClears for citizen deaths", () => {
  it("includes starvation victim in assignmentClears when citizen has a job assignment", () => {
    // 1 NPC assigned to a job, no food → starves; their assignment must be cleared.
    const input = makeInput({
      settlements: [makeSettlement("s1")],
      citizens: [makeNpc("npc-starve", "s1")],
      citizenAssignments: [makeAssignment("npc-starve", "farming")],
      jobs: [
        makeJob("farming", [], [{ resourceId: "grain", amountPerWorker: 1 }]),
      ],
      stockpiles: [makeStockpile("s1", "grain", 0)],
      populationRules: {
        ...BASE_POPULATION_RULES,
        foodConsumptionPerCitizen: 1,
        waterConsumptionPerCitizen: 0,
        starvationSeverityMultiplier: 1,
      },
    });

    const result = runSimulation(input, "t-assignment-clear-starvation");

    expect(result.citizenDeaths.some((d) => d.citizenId === "npc-starve")).toBe(
      true,
    );
    expect(
      result.assignmentClears.some((a) => a.citizenId === "npc-starve"),
    ).toBe(true);
  });

  it("includes homelessness victim in assignmentClears when citizen has a job assignment", () => {
    // 1 NPC assigned to a job, pop cap = 0 → dies of homelessness; assignment must be cleared.
    const input = makeInput({
      settlements: [makeSettlement("s1")],
      citizens: [makeNpc("npc-homeless", "s1")],
      citizenAssignments: [makeAssignment("npc-homeless", "farming")],
      jobs: [makeJob("farming", [], [])],
      stockpiles: [],
      populationRules: {
        ...BASE_POPULATION_RULES,
        homelessnessDecliningRate: 1,
      },
    });

    const result = runSimulation(input, "t-assignment-clear-homelessness");

    expect(
      result.citizenDeaths.some((d) => d.citizenId === "npc-homeless"),
    ).toBe(true);
    expect(
      result.assignmentClears.some((a) => a.citizenId === "npc-homeless"),
    ).toBe(true);
  });

  it("does not emit a duplicate assignmentClear when a citizen dies and has no assignment", () => {
    // NPC with no assignment starves; the resulting assignmentClear for them is fine
    // (the SQL delete is a no-op) but we should not emit more clears than deaths.
    const input = makeInput({
      settlements: [makeSettlement("s1")],
      citizens: [makeNpc("npc-unassigned", "s1")],
      citizenAssignments: [],
      jobs: [],
      stockpiles: [],
      populationRules: {
        ...BASE_POPULATION_RULES,
        foodConsumptionPerCitizen: 1,
        waterConsumptionPerCitizen: 0,
        starvationSeverityMultiplier: 1,
      },
    });

    const result = runSimulation(input, "t-assignment-clear-no-dupe");

    const clearsForCitizen = result.assignmentClears.filter(
      (a) => a.citizenId === "npc-unassigned",
    );
    expect(clearsForCitizen.length).toBe(1);
  });
});
