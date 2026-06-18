// Unit tests for phaseManagedPopulations — husbandry coverage formula and
// growth/decline behaviour.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseManagedPopulations } from "./phaseManagedPopulations.ts";

import type {
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
    husbandryAssignments?: { citizenId: string; popId: string }[];
  },
): SimulationContext {
  const { pops, types, husbandryAssignments = [], ...rest } = overrides;

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
      citizenAssignments: husbandryAssignments.map(({ citizenId, popId }) => ({
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
      citizens: [],
      constructionProjects: [],
      depositTypes: [],
      deposits: [],
      events: [],
      jobs: [],
      managedPopulationTypes: types,
      managedPopulations: pops,
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
      worldId: "w1",
      ...rest,
    },
    shared: {
      pendingDeaths: new Set(),
      pendingDepositDestroys: new Set(),
      pendingEventMultipliers: new Map(),
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
    cullingJobId: "cull-job",
    cullingOutputsJson: [],
    growthRate: 0.1,
    husbandryJobId: "husb-job",
    husbandryWorkersPerNAnimals: 20,
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
    currentCount: 142,
    id: "bee-farm",
    managedPopulationTypeId: "bee-type",
    name: "Bee Farm",
    settlementId: "s1",
    status: "active",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseManagedPopulations — husbandry coverage formula", () => {
  it("computes required workers as ceil(count / N), not count * N", () => {
    // count=142, N=20 → ceil(142/20) = ceil(7.1) = 8
    // Old (buggy) formula: 20 * 142 = 2840
    const ctx = makeContext({
      types: [makeBeeColonyType()],
      pops: [makeBeeFarm()],
      // 0 husbandry workers assigned — coverage should be 0/8 = 0, not 0/2840
      husbandryAssignments: [],
    });

    const result = phaseManagedPopulations(ctx);

    // With growthRate=0.1 and coverage < 1: decline = -ceil(142 * 0.1) = -15
    const update = result.managedPopulationUpdates.find(
      (u) => u.managedPopulationInstanceId === "bee-farm",
    );
    expect(update).toBeDefined();
    // Population declines (not grows) due to insufficient husbandry
    expect(update?.countDelta).toBeLessThan(0);

    // Declining log must be emitted
    const log = result.logs.find(
      (l) => l.category === "managed_population.declining",
    );
    expect(log).toBeDefined();
    // husbandryCoverage should be 0 (0 workers / 8 needed), not ~0.0007
    expect((log?.payload as { husbandryCoverage: number } | undefined)?.husbandryCoverage).toBe(0);
  });

  it("fully supports colony when workers >= ceil(count / N)", () => {
    // count=142, N=20 → needed=8; assign 8 workers → coverage=1
    const ctx = makeContext({
      types: [makeBeeColonyType()],
      pops: [makeBeeFarm()],
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
    // With full coverage and growthRate=0.1: floor(142 * 0.1) = 14 growth
    expect(update?.countDelta).toBeGreaterThan(0);
    expect(update?.toStatus).toBeNull();

    // No declining log
    const decliningLog = result.logs.find(
      (l) => l.category === "managed_population.declining",
    );
    expect(decliningLog).toBeUndefined();
  });

  it("ceil(142 / 20) equals 8, not 2840", () => {
    // Directly assert the arithmetic the formula must satisfy.
    expect(Math.ceil(142 / 20)).toBe(8);
  });

  it("partial coverage (2 of 8 workers) gives husbandryCoverage = 0.25", () => {
    // count=142, N=20 → needed=8; 2 workers → coverage=2/8=0.25 (not 2/2840)
    const ctx = makeContext({
      types: [makeBeeColonyType()],
      pops: [makeBeeFarm()],
      husbandryAssignments: [
        { citizenId: "c1", popId: "bee-farm" },
        { citizenId: "c2", popId: "bee-farm" },
      ],
    });

    const result = phaseManagedPopulations(ctx);

    const log = result.logs.find(
      (l) => l.category === "managed_population.declining",
    );
    expect(log).toBeDefined();
    const payload = log?.payload as {
      husbandryCoverage: number;
      maintenanceCoverage: number;
    } | undefined;
    expect(payload?.husbandryCoverage).toBeCloseTo(0.25);
    expect(payload?.maintenanceCoverage).toBe(1);
  });
});
