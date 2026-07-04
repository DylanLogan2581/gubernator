// Unit tests for phaseStandardJobs — verifies scope fields on log entries.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseStandardJobs } from "./phaseStandardJobs.ts";

import type {
  SimCitizen,
  SimCitizenAssignment,
  SimJob,
  SimSettlement,
  SimulationContext,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CALENDAR_CONFIG: SimulationContext["input"]["calendarConfig"] = {
  dateFormatTemplate: "{year}",
  months: [{ dayCount: 30, index: 0, name: "Jan" }],
  startingDayOfMonth: 1,
  startingMonthIndex: 0,
  startingWeekdayOffset: 0,
  startingYear: 1,
  weekdays: [{ index: 0, name: "Mon" }],
};

const POPULATION_RULES: SimulationContext["input"]["populationRules"] = {
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

function makeShared(): SimulationContext["shared"] {
  return {
    pendingDeaths: new Set(),
    pendingDepositDestroys: new Set(),
    pendingEventMultipliers: new Map(),
    pendingManagedPopulationDeltas: new Map(),
    pendingPopCapBySettlement: new Map(),
    pendingStockpiles: new Map(),
  };
}

function makeJob(
  id: string,
  outputResourceId: string,
  amountPerWorker = 10,
): SimJob {
  return {
    baseCapacity: null,
    id,
    inputsJson: [],
    jobType: "standard",
    linkedDepositTypeId: null,
    linkedManagedPopulationTypeId: null,
    name: id,
    outputsJson: [{ amountPerWorker, resourceId: outputResourceId }],
    traderCapacityPerWorker: null,
  };
}

function makeCitizen(id: string, settlementId: string): SimCitizen {
  return {
    bornOnTurnNumber: 1,
    citizenType: "npc",
    givenName: id,
    id,
    namesetId: null,
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId,
    sex: "male",
    status: "alive",
    surname: null,
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

function makeContext(
  settlements: SimSettlement[],
  jobs: SimJob[],
  citizens: SimCitizen[],
  assignments: SimCitizenAssignment[],
): SimulationContext {
  return {
    input: {
      buildingBlueprints: [],
      buildingTiers: [],
      calendarConfig: CALENDAR_CONFIG,
      citizenAssignments: assignments,
      citizens,
      constructionProjects: [],
      depositTypes: [],
      deposits: [],
      events: [],
      jobs,
      managedPopulationTypes: [],
      managedPopulations: [],
      partnerships: [],
      populationRules: POPULATION_RULES,
      resources: [],
      settlementBuildings: [],
      settlements,
      stockpiles: [],
      systemResourceIds: { foodId: "food", freshWaterId: "water" },
      tradeRoutes: [],
      turnNumber: 1,
      worldId: "w1",
    },
    shared: makeShared(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseStandardJobs — log entry scope fields", () => {
  it("populates top-level settlementId and nationId on processed log entries", () => {
    const settlement: SimSettlement = {
      id: "s1",
      name: "Testville",
      nationId: "n1",
    };
    const job = makeJob("j1", "wood");
    const citizen = makeCitizen("c1", "s1");
    const assignment = makeAssignment("c1", "j1");

    const ctx = makeContext([settlement], [job], [citizen], [assignment]);
    const { logs } = phaseStandardJobs(ctx);

    const processed = logs.filter((l) => l.category === "standard_job.processed");
    expect(processed.length).toBeGreaterThan(0);

    for (const entry of processed) {
      expect(entry.settlementId).toBe("s1");
      expect(entry.nationId).toBe("n1");
    }
  });

  it("populates settlementId even when nationId is absent from settlement", () => {
    const settlement: SimSettlement = { id: "s2", name: "Bordertown" };
    const job = makeJob("j2", "stone");
    const citizen = makeCitizen("c2", "s2");
    const assignment = makeAssignment("c2", "j2");

    const ctx = makeContext([settlement], [job], [citizen], [assignment]);
    const { logs } = phaseStandardJobs(ctx);

    const processed = logs.filter((l) => l.category === "standard_job.processed");
    expect(processed.length).toBeGreaterThan(0);

    for (const entry of processed) {
      expect(entry.settlementId).toBe("s2");
      expect(entry.nationId).toBeUndefined();
    }
  });

  it("emits one log entry per active job per settlement", () => {
    const settlement: SimSettlement = { id: "s3", name: "Ironhold", nationId: "n3" };
    const job1 = makeJob("j3a", "iron");
    const job2 = makeJob("j3b", "coal");
    const citizen1 = makeCitizen("c3a", "s3");
    const citizen2 = makeCitizen("c3b", "s3");

    const ctx = makeContext(
      [settlement],
      [job1, job2],
      [citizen1, citizen2],
      [makeAssignment("c3a", "j3a"), makeAssignment("c3b", "j3b")],
    );
    const { logs } = phaseStandardJobs(ctx);

    const processed = logs.filter((l) => l.category === "standard_job.processed");
    expect(processed).toHaveLength(2);
    for (const entry of processed) {
      expect(entry.settlementId).toBe("s3");
      expect(entry.nationId).toBe("n3");
    }
  });
});
