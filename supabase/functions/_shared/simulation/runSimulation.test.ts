import { describe, expect, it } from "vitest";

import { runSimulation } from "./runSimulation.ts";

import type {
  SimBuildingBlueprint,
  SimBuildingTier,
  SimCitizen,
  SimSettlement,
  SimStockpile,
  SimulationInputState,
} from "./simulationTypes.ts";

// ---------------------------------------------------------------------------
// Shared test helpers
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

const BASE_POPULATION_RULES: SimulationInputState["populationRules"] = {
  fertilityChance: 0,
  foodConsumptionPerCitizen: 0,
  homelessnessDecliningRate: 0,
  incestPreventionDepth: 0,
  maximumFertilityAgeTurns: null,
  minimumPartnershipAgeTurns: 0,
  mourningPeriodTurns: 0,
  partnershipSeekChance: 1.0,
  starvationSeverityMultiplier: 0,
  waterConsumptionPerCitizen: 0,
};

function makeInput(
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
    populationRules: BASE_POPULATION_RULES,
    resources: [],
    settlementBuildings: [],
    settlements: [{ id: "s1", name: "Testville" }],
    stockpiles: [],
    systemResourceIds: { foodId: "food", freshWaterId: "water" },
    tradeRoutes: [],
    turnNumber: 5,
    worldId: "w1",
    ...overrides,
  };
}

function makeSettlement(id: string): SimSettlement {
  return { id, name: id };
}

function makeMaleNpc(id: string, settlementId: string): SimCitizen {
  return {
    bornOnTurnNumber: 1,
    citizenType: "npc",
    givenName: id,
    id,
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId,
    sex: "male",
    status: "alive",
    surname: null,
  };
}

function makeFemaleNpc(id: string, settlementId: string): SimCitizen {
  return {
    bornOnTurnNumber: 1,
    citizenType: "npc",
    givenName: id,
    id,
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId,
    sex: "female",
    status: "alive",
    surname: null,
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

function makeBuildingBlueprint(): SimBuildingBlueprint {
  return {
    id: "bp1",
    name: "Housing",
    tiers: [{ populationCapIncrease: 10, tier: 1 }],
  };
}

function makeBuildingTier(): SimBuildingTier {
  return {
    buildingBlueprintId: "bp1",
    constructionCostsJson: [],
    effectsJson: [
      {
        amount: 1,
        resourceId: null,
        type: "population_cap_increase",
      },
    ],
    id: "tier1",
    tierNumber: 1,
    upkeepCostsJson: [],
    workerTurnsRequired: 0,
  };
}

// ---------------------------------------------------------------------------
// Partnership + homelessness interaction
// ---------------------------------------------------------------------------

describe("runSimulation — partnership formed then dies in homelessness same turn", () => {
  it("drops phantom partnership log/notification/snapshot count when partner dies in phase 10", () => {
    // Setup: two citizens, no population cap, high homelessness rate.
    // Expected: phase 9 forms partnership, phase 10 kills the younger citizen.
    // Result: no partnership.formed log, notification, or count in snapshot.

    const input = makeInput({
      settlements: [makeSettlement("s1")],
      citizens: [makeMaleNpc("male1", "s1"), makeFemaleNpc("female1", "s1")],
      buildingBlueprints: [makeBuildingBlueprint()],
      buildingTiers: [makeBuildingTier()],
      settlementBuildings: [
        {
          id: "b1",
          settlementId: "s1",
          currentTierId: "tier1",
          state: "active",
        },
      ],
      stockpiles: [
        makeStockpile("s1", "food", 100),
        makeStockpile("s1", "water", 100),
      ],
      populationRules: {
        ...BASE_POPULATION_RULES,
        // 1 population cap + 100% declining rate = 1 homeless citizen dies
        homelessnessDecliningRate: 1.0,
        partnershipSeekChance: 1.0,
      },
    });

    const result = runSimulation(input, "form-then-die-uuid");

    // Verify no partnership.formed logs
    const partnershipLogs = result.logEntries.filter(
      (log) => log.category === "partnership.formed",
    );
    expect(partnershipLogs).toHaveLength(0);

    // Verify no partnership.formed notifications
    const partnershipNotifs = result.notifications.filter(
      (notif) => notif.notificationType === "partnership.formed",
    );
    expect(partnershipNotifs).toHaveLength(0);

    // Verify partnershipsFormedCount is 0 in snapshot
    const snapshot = result.settlementSnapshots.find(
      (s) => s.settlementId === "s1",
    );
    expect(snapshot).toBeDefined();
    if (snapshot !== undefined) {
      expect(snapshot.partnershipsFormedCount).toBe(0);
    }

    // Verify one citizen died (from homelessness in phase 10)
    expect(result.citizenDeaths).toHaveLength(1);
    expect(result.citizenDeaths[0].category).toBe("homeless");

    // Verify no partnership changes persisted
    expect(result.partnershipChanges).toHaveLength(0);
  });
});
