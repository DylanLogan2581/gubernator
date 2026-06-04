import { describe, expect, it } from "vitest";

import { phaseStandardJobs } from "./phaseStandardJobs.ts";

import type {
  SimCitizen,
  SimCitizenAssignment,
  SimJob,
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

function makeStockpile(
  settlementId: string,
  resourceId: string,
  quantity: number,
): SimStockpile {
  return { cap: 9999, quantity, resourceId, settlementId };
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

describe("phaseStandardJobs", () => {
  it("returns empty output when no assignments exist", () => {
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      jobs: [makeJob("j1", [], [{ resourceId: "wood", amountPerWorker: 2 }])],
    });

    const result = phaseStandardJobs(ctx);

    expect(result.logs).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
  });

  it("happy path: full stock produces full output and consumes inputs", () => {
    const settlement = makeSettlement("s1");
    const citizen = makeCitizen("c1", "s1");
    const job = makeJob(
      "j1",
      [{ resourceId: "grain", amountPerWorker: 2 }],
      [{ resourceId: "flour", amountPerWorker: 3 }],
    );
    const ctx = makeContext({
      settlements: [settlement],
      citizens: [citizen],
      citizenAssignments: [makeAssignment("c1", "j1")],
      jobs: [job],
      stockpiles: [makeStockpile("s1", "grain", 100)],
    });

    const result = phaseStandardJobs(ctx);

    expect(result.logs).toHaveLength(1);
    const log = result.logs[0];
    expect(log.category).toBe("standard_job.processed");
    expect(log.phase).toBe("standardJobs");
    expect(log.payload).toMatchObject({
      jobId: "j1",
      workerCount: 1,
      scale: 1.0,
      inputsConsumed: { grain: 2 },
      outputsProduced: { flour: 3 },
    });

    const grainDelta = result.stockpileDeltas.find(
      (d) => d.resourceId === "grain",
    );
    const flourDelta = result.stockpileDeltas.find(
      (d) => d.resourceId === "flour",
    );
    expect(grainDelta?.delta).toBeCloseTo(-2);
    expect(flourDelta?.delta).toBeCloseTo(3);
  });

  it("shortfall scaling: partial stock reduces output proportionally", () => {
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      citizens: [makeCitizen("c1", "s1"), makeCitizen("c2", "s1")],
      citizenAssignments: [
        makeAssignment("c1", "j1"),
        makeAssignment("c2", "j1"),
      ],
      jobs: [
        makeJob(
          "j1",
          [{ resourceId: "wood", amountPerWorker: 5 }],
          [{ resourceId: "planks", amountPerWorker: 4 }],
        ),
      ],
      // 2 workers × 5 = 10 required; only 6 available → scale = 0.6
      stockpiles: [makeStockpile("s1", "wood", 6)],
    });

    const result = phaseStandardJobs(ctx);

    expect(result.logs).toHaveLength(1);
    const log = result.logs[0];
    expect(log.payload.scale).toBeCloseTo(0.6);
    expect(
      (log.payload.inputsConsumed as Record<string, number>).wood,
    ).toBeCloseTo(6);
    expect(
      (log.payload.outputsProduced as Record<string, number>).planks,
    ).toBeCloseTo(4.8);

    const woodDelta = result.stockpileDeltas.find(
      (d) => d.resourceId === "wood",
    );
    const planksDelta = result.stockpileDeltas.find(
      (d) => d.resourceId === "planks",
    );
    expect(woodDelta?.delta).toBeCloseTo(-6);
    expect(planksDelta?.delta).toBeCloseTo(4.8);
  });

  it("zero workers: job with no assigned workers produces no output", () => {
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      citizens: [],
      citizenAssignments: [],
      jobs: [
        makeJob(
          "j1",
          [{ resourceId: "grain", amountPerWorker: 2 }],
          [{ resourceId: "flour", amountPerWorker: 3 }],
        ),
      ],
      stockpiles: [makeStockpile("s1", "grain", 100)],
    });

    const result = phaseStandardJobs(ctx);

    expect(result.logs).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
  });

  it("zero-input job: no inputs required; outputs produced at full rate", () => {
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      citizens: [makeCitizen("c1", "s1")],
      citizenAssignments: [makeAssignment("c1", "j1")],
      jobs: [makeJob("j1", [], [{ resourceId: "gold", amountPerWorker: 10 }])],
      stockpiles: [],
    });

    const result = phaseStandardJobs(ctx);

    expect(result.logs).toHaveLength(1);
    const log = result.logs[0];
    expect(log.payload.scale).toBe(1.0);
    expect(
      (log.payload.outputsProduced as Record<string, number>).gold,
    ).toBeCloseTo(10);
    expect(result.stockpileDeltas).toHaveLength(1);
    expect(result.stockpileDeltas[0]).toMatchObject({
      delta: 10,
      resourceId: "gold",
      settlementId: "s1",
    });
  });

  describe("multiple jobs sharing a resource", () => {
    it("proportional-shortfall: both jobs scale by the same resource factor", () => {
      // Job A: 1 worker × 3 wood = 3 required
      // Job B: 1 worker × 2 wood = 2 required
      // Total: 5 wood required; available: 4 → scale = 4/5 = 0.8
      const ctx = makeContext({
        settlements: [makeSettlement("s1")],
        citizens: [makeCitizen("c1", "s1"), makeCitizen("c2", "s1")],
        citizenAssignments: [
          makeAssignment("c1", "jA"),
          makeAssignment("c2", "jB"),
        ],
        jobs: [
          makeJob(
            "jA",
            [{ resourceId: "wood", amountPerWorker: 3 }],
            [{ resourceId: "tableA", amountPerWorker: 1 }],
          ),
          makeJob(
            "jB",
            [{ resourceId: "wood", amountPerWorker: 2 }],
            [{ resourceId: "tableB", amountPerWorker: 1 }],
          ),
        ],
        stockpiles: [makeStockpile("s1", "wood", 4)],
      });

      const result = phaseStandardJobs(ctx);

      expect(result.logs).toHaveLength(2);
      const logA = result.logs.find((l) => l.payload.jobId === "jA");
      const logB = result.logs.find((l) => l.payload.jobId === "jB");

      expect(logA?.payload.scale).toBeCloseTo(0.8);
      expect(logB?.payload.scale).toBeCloseTo(0.8);

      const tableADelta = result.stockpileDeltas.find(
        (d) => d.resourceId === "tableA",
      );
      const tableBDelta = result.stockpileDeltas.find(
        (d) => d.resourceId === "tableB",
      );
      expect(tableADelta?.delta).toBeCloseTo(0.8);
      expect(tableBDelta?.delta).toBeCloseTo(0.8);

      // Total wood consumed = 0.8 × 3 + 0.8 × 2 = 2.4 + 1.6 = 4.0
      const woodDeltas = result.stockpileDeltas.filter(
        (d) => d.resourceId === "wood",
      );
      const totalWoodConsumed = woodDeltas.reduce(
        (sum, d) => sum + Math.abs(d.delta),
        0,
      );
      expect(totalWoodConsumed).toBeCloseTo(4.0);
    });

    it("zero-stock resource: all sharing jobs scale to zero output", () => {
      const ctx = makeContext({
        settlements: [makeSettlement("s1")],
        citizens: [makeCitizen("c1", "s1"), makeCitizen("c2", "s1")],
        citizenAssignments: [
          makeAssignment("c1", "jA"),
          makeAssignment("c2", "jB"),
        ],
        jobs: [
          makeJob(
            "jA",
            [{ resourceId: "coal", amountPerWorker: 5 }],
            [{ resourceId: "steel", amountPerWorker: 2 }],
          ),
          makeJob(
            "jB",
            [{ resourceId: "coal", amountPerWorker: 3 }],
            [{ resourceId: "iron", amountPerWorker: 1 }],
          ),
        ],
        stockpiles: [makeStockpile("s1", "coal", 0)],
      });

      const result = phaseStandardJobs(ctx);

      expect(result.logs).toHaveLength(2);
      for (const log of result.logs) {
        expect(log.payload.scale).toBe(0);
      }
      // Only zero-delta entries are emitted; no positive output deltas
      const positiveDeltas = result.stockpileDeltas.filter((d) => d.delta > 0);
      expect(positiveDeltas).toHaveLength(0);
    });
  });

  it("multiple workers for same job multiply base consumption and output", () => {
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      citizens: [
        makeCitizen("c1", "s1"),
        makeCitizen("c2", "s1"),
        makeCitizen("c3", "s1"),
      ],
      citizenAssignments: [
        makeAssignment("c1", "j1"),
        makeAssignment("c2", "j1"),
        makeAssignment("c3", "j1"),
      ],
      jobs: [
        makeJob(
          "j1",
          [{ resourceId: "ore", amountPerWorker: 2 }],
          [{ resourceId: "metal", amountPerWorker: 1 }],
        ),
      ],
      // 3 workers × 2 = 6 required; 12 available → scale = 1.0
      stockpiles: [makeStockpile("s1", "ore", 12)],
    });

    const result = phaseStandardJobs(ctx);

    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].payload.workerCount).toBe(3);
    expect(result.logs[0].payload.scale).toBe(1.0);

    const oreDelta = result.stockpileDeltas.find((d) => d.resourceId === "ore");
    const metalDelta = result.stockpileDeltas.find(
      (d) => d.resourceId === "metal",
    );
    expect(oreDelta?.delta).toBeCloseTo(-6);
    expect(metalDelta?.delta).toBeCloseTo(3);
  });

  it("only processes standard jobType assignments; ignores other types", () => {
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      citizens: [makeCitizen("c1", "s1")],
      citizenAssignments: [
        {
          assignedOnTurnNumber: 1,
          assignmentType: "deposit", // not standard_job
          citizenId: "c1",
          constructionProjectId: null,
          depositInstanceId: "dep1",
          jobId: "j1",
          managedPopulationInstanceId: null,
          tradeRouteEnd: null,
          tradeRouteId: null,
        },
      ],
      jobs: [makeJob("j1", [], [{ resourceId: "gold", amountPerWorker: 5 }])],
    });

    const result = phaseStandardJobs(ctx);

    expect(result.logs).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
  });
});
