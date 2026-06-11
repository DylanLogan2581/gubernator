import { describe, expect, it } from "vitest";

import { phasePartnerships } from "./index.ts";

import type {
  CitizenBirth,
  SimCitizen,
  SimNamingConfig,
  SimPartnership,
  SimulationContext,
  SimulationInputState,
  WorldPopulationRules,
} from "../../simulationTypes.ts";

const FOOD_ID = "food";
const WATER_ID = "water";
const SETTLEMENT_ID = "s1";

const POPULATION_RULES: WorldPopulationRules = {
  fertilityChance: 1,
  foodConsumptionPerCitizen: 0,
  homelessnessDecliningRate: 0,
  incestPreventionDepth: 0,
  maximumFertilityAgeTurns: null,
  minimumPartnershipAgeTurns: 1,
  mourningPeriodTurns: 0,
  partnershipSeekChance: 0,
  starvationSeverityMultiplier: 0,
  waterConsumptionPerCitizen: 0,
};

const NAMESET_A: SimNamingConfig = {
  convention: "family-name",
  female_given_names: ["Astrid"],
  male_given_names: ["Erik"],
  surnames: ["FromSetA"],
};

const NAMESET_B: SimNamingConfig = {
  convention: "pool",
  female_given_names: ["Mira"],
  male_given_names: ["Tomas"],
  surnames: ["FromSetB"],
};

const NAMESET_FALLBACK: SimNamingConfig = {
  convention: "pool",
  female_given_names: ["Fallback"],
  male_given_names: ["Fallback"],
  surnames: ["FallbackSurname"],
};

function makeParent(
  id: string,
  sex: "male" | "female",
  namesetId: string | null,
  surname: string | null = null,
): SimCitizen {
  return {
    bornOnTurnNumber: 0,
    citizenType: "npc",
    givenName: id,
    id,
    namesetId,
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId: SETTLEMENT_ID,
    sex,
    status: "alive",
    surname,
  };
}

function makePartnership(
  citizenAId: string,
  citizenBId: string,
): SimPartnership {
  return {
    citizenAId,
    citizenBId,
    endedOnTurnNumber: null,
    formedOnTurnNumber: 1,
    id: `p-${citizenAId}-${citizenBId}`,
    status: "active",
  };
}

function makeContext(
  overrides: Partial<SimulationInputState>,
): SimulationContext {
  const input: SimulationInputState = {
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
    citizenAssignments: [],
    citizens: [],
    constructionProjects: [],
    depositTypes: [],
    deposits: [],
    events: [],
    jobs: [],
    managedPopulationTypes: [],
    managedPopulations: [],
    npcFlavorConfig: null,
    partnerships: [],
    populationRules: POPULATION_RULES,
    settlementBuildings: [],
    settlements: [{ id: SETTLEMENT_ID, name: "Town" }],
    stockpiles: [],
    systemResourceIds: { foodId: FOOD_ID, freshWaterId: WATER_ID },
    tradeRoutes: [],
    turnNumber: 20,
    worldId: "w1",
    ...overrides,
  };
  return {
    input,
    shared: {
      pendingDeaths: new Set<string>(),
      pendingPopCapBySettlement: new Map([[SETTLEMENT_ID, 100]]),
      pendingStockpiles: new Map([
        [`${SETTLEMENT_ID}:${FOOD_ID}`, 10],
        [`${SETTLEMENT_ID}:${WATER_ID}`, 10],
      ]),
    },
  };
}

function runBirth(
  parentA: SimCitizen,
  parentB: SimCitizen,
  overrides: Partial<SimulationInputState> = {},
): CitizenBirth {
  const context = makeContext({
    citizens: [parentA, parentB],
    partnerships: [makePartnership(parentA.id, parentB.id)],
    ...overrides,
  });
  const output = phasePartnerships(context);
  expect(output.citizenBirths).toHaveLength(1);
  return output.citizenBirths[0];
}

