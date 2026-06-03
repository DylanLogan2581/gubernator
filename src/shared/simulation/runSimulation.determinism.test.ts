// Determinism regression guard for runSimulation.
//
// Verifies that the engine is stable: identical inputs always produce identical
// outputs, and key insertion order on the input object has no effect on results.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { describe, expect, it } from "vitest";

import { runSimulation } from "./runSimulation.ts";

import type {
  SimBuildingBlueprint,
  SimBuildingTier,
  SimCitizen,
  SimCitizenAssignment,
  SimConstructionProject,
  SimDeposit,
  SimDepositType,
  SimEvent,
  SimJob,
  SimManagedPopulation,
  SimManagedPopulationType,
  SimPartnership,
  SimSettlement,
  SimSettlementBuilding,
  SimStockpile,
  SimTradeRoute,
  SimulationInputState,
} from "./simulationTypes.ts";

// ---------------------------------------------------------------------------
// Resource IDs
// ---------------------------------------------------------------------------

const FOOD_ID = "food";
const WATER_ID = "water";
const STONE_ID = "stone";
const IRON_ID = "iron";
const COINS_ID = "coins";

// ---------------------------------------------------------------------------
// Settlement IDs
// ---------------------------------------------------------------------------

const S1 = "s1"; // primary settlement
const S2 = "s2"; // trade route destination

// ---------------------------------------------------------------------------
// Job IDs
// ---------------------------------------------------------------------------

const JOB_QUARRY = "job-quarry";
const JOB_TRADER = "job-trader";
const JOB_HUSBANDRY = "job-husbandry";
const JOB_CULLING = "job-culling";
const JOB_DEPOSIT = "job-deposit";

// ---------------------------------------------------------------------------
// Building / tier IDs
// ---------------------------------------------------------------------------

const BP_SMITHY = "bp-smithy";
const BP_MINT = "bp-mint";
const BP_BARRACKS = "bp-barracks";
const BP_WORKSHOP = "bp-workshop";

const TIER_SMITHY_T1 = "tier-smithy-t1";
const TIER_MINT_T1 = "tier-mint-t1";
const TIER_BARRACKS_T1 = "tier-barracks-t1";
const TIER_WORKSHOP_T1 = "tier-workshop-t1";

const BLD_SMITHY = "bld-smithy";
const BLD_MINT = "bld-mint";
const BLD_BARRACKS = "bld-barracks";

// ---------------------------------------------------------------------------
// Deposit IDs
// ---------------------------------------------------------------------------

const DEPOSIT_TYPE_IRON = "dt-iron";
const DEPOSIT_IRON_1 = "dep-iron-1";
const DEPOSIT_RES_1 = "dep-res-1";

// ---------------------------------------------------------------------------
// Trade route / managed pop IDs
// ---------------------------------------------------------------------------

const ROUTE_1 = "route-1";
const POP_TYPE_SHEEP = "pt-sheep";
const POP_SHEEP_1 = "pop-sheep-1";

// ---------------------------------------------------------------------------
// Construction project ID
// ---------------------------------------------------------------------------

const PROJECT_1 = "proj-1";

// ---------------------------------------------------------------------------
// Calendar config (minimal single-month calendar)
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

// ---------------------------------------------------------------------------
// Population rules
// ---------------------------------------------------------------------------

// - starvation disabled so citizen count stays stable across phases
// - homelessness enabled (rate 0.5) so phase 10 kills excess NPCs (pop cap 5,
//   7 alive NPCs → 2 excess → 1 death, deterministic sort order)
// - partnerships enabled (seek chance 1) so phase 9 forms partnerships via RNG
// - fertility disabled so phase 9 never triggers births
// - minimum partnership age 5 turns; citizens born at turn 0 are age 10 at turn 10

const POPULATION_RULES: SimulationInputState["populationRules"] = {
  fertilityChance: 0,
  foodConsumptionPerCitizen: 2,
  homelessnessDecliningRate: 0.5,
  incestPreventionDepth: 1,
  maximumFertilityAgeTurns: null,
  minimumPartnershipAgeTurns: 5,
  mourningPeriodTurns: 99,
  partnershipSeekChance: 1,
  starvationSeverityMultiplier: 0,
  waterConsumptionPerCitizen: 1,
};

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

const SETTLEMENTS: readonly SimSettlement[] = [
  { id: S1, name: "Alpha" },
  { id: S2, name: "Beta" },
];

