import { describe, expect, it } from "vitest";

import { phaseManagedPopulations } from "./phaseManagedPopulations.ts";

import type {
  SimCitizenAssignment,
  SimManagedPopulation,
  SimManagedPopulationType,
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

function makePopType(
  overrides: Partial<SimManagedPopulationType> & {
    id: string;
    husbandryJobId: string;
    cullingJobId: string;
  },
): SimManagedPopulationType {
  return {
    cullingOutputsJson: [],
    growthRate: 0.1,
    husbandryWorkersPerNAnimals: 1,
    maintenanceRulesJson: [],
    name: overrides.id,
    ...overrides,
  };
}

function makePop(
  overrides: Partial<SimManagedPopulation> & {
    id: string;
    managedPopulationTypeId: string;
    settlementId: string;
    currentCount: number;
  },
): SimManagedPopulation {
  return {
    configuredCullQuantity: 0,
    name: overrides.id,
    status: "active",
    ...overrides,
  };
}

function makeStockpile(
  settlementId: string,
  resourceId: string,
  quantity: number,
  cap = 99999,
): SimStockpile {
  return { cap, quantity, resourceId, settlementId };
}

function makeHusbandryAssignment(
  citizenId: string,
  managedPopulationInstanceId: string,
): SimCitizenAssignment {
  return {
    assignedOnTurnNumber: 1,
    assignmentType: "husbandry",
    citizenId,
    constructionProjectId: null,
    depositInstanceId: null,
    jobId: null,
    managedPopulationInstanceId,
    tradeRouteEnd: null,
    tradeRouteId: null,
  };
}

function makeCullingAssignment(
  citizenId: string,
  managedPopulationInstanceId: string,
): SimCitizenAssignment {
  return {
    assignedOnTurnNumber: 1,
    assignmentType: "culling",
    citizenId,
    constructionProjectId: null,
    depositInstanceId: null,
    jobId: null,
    managedPopulationInstanceId,
    tradeRouteEnd: null,
    tradeRouteId: null,
  };
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

describe("phaseManagedPopulations", () => {
  it("returns empty output when no managed populations exist", () => {
    const ctx = makeContext({});
    const result = phaseManagedPopulations(ctx);
    expect(result.logs).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.managedPopulationUpdates).toHaveLength(0);
    expect(result.assignmentClears).toHaveLength(0);
  });

  it("skips populations that are already extinct", () => {
    const type = makePopType({
      id: "t1",
      husbandryJobId: "hj1",
      cullingJobId: "cj1",
      growthRate: 0.1,
    });
    const pop = makePop({
      id: "p1",
      managedPopulationTypeId: "t1",
      settlementId: "s1",
      currentCount: 50,
      status: "extinct",
    });
    const ctx = makeContext({
      managedPopulationTypes: [type],
      managedPopulations: [pop],
    });
    const result = phaseManagedPopulations(ctx);
    expect(result.managedPopulationUpdates).toHaveLength(0);
  });

  describe("healthy growth", () => {
    it("grows population when maintenance and husbandry are fully covered", () => {
      // growthRate = 0.1, currentCount = 100 → growthDelta = floor(100 * 0.1) = 10
      const type = makePopType({
        id: "t1",
        husbandryJobId: "hj1",
        cullingJobId: "cj1",
        growthRate: 0.1,
        husbandryWorkersPerNAnimals: 1,
        maintenanceRulesJson: [{ amountPerNAnimals: 2, resourceId: "hay" }],
      });
      const pop = makePop({
        id: "p1",
        managedPopulationTypeId: "t1",
        settlementId: "s1",
        currentCount: 100,
      });
      // 100 animals × 2 hay/animal = 200 hay needed; 100 husbandry workers needed
      const ctx = makeContext({
        managedPopulationTypes: [type],
        managedPopulations: [pop],
        stockpiles: [makeStockpile("s1", "hay", 500)],
        citizenAssignments: Array.from({ length: 100 }, (_, i) =>
          makeHusbandryAssignment(`c${i}`, "p1"),
        ),
      });

      const result = phaseManagedPopulations(ctx);

      expect(result.managedPopulationUpdates).toHaveLength(1);
      const update = result.managedPopulationUpdates[0];
      expect(update?.countDelta).toBe(10); // floor(100 * 0.1)
      expect(update?.toStatus).toBeNull();

      // Maintenance: 200 hay consumed
      const hayDelta = result.stockpileDeltas.find(
        (d) => d.resourceId === "hay",
      );
      expect(hayDelta?.delta).toBe(-200);

      expect(result.logs).toHaveLength(0);
      expect(result.notifications).toHaveLength(0);
    });

    it("emits no logs when growth occurs normally", () => {
      const type = makePopType({
        id: "t1",
        husbandryJobId: "hj1",
        cullingJobId: "cj1",
        growthRate: 0.05,
        husbandryWorkersPerNAnimals: 1,
      });
      const pop = makePop({
        id: "p1",
        managedPopulationTypeId: "t1",
        settlementId: "s1",
        currentCount: 20,
      });
      const ctx = makeContext({
        managedPopulationTypes: [type],
        managedPopulations: [pop],
        citizenAssignments: Array.from({ length: 20 }, (_, i) =>
          makeHusbandryAssignment(`c${i}`, "p1"),
        ),
      });

      const result = phaseManagedPopulations(ctx);
      expect(result.logs).toHaveLength(0);
      expect(result.notifications).toHaveLength(0);
      expect(result.managedPopulationUpdates[0]?.countDelta).toBe(1); // floor(20 * 0.05)
    });
  });

  describe("maintenance shortfall causes decline", () => {
    it("declines when maintenance resources are insufficient", () => {
      // growthRate = 0.2, currentCount = 50
      // required hay = 50 * 1 = 50; only 0 available → maintenanceCoverage = 0
      // growthCountDelta = -ceil(50 * 0.2) = -10
      const type = makePopType({
        id: "t1",
        husbandryJobId: "hj1",
        cullingJobId: "cj1",
        growthRate: 0.2,
        husbandryWorkersPerNAnimals: 1,
        maintenanceRulesJson: [{ amountPerNAnimals: 1, resourceId: "hay" }],
      });
      const pop = makePop({
        id: "p1",
        managedPopulationTypeId: "t1",
        settlementId: "s1",
        currentCount: 50,
      });
      const ctx = makeContext({
        managedPopulationTypes: [type],
        managedPopulations: [pop],
        stockpiles: [makeStockpile("s1", "hay", 0)],
        // provide enough husbandry workers so only maintenance fails
        citizenAssignments: Array.from({ length: 50 }, (_, i) =>
          makeHusbandryAssignment(`c${i}`, "p1"),
        ),
      });

      const result = phaseManagedPopulations(ctx);

      const update = result.managedPopulationUpdates[0];
      expect(update?.countDelta).toBe(-10); // -ceil(50 * 0.2)
      expect(update?.toStatus).toBeNull();

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]?.category).toBe("managed_population.declining");
      expect(result.logs[0]?.phase).toBe("managedPopulations");

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.notificationType).toBe(
        "managed_population.declining",
      );
    });

    it("partial maintenance shortfall partially scales consumption and causes decline", () => {
      // 50 animals, 1 hay/animal → 50 hay needed; only 25 available → coverage = 0.5
      // Coverage < 1.0 → decline
      const type = makePopType({
        id: "t1",
        husbandryJobId: "hj1",
        cullingJobId: "cj1",
        growthRate: 0.1,
        husbandryWorkersPerNAnimals: 1,
        maintenanceRulesJson: [{ amountPerNAnimals: 1, resourceId: "hay" }],
      });
      const pop = makePop({
        id: "p1",
        managedPopulationTypeId: "t1",
        settlementId: "s1",
        currentCount: 50,
      });
      const ctx = makeContext({
        managedPopulationTypes: [type],
        managedPopulations: [pop],
        stockpiles: [makeStockpile("s1", "hay", 25)],
        citizenAssignments: Array.from({ length: 50 }, (_, i) =>
          makeHusbandryAssignment(`c${i}`, "p1"),
        ),
      });

      const result = phaseManagedPopulations(ctx);

      // Consumed: 50 * 1 * 0.5 = 25 hay
      const hayDelta = result.stockpileDeltas.find(
        (d) => d.resourceId === "hay",
      );
      expect(hayDelta?.delta).toBe(-25);

      // Decline: -ceil(50 * 0.1) = -5
      expect(result.managedPopulationUpdates[0]?.countDelta).toBe(-5);
      expect(result.logs[0]?.category).toBe("managed_population.declining");
    });
  });

  describe("husbandry shortage causes decline", () => {
    it("declines when no husbandry workers are assigned", () => {
      // growthRate = 0.1, currentCount = 100, husbandryWorkersPerNAnimals = 1
      // husbandryNeeded = 100, workers = 0 → husbandryCoverage = 0
      // growthCountDelta = -ceil(100 * 0.1) = -10
      const type = makePopType({
        id: "t1",
        husbandryJobId: "hj1",
        cullingJobId: "cj1",
        growthRate: 0.1,
        husbandryWorkersPerNAnimals: 1,
      });
      const pop = makePop({
        id: "p1",
        managedPopulationTypeId: "t1",
        settlementId: "s1",
        currentCount: 100,
      });
      const ctx = makeContext({
        managedPopulationTypes: [type],
        managedPopulations: [pop],
      });

      const result = phaseManagedPopulations(ctx);

      expect(result.managedPopulationUpdates[0]?.countDelta).toBe(-10);
      expect(result.logs[0]?.category).toBe("managed_population.declining");
      expect(result.notifications[0]?.notificationType).toBe(
        "managed_population.declining",
      );
    });

    it("declines when husbandry workers are insufficient (partial coverage)", () => {
      // 50 animals, 1 worker/animal → need 50; have 25 → coverage = 0.5
      const type = makePopType({
        id: "t1",
        husbandryJobId: "hj1",
        cullingJobId: "cj1",
        growthRate: 0.2,
        husbandryWorkersPerNAnimals: 1,
      });
      const pop = makePop({
        id: "p1",
        managedPopulationTypeId: "t1",
        settlementId: "s1",
        currentCount: 50,
      });
      const ctx = makeContext({
        managedPopulationTypes: [type],
        managedPopulations: [pop],
        citizenAssignments: Array.from({ length: 25 }, (_, i) =>
          makeHusbandryAssignment(`c${i}`, "p1"),
        ),
      });

      const result = phaseManagedPopulations(ctx);

      expect(result.managedPopulationUpdates[0]?.countDelta).toBe(
        -Math.ceil(50 * 0.2),
      );
      expect(result.logs[0]?.category).toBe("managed_population.declining");
    });
  });

  describe("culling produces outputs", () => {
    it("culls configured quantity and produces culling outputs", () => {
      // 100 animals, cull 10, 1 meat/animal culled → +10 meat
      const type = makePopType({
        id: "t1",
        husbandryJobId: "hj1",
        cullingJobId: "cj1",
        growthRate: 0.1,
        husbandryWorkersPerNAnimals: 1,
        cullingOutputsJson: [{ amountPerNAnimals: 1, resourceId: "meat" }],
      });
      const pop = makePop({
        id: "p1",
        managedPopulationTypeId: "t1",
        settlementId: "s1",
        currentCount: 100,
        configuredCullQuantity: 10,
      });
      const ctx = makeContext({
        managedPopulationTypes: [type],
        managedPopulations: [pop],
        citizenAssignments: Array.from({ length: 100 }, (_, i) =>
          makeHusbandryAssignment(`c${i}`, "p1"),
        ),
      });

      const result = phaseManagedPopulations(ctx);

      // Growth: floor(100 * 0.1) = 10; after growth = 110; cull 10 → final = 100
      const update = result.managedPopulationUpdates[0];
      expect(update?.countDelta).toBe(0); // +10 growth, -10 cull = 0 net
      expect(update?.toStatus).toBeNull();

      const meatDelta = result.stockpileDeltas.find(
        (d) => d.resourceId === "meat",
      );
      expect(meatDelta?.delta).toBe(10); // 10 animals × 1 meat/animal

      expect(result.logs).toHaveLength(0);
    });

    it("culling emits output even when population is declining", () => {
      const type = makePopType({
        id: "t1",
        husbandryJobId: "hj1",
        cullingJobId: "cj1",
        growthRate: 0.1,
        husbandryWorkersPerNAnimals: 1,
        cullingOutputsJson: [{ amountPerNAnimals: 2, resourceId: "meat" }],
      });
      const pop = makePop({
        id: "p1",
        managedPopulationTypeId: "t1",
        settlementId: "s1",
        currentCount: 50,
        configuredCullQuantity: 5,
      });
      // No husbandry workers → decline
      const ctx = makeContext({
        managedPopulationTypes: [type],
        managedPopulations: [pop],
      });

      const result = phaseManagedPopulations(ctx);

      // Decline: -ceil(50 * 0.1) = -5 → count becomes 45; cull 5 → 40
      const update = result.managedPopulationUpdates[0];
      expect(update?.countDelta).toBe(-10); // -5 decline + -5 cull
      expect(update?.toStatus).toBeNull();

      const meatDelta = result.stockpileDeltas.find(
        (d) => d.resourceId === "meat",
      );
      expect(meatDelta?.delta).toBe(10); // 5 culled × 2 meat/animal

      expect(result.logs[0]?.category).toBe("managed_population.declining");
    });
  });

  describe("extinction unassigns workers", () => {
    it("marks extinct and clears husbandry and culling assignments when count reaches 0", () => {
      // 5 animals, decline by -1 (ceil(5 * 0.1) = 1), then cull 4 → extinct
      const type = makePopType({
        id: "t1",
        husbandryJobId: "hj1",
        cullingJobId: "cj1",
        growthRate: 0.1,
        husbandryWorkersPerNAnimals: 1,
      });
      const pop = makePop({
        id: "p1",
        managedPopulationTypeId: "t1",
        settlementId: "s1",
        currentCount: 5,
        configuredCullQuantity: 4,
      });
      // No husbandry workers → decline
      const ctx = makeContext({
        managedPopulationTypes: [type],
        managedPopulations: [pop],
        citizenAssignments: [
          makeCullingAssignment("cull1", "p1"),
          makeCullingAssignment("cull2", "p1"),
        ],
      });

      const result = phaseManagedPopulations(ctx);

      // decline: -ceil(5 * 0.1) = -1 → count = 4; cull min(4, 4) = 4 → count = 0 → extinct
      const update = result.managedPopulationUpdates[0];
      expect(update?.countDelta).toBe(-5);
      expect(update?.toStatus).toBe("extinct");

      expect(result.assignmentClears).toHaveLength(2);
      const clearedIds = result.assignmentClears.map((c) => c.citizenId);
      expect(clearedIds).toContain("cull1");
      expect(clearedIds).toContain("cull2");
      expect(result.assignmentClears[0]?.reason).toBe(
        "managed_population_extinct",
      );

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]?.category).toBe("managed_population.extinct");
      expect(result.logs[0]?.phase).toBe("managedPopulations");

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.notificationType).toBe(
        "managed_population.extinct",
      );
    });

    it("clears both husbandry and culling workers on extinction", () => {
      const type = makePopType({
        id: "t1",
        husbandryJobId: "hj1",
        cullingJobId: "cj1",
        growthRate: 0,
      });
      const pop = makePop({
        id: "p1",
        managedPopulationTypeId: "t1",
        settlementId: "s1",
        currentCount: 3,
        configuredCullQuantity: 10, // more than count — will be clamped
      });
      const ctx = makeContext({
        managedPopulationTypes: [type],
        managedPopulations: [pop],
        citizenAssignments: [
          makeHusbandryAssignment("h1", "p1"),
          makeHusbandryAssignment("h2", "p1"),
          makeCullingAssignment("k1", "p1"),
        ],
      });

      const result = phaseManagedPopulations(ctx);

      expect(result.managedPopulationUpdates[0]?.toStatus).toBe("extinct");
      const clearedIds = result.assignmentClears.map((c) => c.citizenId);
      expect(clearedIds).toContain("h1");
      expect(clearedIds).toContain("h2");
      expect(clearedIds).toContain("k1");
    });
  });

  describe("property: cull quantity clamped to current count", () => {
    it("never produces negative population when configured_cull_quantity > current_count", () => {
      // After growth: 5 animals. configuredCullQuantity = 100. Clamp to 5.
      const type = makePopType({
        id: "t1",
        husbandryJobId: "hj1",
        cullingJobId: "cj1",
        growthRate: 0,
        husbandryWorkersPerNAnimals: 1,
        cullingOutputsJson: [{ amountPerNAnimals: 1, resourceId: "meat" }],
      });
      const pop = makePop({
        id: "p1",
        managedPopulationTypeId: "t1",
        settlementId: "s1",
        currentCount: 5,
        configuredCullQuantity: 100,
      });
      const ctx = makeContext({
        managedPopulationTypes: [type],
        managedPopulations: [pop],
        citizenAssignments: Array.from({ length: 5 }, (_, i) =>
          makeHusbandryAssignment(`c${i}`, "p1"),
        ),
      });

      const result = phaseManagedPopulations(ctx);

      // growthRate=0: no growth, no decline; cull clamped to 5 → extinct
      const update = result.managedPopulationUpdates[0];
      expect(update?.countDelta).toBe(-5); // -5 culled
      expect(update?.toStatus).toBe("extinct");

      // Produced: 5 × 1 = 5 meat (not 100)
      const meatDelta = result.stockpileDeltas.find(
        (d) => d.resourceId === "meat",
      );
      expect(meatDelta?.delta).toBe(5);

      // Final count: 5 - 5 = 0 → never negative
      const finalCount = 5 + (update?.countDelta ?? 0);
      expect(finalCount).toBeGreaterThanOrEqual(0);
    });

    it("property: finalCount is always >= 0 regardless of cull quantity", () => {
      const type = makePopType({
        id: "t1",
        husbandryJobId: "hj1",
        cullingJobId: "cj1",
        growthRate: 0.5, // high growth
        husbandryWorkersPerNAnimals: 1,
      });

      for (const currentCount of [1, 5, 10, 100]) {
        for (const configuredCullQuantity of [0, 1, 50, 200, 9999]) {
          const pop = makePop({
            id: "p1",
            managedPopulationTypeId: "t1",
            settlementId: "s1",
            currentCount,
            configuredCullQuantity,
          });
          const ctx = makeContext({
            managedPopulationTypes: [type],
            managedPopulations: [pop],
            citizenAssignments: Array.from({ length: currentCount }, (_, i) =>
              makeHusbandryAssignment(`c${i}`, "p1"),
            ),
          });

          const result = phaseManagedPopulations(ctx);
          const update = result.managedPopulationUpdates[0];
          const finalCount = currentCount + (update?.countDelta ?? 0);
          expect(finalCount).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe("multiple populations", () => {
    it("processes each population independently", () => {
      const type = makePopType({
        id: "t1",
        husbandryJobId: "hj1",
        cullingJobId: "cj1",
        growthRate: 0.1,
        husbandryWorkersPerNAnimals: 1,
      });
      const pop1 = makePop({
        id: "p1",
        managedPopulationTypeId: "t1",
        settlementId: "s1",
        currentCount: 100,
      });
      const pop2 = makePop({
        id: "p2",
        managedPopulationTypeId: "t1",
        settlementId: "s1",
        currentCount: 50,
      });

      const ctx = makeContext({
        managedPopulationTypes: [type],
        managedPopulations: [pop1, pop2],
        // Fully staff p1, no workers for p2
        citizenAssignments: Array.from({ length: 100 }, (_, i) =>
          makeHusbandryAssignment(`c${i}`, "p1"),
        ),
      });

      const result = phaseManagedPopulations(ctx);

      expect(result.managedPopulationUpdates).toHaveLength(2);
      const p1Update = result.managedPopulationUpdates.find(
        (u) => u.managedPopulationInstanceId === "p1",
      );
      const p2Update = result.managedPopulationUpdates.find(
        (u) => u.managedPopulationInstanceId === "p2",
      );

      expect(p1Update?.countDelta).toBe(10); // grows
      expect(p2Update?.countDelta).toBe(-5); // declines (no workers)

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]?.category).toBe("managed_population.declining");
    });
  });
});