describe("fertility — child nameset heredity", () => {
  it("child inherits a parent's nameset and is named from it", () => {
    const birth = runBirth(
      makeParent("dad", "male", "ns-a", "FromSetA"),
      makeParent("mom", "female", "ns-a", "FromSetA"),
      { namesetConfigById: { "ns-a": NAMESET_A } },
    );
    expect(birth.namesetId).toBe("ns-a");
    expect(["Erik", "Astrid"]).toContain(birth.givenName);
    expect(birth.surname).toBe("FromSetA");
  });

  it("child nameset is one of the two parents' namesets when both differ", () => {
    const birth = runBirth(
      makeParent("dad", "male", "ns-a"),
      makeParent("mom", "female", "ns-b"),
      { namesetConfigById: { "ns-a": NAMESET_A, "ns-b": NAMESET_B } },
    );
    expect(["ns-a", "ns-b"]).toContain(birth.namesetId);
  });

  it("skips a parent's nameset that is no longer valid", () => {
    const birth = runBirth(
      makeParent("dad", "male", "ns-deleted"),
      makeParent("mom", "female", "ns-b"),
      { namesetConfigById: { "ns-b": NAMESET_B } },
    );
    expect(birth.namesetId).toBe("ns-b");
    expect(["Tomas", "Mira"]).toContain(birth.givenName);
    expect(birth.surname).toBe("FromSetB");
  });

  it("falls back to the settlement's nameset when neither parent has a valid one", () => {
    const birth = runBirth(
      makeParent("dad", "male", null),
      makeParent("mom", "female", "ns-deleted"),
      {
        fallbackNamesetIdBySettlementId: { [SETTLEMENT_ID]: "ns-fallback" },
        namesetConfigById: { "ns-fallback": NAMESET_FALLBACK },
      },
    );
    expect(birth.namesetId).toBe("ns-fallback");
    expect(birth.givenName).toBe("Fallback");
    expect(birth.surname).toBe("FallbackSurname");
  });

  it("gives the child no name and no nameset when nothing is available", () => {
    const birth = runBirth(
      makeParent("dad", "male", null),
      makeParent("mom", "female", null),
      { namesetConfigById: {} },
    );
    expect(birth.namesetId).toBeNull();
    expect(birth.givenName).toBe("");
    expect(birth.surname).toBeNull();
  });

  it("patronymic surname uses the male parent's given name regardless of slot", () => {
    const config: SimNamingConfig = { ...NAMESET_A, convention: "patronymic" };
    const birth = runBirth(
      makeParent("mom", "female", "ns-a"),
      makeParent("dad", "male", "ns-a"),
      { namesetConfigById: { "ns-a": config } },
    );
    expect(birth.surname).toBe("dad");
  });

  it("matronymic surname uses the female parent's given name regardless of slot", () => {
    const config: SimNamingConfig = { ...NAMESET_A, convention: "matronymic" };
    const birth = runBirth(
      makeParent("dad", "male", "ns-a"),
      makeParent("mom", "female", "ns-a"),
      { namesetConfigById: { "ns-a": config } },
    );
    expect(birth.surname).toBe("mom");
  });

  it("family-name surname falls back to the parent that has one", () => {
    const config: SimNamingConfig = { ...NAMESET_A, convention: "family-name" };
    const birth = runBirth(
      makeParent("dad", "male", "ns-a", null),
      makeParent("mom", "female", "ns-a", "OnlySurname"),
      { namesetConfigById: { "ns-a": config } },
    );
    expect(birth.surname).toBe("OnlySurname");
  });

  it("none convention leaves the surname empty", () => {
    const config: SimNamingConfig = { ...NAMESET_A, convention: "none" };
    const birth = runBirth(
      makeParent("dad", "male", "ns-a", "HasSurname"),
      makeParent("mom", "female", "ns-a", "HasSurname"),
      { namesetConfigById: { "ns-a": config } },
    );
    expect(birth.surname).toBeNull();
  });
});
