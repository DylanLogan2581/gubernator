// Unit tests for phaseManagedPopulations — per-job husbandry coverage and
// culling-gate formulas, and growth/decline behaviour.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseManagedPopulations } from "./phaseManagedPopulations.ts";

import type {
  SimManagedPopulationCullingJob,
  SimManagedPopulationHusbandryJob,
  SimManagedPopulation,
  SimManagedPopulationType,
  SimulationContext,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(
  overrides: Partial<SimulationContext["input"]> & {
    pops: SimManagedPopulation[];
    types: SimManagedPopulationType[];
    husbandryJobs?: SimManagedPopulationHusbandryJob[];
    cullingJobs?: SimManagedPopulationCullingJob[];
    husbandryAssignments?: { citizenId: string; popId: string }[];
    cullingAssignments?: { citizenId: string; popId: string }[];
  },
): SimulationContext {
  const {
    pops,
    types,
    husbandryJobs = [],
    cullingJobs = [],
    husbandryAssignments = [],
    cullingAssignments = [],
    ...rest
  } = overrides;

  return {
    input: {
      buildingBlueprints: [],
      buildingTiers: [],
      calendarConfig: {
        dateFormatTemplate: "{year}",
        months: [{ dayCount: 30, index: 0, name: "Jan" }],
        startingDayOfMonth: 1,
        startingMonthIndex: 0,
        startingWeekdayOffset: 0,
        startingYear: 1,
        weekdays: [{ index: 0, name: "Mon" }],
      },
      citizenAssignments: [
        ...husbandryAssignments.map(({ citizenId, popId }) => ({
          assignedOnTurnNumber: 1,
          assignmentType: "husbandry" as const,
          citizenId,
          constructionProjectId: null,
          depositInstanceId: null,
          jobId: null,
          managedPopulationInstanceId: popId,
          tradeRouteEnd: null,
          tradeRouteId: null,
        })),
        ...cullingAssignments.map(({ citizenId, popId }) => ({
          assignedOnTurnNumber: 1,
          assignmentType: "culling" as const,
          citizenId,
          constructionProjectId: null,
          depositInstanceId: null,
          jobId: null,
          managedPopulationInstanceId: popId,
          tradeRouteEnd: null,
          tradeRouteId: null,
        })),
      ],
      citizens: [],
      constructionProjects: [],
      armies: [],
      armyUnits: [],
      depositTypeJobs: [],
      depositTypes: [],
      deposits: [],
    educationEnrollments: [],
    educationLevels: [],
      events: [],
      jobs: [],
      managedPopulationCullingJobs: cullingJobs,
      managedPopulationHusbandryJobs: husbandryJobs,
      managedPopulationTypes: types,
      managedPopulations: pops,
      nationCurrencies: [],
      nationCurrencyLedgerEntries: [],
      nationOffices: [],
      nationRelationships: [],
      nationResourceStockpiles: [],
      nationTreaties: [],
      nations: [],
      partnerships: [],
      populationRules: {
        fertilityChance: 0,
        foodConsumptionPerCitizen: 0,
        homelessnessDecliningRate: 0,
        incestPreventionDepth: 0,
        maximumFertilityAgeTurns: null,
        minimumPartnershipAgeTurns: 0,
        mourningPeriodTurns: 0,
        partnershipSeekChance: 1,
        starvationSeverityMultiplier: 0,
        waterConsumptionPerCitizen: 0,
      },
      resources: [],
      settlementBuildings: [],
      settlements: [{ id: "s1", name: "Testville" }],
      stockpiles: [],
      systemResourceIds: { foodId: "food", freshWaterId: "water" },
      tradeRoutes: [],
      turnNumber: 1,
      unitSoldiers: [],
      unitTypes: [],
      worldId: "w1",
      ...rest,
    },
    shared: {
      pendingDeaths: new Set(),
      pendingDepositDestroys: new Set(),
      pendingEventMultipliers: new Map(),
      pendingNationStockpiles: new Map(),
      pendingManagedPopulationDeltas: new Map(),
      pendingPopCapBySettlement: new Map(),
      pendingStockpiles: new Map(),
    },
  };
}

function makeBeeColonyType(
  overrides?: Partial<SimManagedPopulationType>,
): SimManagedPopulationType {
  return {
    cullingOutputsJson: [],
    growthRate: 0.1,
    id: "bee-type",
    maintenanceRulesJson: [],
    name: "Bee Colony",
    regularOutputsJson: [],
    ...overrides,
  };
}

function makeBeeFarm(
  overrides?: Partial<SimManagedPopulation>,
): SimManagedPopulation {
  return {
    configuredCullQuantity: 0,
    currentCount: 140,
    id: "bee-farm",
    managedPopulationTypeId: "bee-type",
    name: "Bee Farm",
    settlementId: "s1",
    status: "active",
    ...overrides,
  };
}

function makeHusbandryJob(
  overrides?: Partial<SimManagedPopulationHusbandryJob>,
): SimManagedPopulationHusbandryJob {
  return {
    id: "husb-job-1",
    jobId: "beekeeper",
    managedPopulationTypeId: "bee-type",
    workersPerNAnimals: 20,
    ...overrides,
  };
}

function makeCullingJob(
  overrides?: Partial<SimManagedPopulationCullingJob>,
): SimManagedPopulationCullingJob {
  return {
    id: "cull-job-1",
    jobId: "honey-gatherer",
    managedPopulationTypeId: "bee-type",
    maxCullPerWorker: 10,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseManagedPopulations — husbandry coverage formula", () => {
  it("caps coverage at 1 when worker capacity exceeds the population count", () => {
    // count=140, 8 workers * 20/worker = 160 capacity → min(1, 160/140) = 1
    const ctx = makeContext({
      types: [makeBeeColonyType()],
      pops: [makeBeeFarm()],
      husbandryJobs: [makeHusbandryJob()],
      husbandryAssignments: Array.from({ length: 8 }, (_, i) => ({
        citizenId: `c${i}`,
        popId: "bee-farm",
      })),
    });

    const result = phaseManagedPopulations(ctx);

    const update = result.managedPopulationUpdates.find(
      (u) => u.managedPopulationInstanceId === "bee-farm",
    );
    expect(update).toBeDefined();
    // Full coverage → growth: floor(140 * 0.1) = 14
    expect(update?.countDelta).toBe(14);
    expect(update?.toStatus).toBeNull();

    const decliningLog = result.logs.find(
      (l) => l.category === "managed_population.declining",
    );
    expect(decliningLog).toBeUndefined();
  });

  it("gives zero coverage with zero husbandry workers", () => {
    const ctx = makeContext({
      types: [makeBeeColonyType()],
      pops: [makeBeeFarm()],
      husbandryJobs: [makeHusbandryJob()],
      husbandryAssignments: [],
    });

    const result = phaseManagedPopulations(ctx);

    const update = result.managedPopulationUpdates.find(
      (u) => u.managedPopulationInstanceId === "bee-farm",
    );
    expect(update?.countDelta).toBeLessThan(0);

    const log = result.logs.find(
      (l) => l.category === "managed_population.declining",
    );
    expect(log).toBeDefined();
    expect((log?.payload as { husbandryCoverage: number } | undefined)?.husbandryCoverage).toBe(
      0,
    );
  });

  it("splits pooled workers evenly across multiple husbandry jobs", () => {
    // count=140, two jobs (20/worker, 10/worker), 4 workers pooled → 2 each.
    // capacity = 2*20 + 2*10 = 60 → coverage = min(1, 60/140) ≈ 0.4286
    const ctx = makeContext({
      types: [makeBeeColonyType()],
      pops: [makeBeeFarm()],
      husbandryJobs: [
        makeHusbandryJob({ id: "husb-job-1", jobId: "beekeeper", workersPerNAnimals: 20 }),
        makeHusbandryJob({ id: "husb-job-2", jobId: "master-beekeeper", workersPerNAnimals: 10 }),
      ],
      husbandryAssignments: Array.from({ length: 4 }, (_, i) => ({
        citizenId: `c${i}`,
        popId: "bee-farm",
      })),
    });

    const result = phaseManagedPopulations(ctx);

    const log = result.logs.find(
      (l) => l.category === "managed_population.declining",
    );
    expect(log).toBeDefined();
    const payload = log?.payload as { husbandryCoverage: number } | undefined;
    expect(payload?.husbandryCoverage).toBeCloseTo(60 / 140);
  });
});

describe("phaseManagedPopulations — culling gate formula", () => {
  it("gates cull below the configured quantity when worker capacity is lower", () => {
    // configuredCullQuantity=50, 2 workers * 10/worker = 20 capacity → cull=20
    const ctx = makeContext({
      types: [makeBeeColonyType()],
      pops: [
        makeBeeFarm({
          configuredCullQuantity: 50,
          currentCount: 140,
        }),
      ],
      husbandryJobs: [makeHusbandryJob()],
      cullingJobs: [makeCullingJob()],
      husbandryAssignments: Array.from({ length: 8 }, (_, i) => ({
        citizenId: `h${i}`,
        popId: "bee-farm",
      })),
      cullingAssignments: [
        { citizenId: "cull1", popId: "bee-farm" },
        { citizenId: "cull2", popId: "bee-farm" },
      ],
    });

    const result = phaseManagedPopulations(ctx);

    const update = result.managedPopulationUpdates.find(
      (u) => u.managedPopulationInstanceId === "bee-farm",
    );
    // Fully supported → growth: floor(140*0.1)=14 → 154, then cull=20 → -6 net
    expect(update?.countDelta).toBe(14 - 20);
  });

  it("caps cull at the configured quantity when worker capacity exceeds it", () => {
    // configuredCullQuantity=5, 8 workers * 10/worker = 80 capacity → cull=5
    const ctx = makeContext({
      types: [makeBeeColonyType()],
      pops: [
        makeBeeFarm({
          configuredCullQuantity: 5,
          currentCount: 140,
        }),
      ],
      husbandryJobs: [makeHusbandryJob()],
      cullingJobs: [makeCullingJob()],
      husbandryAssignments: Array.from({ length: 8 }, (_, i) => ({
        citizenId: `h${i}`,
        popId: "bee-farm",
      })),
      cullingAssignments: Array.from({ length: 8 }, (_, i) => ({
        citizenId: `cull${i}`,
        popId: "bee-farm",
      })),
    });

    const result = phaseManagedPopulations(ctx);

    const update = result.managedPopulationUpdates.find(
      (u) => u.managedPopulationInstanceId === "bee-farm",
    );
    expect(update?.countDelta).toBe(14 - 5);
  });

  it("gates cull to zero with zero culling workers, even if configured quantity is positive", () => {
    const ctx = makeContext({
      types: [makeBeeColonyType()],
      pops: [
        makeBeeFarm({
          configuredCullQuantity: 20,
          currentCount: 140,
        }),
      ],
      husbandryJobs: [makeHusbandryJob()],
      cullingJobs: [makeCullingJob()],
      husbandryAssignments: Array.from({ length: 8 }, (_, i) => ({
        citizenId: `h${i}`,
        popId: "bee-farm",
      })),
      cullingAssignments: [],
    });

    const result = phaseManagedPopulations(ctx);

    const update = result.managedPopulationUpdates.find(
      (u) => u.managedPopulationInstanceId === "bee-farm",
    );
    // Fully supported → growth of 14, no cull applied.
    expect(update?.countDelta).toBe(14);
  });
});