// ---------------------------------------------------------------------------
// Jobs (covers standard, deposit, trader, husbandry, culling)
// ---------------------------------------------------------------------------

const JOBS: readonly SimJob[] = [
  {
    baseCapacity: null,
    id: JOB_QUARRY,
    inputsJson: [],
    jobType: "standard",
    linkedDepositTypeId: null,
    linkedManagedPopulationTypeId: null,
    name: "Quarry",
    outputsJson: [{ amountPerWorker: 5, resourceId: STONE_ID }],
    traderCapacityPerWorker: null,
  },
  {
    baseCapacity: null,
    id: JOB_TRADER,
    inputsJson: [],
    jobType: "trader",
    linkedDepositTypeId: null,
    linkedManagedPopulationTypeId: null,
    name: "Trader",
    outputsJson: [],
    traderCapacityPerWorker: 20,
  },
  {
    baseCapacity: null,
    id: JOB_HUSBANDRY,
    inputsJson: [],
    jobType: "husbandry",
    linkedDepositTypeId: null,
    linkedManagedPopulationTypeId: POP_TYPE_SHEEP,
    name: "Husbandry",
    outputsJson: [],
    traderCapacityPerWorker: null,
  },
  {
    baseCapacity: null,
    id: JOB_CULLING,
    inputsJson: [],
    jobType: "culling",
    linkedDepositTypeId: null,
    linkedManagedPopulationTypeId: POP_TYPE_SHEEP,
    name: "Culling",
    outputsJson: [],
    traderCapacityPerWorker: null,
  },
  {
    baseCapacity: null,
    id: JOB_DEPOSIT,
    inputsJson: [],
    jobType: "deposit",
    linkedDepositTypeId: DEPOSIT_TYPE_IRON,
    linkedManagedPopulationTypeId: null,
    name: "Iron Mining",
    outputsJson: [],
    traderCapacityPerWorker: null,
  },
];

// ---------------------------------------------------------------------------
// Building blueprints and tiers
// ---------------------------------------------------------------------------

const BUILDING_BLUEPRINTS: readonly SimBuildingBlueprint[] = [
  {
    gracePeriodTurns: 0,
    id: BP_SMITHY,
    maxInstancesPerSettlement: null,
    name: "Smithy",
  },
  {
    gracePeriodTurns: 0,
    id: BP_MINT,
    maxInstancesPerSettlement: null,
    name: "Mint",
  },
  {
    gracePeriodTurns: 0,
    id: BP_BARRACKS,
    maxInstancesPerSettlement: null,
    name: "Barracks",
  },
  {
    gracePeriodTurns: 3,
    id: BP_WORKSHOP,
    maxInstancesPerSettlement: null,
    name: "Workshop",
  },
];

const BUILDING_TIERS: readonly SimBuildingTier[] = [
  {
    buildingBlueprintId: BP_SMITHY,
    constructionCostsJson: [],
    effectsJson: [
      { amount: 2, jobId: JOB_QUARRY, type: "job_capacity_increase" },
    ],
    id: TIER_SMITHY_T1,
    tierNumber: 1,
    upkeepCostsJson: [{ amount: 3, resourceId: IRON_ID }],
    workerTurnsRequired: 20,
  },
  {
    buildingBlueprintId: BP_MINT,
    constructionCostsJson: [],
    effectsJson: [
      { amount: 4, resourceId: COINS_ID, type: "passive_resource_production" },
      { amount: 50, resourceId: STONE_ID, type: "resource_storage_increase" },
    ],
    id: TIER_MINT_T1,
    tierNumber: 1,
    upkeepCostsJson: [],
    workerTurnsRequired: 20,
  },
  {
    buildingBlueprintId: BP_BARRACKS,
    constructionCostsJson: [],
    effectsJson: [{ amount: 5, type: "population_cap_increase" }],
    id: TIER_BARRACKS_T1,
    tierNumber: 1,
    upkeepCostsJson: [],
    workerTurnsRequired: 20,
  },
  {
    buildingBlueprintId: BP_WORKSHOP,
    constructionCostsJson: [{ amount: 10, resourceId: STONE_ID }],
    effectsJson: [],
    id: TIER_WORKSHOP_T1,
    tierNumber: 1,
    upkeepCostsJson: [],
    workerTurnsRequired: 10,
  },
];

// ---------------------------------------------------------------------------
// Settlement buildings (smithy + mint + barracks, all active)
// ---------------------------------------------------------------------------

