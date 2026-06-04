import { describe, expect, it } from "vitest";

import { phaseConstruction } from "./phaseConstruction.ts";

import type {
  SimBuildingTier,
  SimCitizen,
  SimCitizenAssignment,
  SimConstructionProject,
  SimSettlement,
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

function makeSettlement(id: string): SimSettlement {
  return { id, name: id };
}

function makeCitizen(id: string, settlementId: string): SimCitizen {
  return {
    bornOnTurnNumber: null,
    citizenType: "npc",
    id,
    name: id,
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId,
    sex: null,
    status: "alive",
  };
}

function makeConstructionAssignment(
  citizenId: string,
  constructionProjectId: string | null = null,
): SimCitizenAssignment {
  return {
    assignedOnTurnNumber: 1,
    assignmentType: "construction_project",
    citizenId,
    constructionProjectId,
    depositInstanceId: null,
    jobId: null,
    managedPopulationInstanceId: null,
    tradeRouteEnd: null,
    tradeRouteId: null,
  };
}

function makeTier(
  id: string,
  blueprintId: string,
  workerTurnsRequired: number,
  costs: { resourceId: string; amount: number }[] = [],
): SimBuildingTier {
  return {
    buildingBlueprintId: blueprintId,
    constructionCostsJson: costs,
    effectsJson: [],
    id,
    tierNumber: 1,
    upkeepCostsJson: [],
    workerTurnsRequired,
  };
}

function makeProject(
  id: string,
  settlementId: string,
  targetTierId: string,
  blueprintId: string,
  opts: {
    queuePosition?: number;
    progressWorkerTurns?: number;
    workerTurnsRequired?: number;
    status?: SimConstructionProject["status"];
  } = {},
): SimConstructionProject {
  return {
    buildingBlueprintId: blueprintId,
    id,
    progressWorkerTurns: opts.progressWorkerTurns ?? 0,
    queuePosition: opts.queuePosition ?? 1,
    settlementId,
    status: opts.status ?? "queued",
    targetTierId,
    workerTurnsRequired: opts.workerTurnsRequired ?? 5,
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
    shared: { pendingPopCapBySettlement: new Map(), pendingStockpiles },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseConstruction", () => {
  it("returns empty output when no construction assignments exist", () => {
    const tier = makeTier("t1", "bp1", 3);
    const project = makeProject("p1", "s1", "t1", "bp1");
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      buildingTiers: [tier],
      constructionProjects: [project],
      citizenAssignments: [],
    });

    const result = phaseConstruction(ctx);

    expect(result.logs).toHaveLength(0);
    expect(result.constructionUpdates).toHaveLength(0);
    expect(result.buildingsCreated).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("single project completes in one turn when pool >= workerTurnsRequired", () => {
    // Pool = 3, workerTurnsRequired = 3, progress = 0 → completes in 1 turn
    const tier = makeTier("t1", "bp1", 3, [{ resourceId: "wood", amount: 2 }]);
    const project = makeProject("p1", "s1", "t1", "bp1", {
      workerTurnsRequired: 3,
      progressWorkerTurns: 0,
      queuePosition: 1,
    });
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      buildingTiers: [tier],
      constructionProjects: [project],
      citizens: [
        makeCitizen("c1", "s1"),
        makeCitizen("c2", "s1"),
        makeCitizen("c3", "s1"),
      ],
      citizenAssignments: [
        makeConstructionAssignment("c1", "p1"),
        makeConstructionAssignment("c2", "p1"),
        makeConstructionAssignment("c3", "p1"),
      ],
      stockpiles: [makeStockpile("s1", "wood", 100)],
    });

    const result = phaseConstruction(ctx);

    expect(result.constructionUpdates).toHaveLength(1);
    const update = result.constructionUpdates[0];
    expect(update?.projectId).toBe("p1");
    expect(update?.progressWorkerTurnsDelta).toBe(3);
    expect(update?.toStatus).toBe("complete");

    expect(result.buildingsCreated).toHaveLength(1);
    expect(result.buildingsCreated[0]?.buildingBlueprintId).toBe("bp1");
    expect(result.buildingsCreated[0]?.tierId).toBe("t1");
    expect(result.buildingsCreated[0]?.settlementId).toBe("s1");

    // Costs deducted: 3 workers × 2 wood = 6
    const woodDelta = result.stockpileDeltas.find(
      (d) => d.resourceId === "wood",
    );
    expect(woodDelta?.delta).toBeCloseTo(-6);

    const completedLog = result.logs.find(
      (l) => l.category === "construction.completed",
    );
    expect(completedLog).toBeDefined();
    expect(completedLog?.phase).toBe("construction");
    expect(completedLog?.payload.projectId).toBe("p1");
    expect(completedLog?.payload.workers).toBe(3);

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.notificationType).toBe(
      "construction.completed",
    );
  });

  it("queue with three projects, pool of 2 fills only the first", () => {
    // Pool = 2; three projects in queue; only project 1 gets workers
    const tier = makeTier("t1", "bp1", 10);
    const p1 = makeProject("p1", "s1", "t1", "bp1", { queuePosition: 1 });
    const p2 = makeProject("p2", "s1", "t1", "bp1", { queuePosition: 2 });
    const p3 = makeProject("p3", "s1", "t1", "bp1", { queuePosition: 3 });
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      buildingTiers: [tier],
      constructionProjects: [p1, p2, p3],
      citizens: [makeCitizen("c1", "s1"), makeCitizen("c2", "s1")],
      citizenAssignments: [
        makeConstructionAssignment("c1"),
        makeConstructionAssignment("c2"),
      ],
    });

    const result = phaseConstruction(ctx);

    // Only project 1 gets an update
    expect(result.constructionUpdates).toHaveLength(1);
    expect(result.constructionUpdates[0]?.projectId).toBe("p1");
    expect(result.constructionUpdates[0]?.progressWorkerTurnsDelta).toBe(2);
    // Project was queued → now in_progress
    expect(result.constructionUpdates[0]?.toStatus).toBe("in_progress");

    // Projects 2 and 3 are untouched (no updates emitted)
    expect(
      result.constructionUpdates.find((u) => u.projectId === "p2"),
    ).toBeUndefined();
    expect(
      result.constructionUpdates.find((u) => u.projectId === "p3"),
    ).toBeUndefined();

    // Progress log for project 1
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]?.category).toBe("construction.progress");

    expect(result.buildingsCreated).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("project pauses on resource shortfall", () => {
    // Project requires 5 wood per worker; pool = 2 → needs 10; only 5 available
    const tier = makeTier("t1", "bp1", 5, [{ resourceId: "wood", amount: 5 }]);
    const project = makeProject("p1", "s1", "t1", "bp1");
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      buildingTiers: [tier],
      constructionProjects: [project],
      citizens: [makeCitizen("c1", "s1"), makeCitizen("c2", "s1")],
      citizenAssignments: [
        makeConstructionAssignment("c1"),
        makeConstructionAssignment("c2"),
      ],
      stockpiles: [makeStockpile("s1", "wood", 5)],
    });

    const result = phaseConstruction(ctx);

    expect(result.constructionUpdates).toHaveLength(1);
    const update = result.constructionUpdates[0];
    expect(update?.toStatus).toBe("paused");
    expect(update?.progressWorkerTurnsDelta).toBe(0);

    // No stockpile changes when paused
    expect(result.stockpileDeltas).toHaveLength(0);

    expect(result.buildingsCreated).toHaveLength(0);

    const pausedLog = result.logs.find(
      (l) => l.category === "construction.paused",
    );
    expect(pausedLog).toBeDefined();
    expect(pausedLog?.phase).toBe("construction");

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.notificationType).toBe(
      "construction.paused",
    );
  });

  it("completed building does not appear in input state (no upkeep or effects this transition)", () => {
    // The simulation phase only appends to buildingsCreated — it never modifies
    // settlementBuildings. Upkeep/effects phases read from settlementBuildings (input),
    // so the newly created building is invisible to them this transition.
    const tier = makeTier("t1", "bp1", 1);
    const project = makeProject("p1", "s1", "t1", "bp1", {
      workerTurnsRequired: 1,
    });
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      buildingTiers: [tier],
      constructionProjects: [project],
      citizens: [makeCitizen("c1", "s1")],
      citizenAssignments: [makeConstructionAssignment("c1")],
      settlementBuildings: [], // no pre-existing buildings
    });

    const result = phaseConstruction(ctx);

    expect(result.buildingsCreated).toHaveLength(1);
    // The input settlementBuildings is unchanged — phaseConstruction has no
    // buildingStateChanges output, confirming the new building is inactive this turn.
    expect(result.constructionUpdates[0]?.toStatus).toBe("complete");
    expect("buildingStateChanges" in result).toBe(false);
  });

  describe("property: pool conservation", () => {
    it("workers allocated + remaining pool == initial pool", () => {
      // Pool = 5; project needs 3 worker-turns. All 5 workers go to project, pool → 0.
      const tier = makeTier("t1", "bp1", 3);
      const project = makeProject("p1", "s1", "t1", "bp1", {
        workerTurnsRequired: 3,
      });
      const ctx = makeContext({
        settlements: [makeSettlement("s1")],
        buildingTiers: [tier],
        constructionProjects: [project],
        citizens: [
          makeCitizen("c1", "s1"),
          makeCitizen("c2", "s1"),
          makeCitizen("c3", "s1"),
          makeCitizen("c4", "s1"),
          makeCitizen("c5", "s1"),
        ],
        citizenAssignments: [
          makeConstructionAssignment("c1"),
          makeConstructionAssignment("c2"),
          makeConstructionAssignment("c3"),
          makeConstructionAssignment("c4"),
          makeConstructionAssignment("c5"),
        ],
      });

      const result = phaseConstruction(ctx);

      const initialPool = 5;
      const workersAllocated = result.constructionUpdates.reduce(
        (sum, u) => sum + u.progressWorkerTurnsDelta,
        0,
      );
      // Paused projects allocate 0; progress updates allocate workers.
      // Pool is fully consumed by the single project.
      expect(workersAllocated).toBe(initialPool);
    });

    it("pool is preserved across paused projects", () => {
      // Project 1: can't pay (0 wood available) → paused, pool unchanged (3)
      // Project 2: no costs → gets all 3 workers
      const tier1 = makeTier("t1", "bp1", 5, [
        { resourceId: "wood", amount: 10 },
      ]);
      const tier2 = makeTier("t2", "bp2", 5); // no costs
      const p1 = makeProject("p1", "s1", "t1", "bp1", { queuePosition: 1 });
      const p2 = makeProject("p2", "s1", "t2", "bp2", { queuePosition: 2 });
      const ctx = makeContext({
        settlements: [makeSettlement("s1")],
        buildingTiers: [tier1, tier2],
        constructionProjects: [p1, p2],
        citizens: [
          makeCitizen("c1", "s1"),
          makeCitizen("c2", "s1"),
          makeCitizen("c3", "s1"),
        ],
        citizenAssignments: [
          makeConstructionAssignment("c1"),
          makeConstructionAssignment("c2"),
          makeConstructionAssignment("c3"),
        ],
        stockpiles: [makeStockpile("s1", "wood", 0)],
      });

      const result = phaseConstruction(ctx);

      const p1Update = result.constructionUpdates.find(
        (u) => u.projectId === "p1",
      );
      const p2Update = result.constructionUpdates.find(
        (u) => u.projectId === "p2",
      );

      expect(p1Update?.toStatus).toBe("paused");
      expect(p1Update?.progressWorkerTurnsDelta).toBe(0);

      // All 3 pool workers reach project 2
      expect(p2Update?.progressWorkerTurnsDelta).toBe(3);

      const initialPool = 3;
      const workersAllocated = result.constructionUpdates.reduce(
        (sum, u) => sum + u.progressWorkerTurnsDelta,
        0,
      );
      expect(workersAllocated).toBe(initialPool);
    });
  });

  it("queued project transitions to in_progress when it receives workers but does not complete", () => {
    const tier = makeTier("t1", "bp1", 10);
    const project = makeProject("p1", "s1", "t1", "bp1", {
      status: "queued",
      workerTurnsRequired: 10,
      progressWorkerTurns: 0,
    });
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      buildingTiers: [tier],
      constructionProjects: [project],
      citizens: [makeCitizen("c1", "s1")],
      citizenAssignments: [makeConstructionAssignment("c1")],
    });

    const result = phaseConstruction(ctx);

    expect(result.constructionUpdates[0]?.toStatus).toBe("in_progress");
  });

  it("in_progress project emits null toStatus when it continues without completing", () => {
    const tier = makeTier("t1", "bp1", 10);
    const project = makeProject("p1", "s1", "t1", "bp1", {
      status: "in_progress",
      workerTurnsRequired: 10,
      progressWorkerTurns: 5,
    });
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      buildingTiers: [tier],
      constructionProjects: [project],
      citizens: [makeCitizen("c1", "s1")],
      citizenAssignments: [makeConstructionAssignment("c1")],
    });

    const result = phaseConstruction(ctx);

    expect(result.constructionUpdates[0]?.toStatus).toBeNull();
    expect(result.constructionUpdates[0]?.progressWorkerTurnsDelta).toBe(1);
  });

  it("zero-cost project completes even with empty stockpile", () => {
    const tier = makeTier("t1", "bp1", 2); // no costs
    const project = makeProject("p1", "s1", "t1", "bp1", {
      workerTurnsRequired: 2,
    });
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      buildingTiers: [tier],
      constructionProjects: [project],
      citizens: [makeCitizen("c1", "s1"), makeCitizen("c2", "s1")],
      citizenAssignments: [
        makeConstructionAssignment("c1"),
        makeConstructionAssignment("c2"),
      ],
      stockpiles: [],
    });

    const result = phaseConstruction(ctx);

    expect(result.constructionUpdates[0]?.toStatus).toBe("complete");
    expect(result.buildingsCreated).toHaveLength(1);
    expect(result.stockpileDeltas).toHaveLength(0);
  });

  it("cancelled and complete projects are skipped", () => {
    const tier = makeTier("t1", "bp1", 3);
    const cancelled = makeProject("p1", "s1", "t1", "bp1", {
      status: "cancelled",
    });
    const complete = makeProject("p2", "s1", "t1", "bp1", {
      status: "complete",
    });
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      buildingTiers: [tier],
      constructionProjects: [cancelled, complete],
      citizens: [makeCitizen("c1", "s1")],
      citizenAssignments: [makeConstructionAssignment("c1")],
    });

    const result = phaseConstruction(ctx);

    expect(result.constructionUpdates).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
  });

  it("idle pool members with null constructionProjectId still count toward pool size", () => {
    // Per §11.2: idle pool members keep assignment with constructionProjectId=null
    const tier = makeTier("t1", "bp1", 1);
    const project = makeProject("p1", "s1", "t1", "bp1", {
      workerTurnsRequired: 1,
    });
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      buildingTiers: [tier],
      constructionProjects: [project],
      citizens: [makeCitizen("c1", "s1")],
      citizenAssignments: [
        makeConstructionAssignment("c1", null), // null project ID
      ],
    });

    const result = phaseConstruction(ctx);

    // The worker is counted in the pool despite null constructionProjectId
    expect(result.constructionUpdates[0]?.progressWorkerTurnsDelta).toBe(1);
    expect(result.constructionUpdates[0]?.toStatus).toBe("complete");
  });
});
