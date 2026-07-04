// Shared test-only fixtures for phase unit tests.
//
// Not a *.test.ts file, so vitest never collects it as a suite. Import from
// individual phase `*.test.ts` files to avoid re-deriving SimulationContext
// boilerplate in every file (see phaseManagedPopulations.test.ts /
// phaseStandardJobs.test.ts for the pre-existing, now-generalized pattern).
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import type {
  SimCitizen,
  SimCitizenAssignment,
  SimSettlement,
  SimulationContext,
  SimulationInputState,
  SimulationSharedState,
} from "../simulationTypes.ts";

export const CALENDAR_CONFIG: SimulationInputState["calendarConfig"] = {
  dateFormatTemplate: "{year}",
  months: [{ dayCount: 30, index: 0, name: "Jan" }],
  startingDayOfMonth: 1,
  startingMonthIndex: 0,
  startingWeekdayOffset: 0,
  startingYear: 1,
  weekdays: [{ index: 0, name: "Mon" }],
};

export const POPULATION_RULES: SimulationInputState["populationRules"] = {
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

export function makeSharedState(): SimulationSharedState {
  return {
    pendingDeaths: new Set(),
    pendingDepositDestroys: new Set(),
    pendingEventMultipliers: new Map(),
    pendingManagedPopulationDeltas: new Map(),
    pendingPopCapBySettlement: new Map(),
    pendingStockpiles: new Map(),
  };
}

export function makeInputState(
  overrides: Partial<SimulationInputState> = {},
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
    populationRules: POPULATION_RULES,
    resources: [],
    settlementBuildings: [],
    settlements: [{ id: "s1", name: "Testville" }],
    stockpiles: [],
    systemResourceIds: { foodId: "food", freshWaterId: "water" },
    tradeRoutes: [],
    turnNumber: 1,
    worldId: "w1",
    ...overrides,
  };
}

export function makeContext(
  overrides: Partial<SimulationInputState> = {},
): SimulationContext {
  return {
    input: makeInputState(overrides),
    shared: makeSharedState(),
  };
}

export function makeSettlement(
  overrides: Partial<SimSettlement> & { id: string },
): SimSettlement {
  return {
    name: "Testville",
    ...overrides,
  };
}

export function makeCitizen(
  overrides: Partial<SimCitizen> & { id: string; settlementId: string },
): SimCitizen {
  return {
    bornOnTurnNumber: 1,
    citizenType: "npc",
    givenName: overrides.id,
    namesetId: null,
    parentACitizenId: null,
    parentBCitizenId: null,
    sex: "male",
    status: "alive",
    surname: null,
    ...overrides,
  };
}

export function makeAssignment(
  overrides: Partial<SimCitizenAssignment> & { citizenId: string },
): SimCitizenAssignment {
  return {
    assignedOnTurnNumber: 1,
    assignmentType: "standard_job",
    constructionProjectId: null,
    depositInstanceId: null,
    jobId: null,
    managedPopulationInstanceId: null,
    tradeRouteEnd: null,
    tradeRouteId: null,
    ...overrides,
  };
}