const SETTLEMENT_BUILDINGS: readonly SimSettlementBuilding[] = [
  {
    activatedOnTurnNumber: 1,
    buildingBlueprintId: BP_SMITHY,
    currentTierId: TIER_SMITHY_T1,
    id: BLD_SMITHY,
    missedUpkeepCount: 0,
    settlementId: S1,
    sourceProjectId: null,
    state: "active",
  },
  {
    activatedOnTurnNumber: 1,
    buildingBlueprintId: BP_MINT,
    currentTierId: TIER_MINT_T1,
    id: BLD_MINT,
    missedUpkeepCount: 0,
    settlementId: S1,
    sourceProjectId: null,
    state: "active",
  },
  {
    // Barracks: population_cap_increase 5 → cap = 5
    // 7 alive NPCs → overage 2 → ceil(2 * 0.5) = 1 homeless death (phase 10)
    activatedOnTurnNumber: 1,
    buildingBlueprintId: BP_BARRACKS,
    currentTierId: TIER_BARRACKS_T1,
    id: BLD_BARRACKS,
    missedUpkeepCount: 0,
    settlementId: S1,
    sourceProjectId: null,
    state: "active",
  },
];

// ---------------------------------------------------------------------------
// Construction project (phase 3 — in_progress, will not complete this turn)
// ---------------------------------------------------------------------------

const CONSTRUCTION_PROJECTS: readonly SimConstructionProject[] = [
  {
    buildingBlueprintId: BP_WORKSHOP,
    id: PROJECT_1,
    progressWorkerTurns: 3,
    queuePosition: 1,
    settlementId: S1,
    status: "in_progress",
    targetTierId: TIER_WORKSHOP_T1,
    workerTurnsRequired: 10,
  },
];

// ---------------------------------------------------------------------------
// Deposit types and instances (phase 2)
// ---------------------------------------------------------------------------

const DEPOSIT_TYPES: readonly SimDepositType[] = [
  {
    id: DEPOSIT_TYPE_IRON,
    jobId: JOB_DEPOSIT,
    name: "Iron Vein",
    outputUnitsPerWorker: 3,
    workerInputsJson: [],
  },
];

const DEPOSITS: readonly SimDeposit[] = [
  {
    depositTypeId: DEPOSIT_TYPE_IRON,
    id: DEPOSIT_IRON_1,
    maxWorkers: 5,
    name: "Iron Vein #1",
    resources: [
      {
        depositInstanceId: DEPOSIT_IRON_1,
        id: DEPOSIT_RES_1,
        remainingQuantity: 100,
        resourceId: IRON_ID,
      },
    ],
    settlementId: S1,
    status: "active",
  },
];

// ---------------------------------------------------------------------------
// Trade routes (phase 6 — stone from S1 to S2)
// ---------------------------------------------------------------------------

const TRADE_ROUTES: readonly SimTradeRoute[] = [
  {
    destinationSettlementId: S2,
    id: ROUTE_1,
    originSettlementId: S1,
    quantityPerTransition: 10,
    resourceId: STONE_ID,
    status: "active",
  },
];

// ---------------------------------------------------------------------------
// Managed populations (phase 7 — sheep flock in S1)
// ---------------------------------------------------------------------------

const MANAGED_POP_TYPES: readonly SimManagedPopulationType[] = [
  {
    cullingJobId: JOB_CULLING,
    cullingOutputsJson: [],
    growthRate: 0.05,
    husbandryJobId: JOB_HUSBANDRY,
    husbandryWorkersPerNAnimals: 5,
    id: POP_TYPE_SHEEP,
    maintenanceRulesJson: [],
    name: "Sheep",
  },
];

const MANAGED_POPS: readonly SimManagedPopulation[] = [
  {
    configuredCullQuantity: 0,
    currentCount: 20,
    id: POP_SHEEP_1,
    managedPopulationTypeId: POP_TYPE_SHEEP,
    name: "Sheep Flock",
    settlementId: S1,
    status: "active",
  },
];

// ---------------------------------------------------------------------------
// Citizens (7 alive NPCs in S1; all born turn 0 → age 10 at turn 10)
// Pop cap = 5 → overage 2 → 1 homeless death (phase 10); sorted by id ascending.
// ---------------------------------------------------------------------------

