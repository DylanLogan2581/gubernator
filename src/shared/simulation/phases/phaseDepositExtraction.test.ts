import { describe, expect, it } from "vitest";

import { phaseDepositExtraction } from "./phaseDepositExtraction.ts";

import type {
  SimCitizen,
  SimCitizenAssignment,
  SimDeposit,
  SimDepositResource,
  SimDepositType,
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

function makeDepositAssignment(
  citizenId: string,
  depositInstanceId: string,
): SimCitizenAssignment {
  return {
    assignedOnTurnNumber: 1,
    assignmentType: "deposit",
    citizenId,
    constructionProjectId: null,
    depositInstanceId,
    jobId: null,
    managedPopulationInstanceId: null,
    tradeRouteEnd: null,
    tradeRouteId: null,
  };
}

function makeDepositType(
  id: string,
  outputUnitsPerWorker: number,
  workerInputs: { resourceId: string; amountPerWorker: number }[] = [],
): SimDepositType {
  return {
    id,
    jobId: `job-${id}`,
    name: id,
    outputUnitsPerWorker,
    workerInputsJson: workerInputs,
  };
}

function makeDeposit(
  id: string,
  depositTypeId: string,
  settlementId: string,
  resources: SimDepositResource[],
  maxWorkers: number | null = null,
): SimDeposit {
  return {
    depositTypeId,
    id,
    maxWorkers,
    name: id,
    resources,
    settlementId,
    status: "active",
  };
}

function makeDepositResource(
  id: string,
  depositInstanceId: string,
  resourceId: string,
  remainingQuantity: number,
): SimDepositResource {
  return { depositInstanceId, id, remainingQuantity, resourceId };
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
    tradeRoutes: [],
    turnNumber: 1,
    worldId: "w1",
    ...overrides,
  };
  return { input };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseDepositExtraction", () => {
  it("returns empty output when no active deposits exist", () => {
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      deposits: [],
      depositTypes: [],
    });

    const result = phaseDepositExtraction(ctx);

    expect(result.logs).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.depositUpdates).toHaveLength(0);
    expect(result.assignmentClears).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("happy path: workers extract fully from a single-resource deposit", () => {
    // 2 workers × 5 output/worker × scale 1.0 = 10 extracted
    const depositType = makeDepositType("dt1", 5);
    const deposit = makeDeposit("dep1", "dt1", "s1", [
      makeDepositResource("dr1", "dep1", "iron", 100),
    ]);
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      citizens: [makeCitizen("c1", "s1"), makeCitizen("c2", "s1")],
      citizenAssignments: [
        makeDepositAssignment("c1", "dep1"),
        makeDepositAssignment("c2", "dep1"),
      ],
      depositTypes: [depositType],
      deposits: [deposit],
      stockpiles: [makeStockpile("s1", "iron", 0)],
    });

    const result = phaseDepositExtraction(ctx);

    expect(result.logs).toHaveLength(1);
    const log = result.logs[0];
    expect(log?.category).toBe("deposit.processed");
    expect(log?.phase).toBe("depositExtraction");
    expect(log?.payload.workers).toBe(2);
    expect(log?.payload.inputShortfallScale).toBe(1.0);
    expect(log?.payload.totalExtraction).toBeCloseTo(10);
    expect(
      (log?.payload.extractedByResource as Record<string, number>).iron,
    ).toBeCloseTo(10);

    const ironDelta = result.stockpileDeltas.find(
      (d) => d.resourceId === "iron",
    );
    expect(ironDelta?.delta).toBeCloseTo(10);

    expect(result.depositUpdates).toHaveLength(1);
    expect(result.depositUpdates[0]?.depositInstanceId).toBe("dep1");
    expect(result.depositUpdates[0]?.toStatus).toBeNull();

    expect(result.assignmentClears).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("multi-resource weighted split: extraction distributed by remaining_quantity", () => {
    // Deposit: iron=75, coal=25 → weights 75:25; total = 2 × 10 = 20
    // iron share = 20 × 75/100 = 15; coal share = 20 × 25/100 = 5
    const depositType = makeDepositType("dt1", 10);
    const deposit = makeDeposit("dep1", "dt1", "s1", [
      makeDepositResource("dr1", "dep1", "iron", 75),
      makeDepositResource("dr2", "dep1", "coal", 25),
    ]);
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      citizens: [makeCitizen("c1", "s1"), makeCitizen("c2", "s1")],
      citizenAssignments: [
        makeDepositAssignment("c1", "dep1"),
        makeDepositAssignment("c2", "dep1"),
      ],
      depositTypes: [depositType],
      deposits: [deposit],
      stockpiles: [
        makeStockpile("s1", "iron", 0),
        makeStockpile("s1", "coal", 0),
      ],
    });

    const result = phaseDepositExtraction(ctx);

    expect(result.logs).toHaveLength(1);
    const extracted = result.logs[0]?.payload.extractedByResource as Record<
      string,
      number
    >;
    expect(extracted.iron).toBeCloseTo(15);
    expect(extracted.coal).toBeCloseTo(5);

    const ironDelta = result.stockpileDeltas.find(
      (d) => d.resourceId === "iron",
    );
    const coalDelta = result.stockpileDeltas.find(
      (d) => d.resourceId === "coal",
    );
    expect(ironDelta?.delta).toBeCloseTo(15);
    expect(coalDelta?.delta).toBeCloseTo(5);
  });

  it("full input satisfaction: scale = 1.0 when stockpile covers all worker inputs", () => {
    // 2 workers × 3 fuel = 6 required; 10 available → scale = 1.0
    const depositType = makeDepositType("dt1", 5, [
      { resourceId: "fuel", amountPerWorker: 3 },
    ]);
    const deposit = makeDeposit("dep1", "dt1", "s1", [
      makeDepositResource("dr1", "dep1", "iron", 100),
    ]);
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      citizens: [makeCitizen("c1", "s1"), makeCitizen("c2", "s1")],
      citizenAssignments: [
        makeDepositAssignment("c1", "dep1"),
        makeDepositAssignment("c2", "dep1"),
      ],
      depositTypes: [depositType],
      deposits: [deposit],
      stockpiles: [
        makeStockpile("s1", "fuel", 10),
        makeStockpile("s1", "iron", 0),
      ],
    });

    const result = phaseDepositExtraction(ctx);

    expect(result.logs[0]?.payload.inputShortfallScale).toBe(1.0);
    expect(result.logs[0]?.payload.totalExtraction).toBeCloseTo(10);

    const fuelDelta = result.stockpileDeltas.find(
      (d) => d.resourceId === "fuel",
    );
    expect(fuelDelta?.delta).toBeCloseTo(-6);
  });

  it("partial input shortfall: extraction scales proportionally to available inputs", () => {
    // 2 workers × 3 fuel = 6 required; only 3 available → scale = 0.5
    // Total extraction = 2 × 5 × 0.5 = 5; fuel consumed = 0.5 × 6 = 3
    const depositType = makeDepositType("dt1", 5, [
      { resourceId: "fuel", amountPerWorker: 3 },
    ]);
    const deposit = makeDeposit("dep1", "dt1", "s1", [
      makeDepositResource("dr1", "dep1", "iron", 100),
    ]);
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      citizens: [makeCitizen("c1", "s1"), makeCitizen("c2", "s1")],
      citizenAssignments: [
        makeDepositAssignment("c1", "dep1"),
        makeDepositAssignment("c2", "dep1"),
      ],
      depositTypes: [depositType],
      deposits: [deposit],
      stockpiles: [
        makeStockpile("s1", "fuel", 3),
        makeStockpile("s1", "iron", 0),
      ],
    });

    const result = phaseDepositExtraction(ctx);

    expect(result.logs[0]?.payload.inputShortfallScale).toBeCloseTo(0.5);
    expect(result.logs[0]?.payload.totalExtraction).toBeCloseTo(5);
    expect(
      (result.logs[0]?.payload.extractedByResource as Record<string, number>)
        .iron,
    ).toBeCloseTo(5);

    const fuelDelta = result.stockpileDeltas.find(
      (d) => d.resourceId === "fuel",
    );
    expect(fuelDelta?.delta).toBeCloseTo(-3);
  });

  it("stockpile cap throttle: overflow stays in deposit when stockpile is nearly full", () => {
    // 2 workers × 5 = 10 total; stockpile cap=3, qty=2 → space=1; only 1 extracted
    const depositType = makeDepositType("dt1", 5);
    const deposit = makeDeposit("dep1", "dt1", "s1", [
      makeDepositResource("dr1", "dep1", "iron", 100),
    ]);
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      citizens: [makeCitizen("c1", "s1"), makeCitizen("c2", "s1")],
      citizenAssignments: [
        makeDepositAssignment("c1", "dep1"),
        makeDepositAssignment("c2", "dep1"),
      ],
      depositTypes: [depositType],
      deposits: [deposit],
      stockpiles: [makeStockpile("s1", "iron", 2, 3)],
    });

    const result = phaseDepositExtraction(ctx);

    const ironDelta = result.stockpileDeltas.find(
      (d) => d.resourceId === "iron",
    );
    expect(ironDelta?.delta).toBeCloseTo(1);

    // Deposit not depleted (99 remaining)
    expect(result.depositUpdates[0]?.toStatus).toBeNull();
    expect(result.assignmentClears).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  describe("depletion", () => {
    it("marks deposit depleted and unassigns all workers when all resources reach zero", () => {
      // 2 workers × 5 = 10 total; only 8 remaining → extracts 8 and depletes
      const depositType = makeDepositType("dt1", 5);
      const deposit = makeDeposit("dep1", "dt1", "s1", [
        makeDepositResource("dr1", "dep1", "iron", 8),
      ]);
      const ctx = makeContext({
        settlements: [makeSettlement("s1")],
        citizens: [makeCitizen("c1", "s1"), makeCitizen("c2", "s1")],
        citizenAssignments: [
          makeDepositAssignment("c1", "dep1"),
          makeDepositAssignment("c2", "dep1"),
        ],
        depositTypes: [depositType],
        deposits: [deposit],
        stockpiles: [makeStockpile("s1", "iron", 0)],
      });

      const result = phaseDepositExtraction(ctx);

      expect(result.depositUpdates[0]?.toStatus).toBe("depleted");

      expect(result.assignmentClears).toHaveLength(2);
      const unassigned = result.assignmentClears.map((a) => a.citizenId);
      expect(unassigned).toContain("c1");
      expect(unassigned).toContain("c2");

      const depletedLog = result.logs.find(
        (l) => l.category === "deposit.depleted",
      );
      expect(depletedLog).toBeDefined();
      expect(depletedLog?.payload.depositId).toBe("dep1");

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.notificationType).toBe(
        "simulation.deposit.depleted",
      );

      const extracted = result.logs.find(
        (l) => l.category === "deposit.processed",
      )?.payload.extractedByResource as Record<string, number>;
      expect(extracted.iron).toBeCloseTo(8);
    });

    it("multi-resource deposit: depletes only when all resources reach zero", () => {
      // iron=5, coal=5; 1 worker × 5 = 5 total → iron gets 2.5, coal gets 2.5; none reach 0
      const depositType = makeDepositType("dt1", 5);
      const deposit = makeDeposit("dep1", "dt1", "s1", [
        makeDepositResource("dr1", "dep1", "iron", 5),
        makeDepositResource("dr2", "dep1", "coal", 5),
      ]);
      const ctx = makeContext({
        settlements: [makeSettlement("s1")],
        citizens: [makeCitizen("c1", "s1")],
        citizenAssignments: [makeDepositAssignment("c1", "dep1")],
        depositTypes: [depositType],
        deposits: [deposit],
        stockpiles: [
          makeStockpile("s1", "iron", 0),
          makeStockpile("s1", "coal", 0),
        ],
      });

      const result = phaseDepositExtraction(ctx);

      expect(result.depositUpdates[0]?.toStatus).toBeNull();
      expect(result.assignmentClears).toHaveLength(0);
      expect(result.notifications).toHaveLength(0);
    });
  });

  it("maxWorkers cap: excess assignments beyond maxWorkers do not increase extraction", () => {
    // 5 workers assigned but maxWorkers=2 → only 2 count; 2 × 5 = 10 extracted
    const depositType = makeDepositType("dt1", 5);
    const deposit = makeDeposit(
      "dep1",
      "dt1",
      "s1",
      [makeDepositResource("dr1", "dep1", "iron", 100)],
      2,
    );
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      citizens: [
        makeCitizen("c1", "s1"),
        makeCitizen("c2", "s1"),
        makeCitizen("c3", "s1"),
        makeCitizen("c4", "s1"),
        makeCitizen("c5", "s1"),
      ],
      citizenAssignments: [
        makeDepositAssignment("c1", "dep1"),
        makeDepositAssignment("c2", "dep1"),
        makeDepositAssignment("c3", "dep1"),
        makeDepositAssignment("c4", "dep1"),
        makeDepositAssignment("c5", "dep1"),
      ],
      depositTypes: [depositType],
      deposits: [deposit],
      stockpiles: [makeStockpile("s1", "iron", 0)],
    });

    const result = phaseDepositExtraction(ctx);

    expect(result.logs[0]?.payload.workers).toBe(2);
    expect(result.logs[0]?.payload.totalExtraction).toBeCloseTo(10);
  });

  it("skips deposits that are not active", () => {
    const depositType = makeDepositType("dt1", 5);
    const active = makeDeposit("dep1", "dt1", "s1", [
      makeDepositResource("dr1", "dep1", "iron", 100),
    ]);
    const depleted = {
      ...makeDeposit("dep2", "dt1", "s1", []),
      status: "depleted" as const,
    };
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      citizens: [makeCitizen("c1", "s1")],
      citizenAssignments: [makeDepositAssignment("c1", "dep2")],
      depositTypes: [depositType],
      deposits: [active, depleted],
      stockpiles: [makeStockpile("s1", "iron", 0)],
    });

    const result = phaseDepositExtraction(ctx);

    // dep1 has no workers, dep2 is depleted → no output
    expect(result.logs).toHaveLength(0);
    expect(result.depositUpdates).toHaveLength(0);
  });

  it("property: total extracted ≤ workers × outputUnitsPerWorker × inputShortfallScale", () => {
    // 3 workers × 4 output/worker = 12; iron space=4, copper space=3 → extracted = 7
    const depositType = makeDepositType("dt1", 4);
    const deposit = makeDeposit("dep1", "dt1", "s1", [
      makeDepositResource("dr1", "dep1", "iron", 50),
      makeDepositResource("dr2", "dep1", "copper", 50),
    ]);
    const ctx = makeContext({
      settlements: [makeSettlement("s1")],
      citizens: [
        makeCitizen("c1", "s1"),
        makeCitizen("c2", "s1"),
        makeCitizen("c3", "s1"),
      ],
      citizenAssignments: [
        makeDepositAssignment("c1", "dep1"),
        makeDepositAssignment("c2", "dep1"),
        makeDepositAssignment("c3", "dep1"),
      ],
      depositTypes: [depositType],
      deposits: [deposit],
      stockpiles: [
        makeStockpile("s1", "iron", 0, 4),
        makeStockpile("s1", "copper", 0, 3),
      ],
    });

    const result = phaseDepositExtraction(ctx);

    const log = result.logs.find((l) => l.category === "deposit.processed");
    const workers = log?.payload.workers as number;
    const scale = log?.payload.inputShortfallScale as number;
    const theoreticalMax = workers * 4 * scale; // 12

    const totalExtracted = Object.values(
      (log?.payload.extractedByResource as Record<string, number>) ?? {},
    ).reduce((sum, v) => sum + v, 0);

    // Throttled by stockpile cap: 4 + 3 = 7
    expect(totalExtracted).toBeCloseTo(7);
    expect(totalExtracted).toBeLessThanOrEqual(theoreticalMax + 1e-9);
  });
});
