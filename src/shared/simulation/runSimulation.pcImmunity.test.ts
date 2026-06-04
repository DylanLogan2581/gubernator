// PC immunity regression guard for runSimulation.
//
// Verifies that player characters (citizenType === "player_character") never
// appear in citizenDeaths regardless of how lethal a scenario is for NPCs.
//
// Four independent scenarios covering every simulation death path:
//  1. Starvation — zero food, high starvation multiplier (phaseCitizenConsumption)
//  2. Homelessness — cap = 0 and decline_rate = 1 (phaseHomelessness)
//  3. Managed-population extinction clears a PC herder's assignment but does not kill them
//  4. Building auto-deconstruct + existing homelessness overage in the same turn
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { describe, expect, it } from "vitest";

import { runSimulation } from "./runSimulation.ts";

import type {
  SimBuildingBlueprint,
  SimBuildingTier,
  SimCitizen,
  SimCitizenAssignment,
  SimManagedPopulation,
  SimManagedPopulationType,
  SimSettlement,
  SimSettlementBuilding,
  SimStockpile,
  SimulationInputState,
} from "./simulationTypes.ts";

// ---------------------------------------------------------------------------
// Shared fixtures
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

const ZERO_POP_RULES: SimulationInputState["populationRules"] = {
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

function makePc(id: string, settlementId: string): SimCitizen {
  return {
    bornOnTurnNumber: 1,
    citizenType: "player_character",
    id,
    name: id,
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId,
    sex: "male",
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

function baseInput(
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
    populationRules: ZERO_POP_RULES,
    settlementBuildings: [],
    settlementId: "s1",
    settlements: [makeSettlement("s1")],
    stockpiles: [],
    systemResourceIds: { foodId: "food", freshWaterId: "water" },
    tradeRoutes: [],
    turnNumber: 5,
    worldId: "w1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Scenario 1: starvation severe enough to kill every NPC — PC survives
// ---------------------------------------------------------------------------

describe("runSimulation — PC immunity: starvation", () => {
  it("PC is never selected for starvation death even when the food deficit is total", () => {
    // 5 NPCs + 1 PC; zero food; starvation multiplier high enough to kill all NPCs.
    const npcs = ["n1", "n2", "n3", "n4", "n5"].map((id) => makeNpc(id, "s1"));
    const pc = makePc("pc1", "s1");

    const input = baseInput({
      citizens: [...npcs, pc],
      stockpiles: [
        makeStockpile("s1", "food", 0),
        makeStockpile("s1", "water", 1000),
      ],
      populationRules: {
        ...ZERO_POP_RULES,
        foodConsumptionPerCitizen: 10, // each citizen requires 10 food
        starvationSeverityMultiplier: 999, // extreme — kills all eligible NPCs
      },
    });

    const result = runSimulation(input, "pc-immunity-starvation");

    const deadIds = new Set(result.citizenDeaths.map((d) => d.citizenId));

    // Starvation must have fired — at least one NPC killed, confirming the
    // scenario was actually lethal.
    expect(deadIds.size).toBeGreaterThan(0);
    expect(result.citizenDeaths.some((d) => d.category === "starvation")).toBe(
      true,
    );

    // PC must not appear in any death record.
    expect(deadIds.has("pc1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: homelessness with cap=0 and decline_rate=1 — PC survives
// ---------------------------------------------------------------------------

describe("runSimulation — PC immunity: homelessness", () => {
  it("PC is never selected for homeless death when cap=0 and decline_rate=1", () => {
    // 5 NPCs + 1 PC; no buildings → pop cap = 0; every overage NPC dies.
    const npcs = ["n1", "n2", "n3", "n4", "n5"].map((id) => makeNpc(id, "s1"));
    const pc = makePc("pc1", "s1");

    const input = baseInput({
      citizens: [...npcs, pc],
      populationRules: {
        ...ZERO_POP_RULES,
        homelessnessDecliningRate: 1,
      },
    });

    const result = runSimulation(input, "pc-immunity-homelessness");

    const deadIds = new Set(result.citizenDeaths.map((d) => d.citizenId));

    // Homelessness must have fired — all 5 NPCs exceed cap 0.
    expect(deadIds.size).toBeGreaterThan(0);
    expect(result.citizenDeaths.some((d) => d.category === "homeless")).toBe(
      true,
    );

    // PC must survive.
    expect(deadIds.has("pc1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: managed-population extinction clears PC herder assignment
//             but does NOT kill the PC
// ---------------------------------------------------------------------------

describe("runSimulation — PC immunity: managed-population extinction", () => {
  it("PC herder's assignment is cleared on extinction but the PC is not killed", () => {
    const pc = makePc("pc-herder", "s1");

    const popTypeId = "pt-cattle";
    const popId = "pop-cattle-1";
    const husbandryJobId = "job-husbandry";

    // growthRate=1; husbandryWorkersPerNAnimals=1000 → PC alone provides
    // coverage ≈ 0.001, so the herd is not fully supported and declines by
    // ceil(1 * 1) = 1, reaching 0 → extinct this turn.
    const popType: SimManagedPopulationType = {
      cullingJobId: "job-culling",
      cullingOutputsJson: [],
      growthRate: 1,
      husbandryJobId,
      husbandryWorkersPerNAnimals: 1000,
      id: popTypeId,
      maintenanceRulesJson: [],
      name: "Cattle",
    };

    const pop: SimManagedPopulation = {
      configuredCullQuantity: 0,
      currentCount: 1,
      id: popId,
      managedPopulationTypeId: popTypeId,
      name: "Cattle Herd",
      settlementId: "s1",
      status: "active",
    };

    const assignment: SimCitizenAssignment = {
      assignedOnTurnNumber: 1,
      assignmentType: "husbandry",
      citizenId: pc.id,
      constructionProjectId: null,
      depositInstanceId: null,
      jobId: husbandryJobId,
      managedPopulationInstanceId: popId,
      tradeRouteEnd: null,
      tradeRouteId: null,
    };

    const input = baseInput({
      citizens: [pc],
      citizenAssignments: [assignment],
      managedPopulationTypes: [popType],
      managedPopulations: [pop],
    });

    const result = runSimulation(input, "pc-immunity-pop-extinction");

    // Population must have gone extinct this turn.
    const popUpdate = result.managedPopulationUpdates.find(
      (u) => u.managedPopulationInstanceId === popId,
    );
    expect(popUpdate?.toStatus).toBe("extinct");

    // PC assignment must be cleared (expected engine bookkeeping).
    expect(result.assignmentClears.some((a) => a.citizenId === pc.id)).toBe(
      true,
    );

    // PC must NOT appear in citizenDeaths.
    const deadIds = new Set(result.citizenDeaths.map((d) => d.citizenId));
    expect(deadIds.has(pc.id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: building auto-deconstruct + homelessness in same turn — PC survives
// ---------------------------------------------------------------------------

describe("runSimulation — PC immunity: building auto-deconstruct + homelessness", () => {
  it("PC survives the homelessness pass in a turn where a cap building also auto-deconstructs", () => {
    // The barracks provides population_cap_increase=2 but cannot pay its iron
    // upkeep (gracePeriodTurns=0 → auto_deconstructed in phase 4).
    // Phase 10 (homelessness) reads the original input where the building is
    // still "active", so effective cap = 2.  With 4 alive NPCs, overage = 2
    // and decline_rate = 1 kills exactly 2 NPCs.  The PC is never a candidate.

    const bpId = "bp-barracks";
    const tierId = "tier-barracks-t1";
    const buildingId = "bld-barracks";

    const blueprint: SimBuildingBlueprint = {
      gracePeriodTurns: 0,
      id: bpId,
      maxInstancesPerSettlement: null,
      name: "Barracks",
    };

    const tier: SimBuildingTier = {
      buildingBlueprintId: bpId,
      constructionCostsJson: [],
      effectsJson: [{ amount: 2, type: "population_cap_increase" }],
      id: tierId,
      tierNumber: 1,
      upkeepCostsJson: [{ amount: 10, resourceId: "iron" }],
      workerTurnsRequired: 10,
    };

    const building: SimSettlementBuilding = {
      activatedOnTurnNumber: 1,
      buildingBlueprintId: bpId,
      currentTierId: tierId,
      id: buildingId,
      missedUpkeepCount: 0,
      settlementId: "s1",
      sourceProjectId: null,
      state: "active",
    };

    // 4 NPCs + 1 PC; iron stockpile is empty so the barracks cannot pay upkeep.
    const npcs = ["n1", "n2", "n3", "n4"].map((id) => makeNpc(id, "s1"));
    const pc = makePc("pc1", "s1");

    const input = baseInput({
      buildingBlueprints: [blueprint],
      buildingTiers: [tier],
      settlementBuildings: [building],
      citizens: [...npcs, pc],
      stockpiles: [makeStockpile("s1", "iron", 0)],
      populationRules: {
        ...ZERO_POP_RULES,
        homelessnessDecliningRate: 1,
      },
    });

    const result = runSimulation(input, "pc-immunity-auto-deconstruct");

    // Phase 4 must have auto-deconstructed the barracks.
    const stateChange = result.buildingStateChanges.find(
      (c) => c.settlementBuildingId === buildingId,
    );
    expect(stateChange?.toState).toBe("auto_deconstructed");

    // Phase 10 must have killed exactly 2 NPCs (overage: 4 NPCs − cap 2 = 2,
    // rate 1 → ceil(2 × 1) = 2 deaths).
    const homelessDeaths = result.citizenDeaths.filter(
      (d) => d.category === "homeless",
    );
    expect(homelessDeaths.length).toBe(2);
    expect(homelessDeaths.every((d) => d.citizenId !== "pc1")).toBe(true);

    // PC must survive.
    const deadIds = new Set(result.citizenDeaths.map((d) => d.citizenId));
    expect(deadIds.has("pc1")).toBe(false);
  });
});