const CITIZENS: readonly SimCitizen[] = [
  // assigned workers
  {
    bornOnTurnNumber: 0,
    citizenType: "npc",
    id: "c1",
    name: "c1",
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId: S1,
    sex: "female",
    status: "alive",
  },
  {
    bornOnTurnNumber: 0,
    citizenType: "npc",
    id: "c2",
    name: "c2",
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId: S1,
    sex: "male",
    status: "alive",
  },
  {
    bornOnTurnNumber: 0,
    citizenType: "npc",
    id: "c3",
    name: "c3",
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId: S1,
    sex: "female",
    status: "alive",
  },
  {
    bornOnTurnNumber: 0,
    citizenType: "npc",
    id: "c4",
    name: "c4",
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId: S1,
    sex: "male",
    status: "alive",
  },
  {
    bornOnTurnNumber: 0,
    citizenType: "npc",
    id: "c5",
    name: "c5",
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId: S1,
    sex: "female",
    status: "alive",
  },
  // unpartnered, eligible to seek partnerships (phase 9)
  {
    bornOnTurnNumber: 0,
    citizenType: "npc",
    id: "c6",
    name: "c6",
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId: S1,
    sex: "female",
    status: "alive",
  },
  {
    bornOnTurnNumber: 0,
    citizenType: "npc",
    id: "c7",
    name: "c7",
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId: S1,
    sex: "male",
    status: "alive",
  },
];

// ---------------------------------------------------------------------------
// Citizen assignments
// ---------------------------------------------------------------------------

const CITIZEN_ASSIGNMENTS: readonly SimCitizenAssignment[] = [
  // phase 1: c1 → quarry (standard_job)
  {
    assignedOnTurnNumber: 1,
    assignmentType: "standard_job",
    citizenId: "c1",
    constructionProjectId: null,
    depositInstanceId: null,
    jobId: JOB_QUARRY,
    managedPopulationInstanceId: null,
    tradeRouteEnd: null,
    tradeRouteId: null,
  },
  // phase 2: c2 → iron deposit
  {
    assignedOnTurnNumber: 1,
    assignmentType: "deposit",
    citizenId: "c2",
    constructionProjectId: null,
    depositInstanceId: DEPOSIT_IRON_1,
    jobId: null,
    managedPopulationInstanceId: null,
    tradeRouteEnd: null,
    tradeRouteId: null,
  },
  // phase 3: c3 → workshop construction project
  {
    assignedOnTurnNumber: 1,
    assignmentType: "construction_project",
    citizenId: "c3",
    constructionProjectId: PROJECT_1,
    depositInstanceId: null,
    jobId: null,
    managedPopulationInstanceId: null,
    tradeRouteEnd: null,
    tradeRouteId: null,
  },
  // phase 6: c4 → stone trade route (origin)
  {
    assignedOnTurnNumber: 1,
    assignmentType: "trade_route",
    citizenId: "c4",
    constructionProjectId: null,
    depositInstanceId: null,
    jobId: JOB_TRADER,
    managedPopulationInstanceId: null,
    tradeRouteEnd: "origin",
    tradeRouteId: ROUTE_1,
  },
  // phase 7: c5 → sheep husbandry
  {
    assignedOnTurnNumber: 1,
    assignmentType: "husbandry",
    citizenId: "c5",
    constructionProjectId: null,
    depositInstanceId: null,
    jobId: JOB_HUSBANDRY,
    managedPopulationInstanceId: POP_SHEEP_1,
    tradeRouteEnd: null,
    tradeRouteId: null,
  },
];

// ---------------------------------------------------------------------------
// Partnerships (none existing — all eligible citizens will seek partners)
// ---------------------------------------------------------------------------

const PARTNERSHIPS: readonly SimPartnership[] = [];

// ---------------------------------------------------------------------------
// Events (phase 11 — pending event, activates at turn 5, current turn 10)
// ---------------------------------------------------------------------------

const EVENTS: readonly SimEvent[] = [
  {
    activateOnTransitionAfterTurnNumber: 5,
    effectPayloadJsonb: { amount: 20, resourceId: COINS_ID },
    effectType: "resource_grant",
    id: "event-1",
    status: "pending",
  },
];

// ---------------------------------------------------------------------------
// Stockpiles
// ---------------------------------------------------------------------------

const STOCKPILES: readonly SimStockpile[] = [
  // S1 resources — all well-stocked to avoid shortfalls across phases
  { cap: 500, quantity: 200, resourceId: FOOD_ID, settlementId: S1 },
  { cap: 500, quantity: 200, resourceId: WATER_ID, settlementId: S1 },
  { cap: 200, quantity: 80, resourceId: STONE_ID, settlementId: S1 },
  // iron starts below smithy upkeep (3) so phase 4 logs a suspension/deconstruction
  { cap: 300, quantity: 2, resourceId: IRON_ID, settlementId: S1 },
  // coins start near cap so phase 12 (stockpileClamp) clamps them
  { cap: 500, quantity: 498, resourceId: COINS_ID, settlementId: S1 },
  // S2 resources — stone destination for the trade route
  { cap: 200, quantity: 0, resourceId: STONE_ID, settlementId: S2 },
];

// ---------------------------------------------------------------------------
// Canonical full input — non-trivial, covers all 13 phases
// ---------------------------------------------------------------------------

function buildFullInput(): SimulationInputState {
  return {
    buildingBlueprints: BUILDING_BLUEPRINTS,
    buildingTiers: BUILDING_TIERS,
    calendarConfig: CALENDAR_CONFIG,
    citizenAssignments: CITIZEN_ASSIGNMENTS,
    citizens: CITIZENS,
    constructionProjects: CONSTRUCTION_PROJECTS,
    deconstructOvershootLedger: [],
    depositTypes: DEPOSIT_TYPES,
    deposits: DEPOSITS,
    events: EVENTS,
    isWorldArchived: false,
    jobs: JOBS,
    managedPopulationTypes: MANAGED_POP_TYPES,
    managedPopulations: MANAGED_POPS,
    npcFlavorConfig: {
      contradictions: ["contradiction-a"],
      flaws: ["flaw-a"],
      goals: ["goal-a"],
      traits: ["trait-a", "trait-b"],
    },
    partnerships: PARTNERSHIPS,
    populationRules: POPULATION_RULES,
    settlementBuildings: SETTLEMENT_BUILDINGS,
    settlementId: S1,
    settlements: SETTLEMENTS,
    stockpiles: STOCKPILES,
    systemResourceIds: { foodId: FOOD_ID, freshWaterId: WATER_ID },
    tradeRoutes: TRADE_ROUTES,
    turnNumber: 10,
    worldId: "test-world",
  };
}

// ---------------------------------------------------------------------------
// Helper: re-create the input object with top-level keys in reverse-alphabetical
// insertion order, while keeping all values (including nested arrays/objects)
// as-is. Guards against any future use of Object.keys() / Object.entries()
// over the input at the top level.
// ---------------------------------------------------------------------------

function reverseKeyOrder(input: SimulationInputState): SimulationInputState {
  return Object.fromEntries(
    Object.entries(input).sort(([a], [b]) => b.localeCompare(a)),
  ) as SimulationInputState;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runSimulation — determinism", () => {
  it("produces identical output when called twice with the same input and transitionId", () => {
    const input = buildFullInput();

    const r1 = runSimulation(input, "fixed-uuid");
    const r2 = runSimulation(input, "fixed-uuid");

    expect(r1).toEqual(r2);
  });

  it("produces identical output when input object keys are in a different insertion order", () => {
    const input = buildFullInput();
    const permuted = reverseKeyOrder(input);

    const r1 = runSimulation(input, "fixed-uuid");
    const r2 = runSimulation(permuted, "fixed-uuid");

    expect(r1).toEqual(r2);
  });

  it("exercises all 13 phases — result contains expected phase log categories", () => {
    const input = buildFullInput();
    const result = runSimulation(input, "fixed-uuid");

    const phases = new Set(result.logEntries.map((e) => e.phase));

    // Phases that emit at least one log entry given the scenario above.
    expect(phases).toContain("standardJobs"); // phase 1
    expect(phases).toContain("depositExtraction"); // phase 2
    expect(phases).toContain("construction"); // phase 3
    expect(phases).toContain("buildingUpkeep"); // phase 4
    expect(phases).toContain("passiveEffects"); // phase 5
    expect(phases).toContain("tradeRoutes"); // phase 6
    expect(phases).toContain("managedPopulations"); // phase 7
    expect(phases).toContain("citizenConsumption"); // phase 8
    expect(phases).toContain("events"); // phase 11
    expect(phases).toContain("homelessness"); // phase 10
    expect(phases).toContain("stockpileClamp"); // phase 12 (coins 498+4 > cap 500)
    // phase 13 (logsAndSnapshots) emits no log entries; checked via result fields below
    expect(result.resourceSnapshots.length).toBeGreaterThan(0);
    expect(result.settlementSnapshots.length).toBeGreaterThan(0);
  });
});
