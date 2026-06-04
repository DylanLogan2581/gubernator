// Cross-phase stockpile-flow tests — verifies that the shared pendingStockpiles
// map carries running totals between phases rather than each phase re-reading
// the pre-turn input quantities.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { describe, expect, it } from "vitest";

import { runSimulation } from "./runSimulation.ts";

import type {
  SimBuildingBlueprint,
  SimBuildingTier,
  SimCitizen,
  SimCitizenAssignment,
  SimJob,
  SimPartnership,
  SimSettlementBuilding,
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
  minimumPartnershipAgeTurns: 999,
  mourningPeriodTurns: 0,
  partnershipSeekChance: 0,
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
    deconstructOvershootLedger: [],
    depositTypes: [],
    deposits: [],
    events: [],
    jobs: [],
    managedPopulationTypes: [],
    managedPopulations: [],
    partnerships: [],
    populationRules: BASE_POPULATION_RULES,
    settlementBuildings: [],
    settlementId: "s1",
    settlements: [{ id: "s1", name: "Testville" }],
    stockpiles: [],
    systemResourceIds: { foodId: "food", freshWaterId: "water" },
    tradeRoutes: [],
    turnNumber: 5,
    worldId: "w1",
    ...overrides,
  };
}

function makeStockpile(
  settlementId: string,
  resourceId: string,
  quantity: number,
  cap = 1000,
): SimStockpile {
  return { cap, quantity, resourceId, settlementId };
}

function makeNpc(
  id: string,
  settlementId: string,
  sex: "male" | "female" = "female",
): SimCitizen {
  return {
    bornOnTurnNumber: 1,
    citizenType: "npc",
    id,
    name: id,
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId,
    sex,
    status: "alive",
  };
}

function makeJob(
  id: string,
  inputs: { resourceId: string; amountPerWorker: number }[],
  outputs: { resourceId: string; amountPerWorker: number }[],
): SimJob {
  return {
    baseCapacity: null,
    id,
    inputsJson: inputs,
    jobType: "standard",
    linkedDepositTypeId: null,
    linkedManagedPopulationTypeId: null,
    name: id,
    outputsJson: outputs,
    traderCapacityPerWorker: null,
  };
}

function makeStandardAssignment(
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

function makeBlueprint(
  id: string,
  gracePeriodTurns: number,
): SimBuildingBlueprint {
  return { gracePeriodTurns, id, maxInstancesPerSettlement: null, name: id };
}

function makeTier(
  id: string,
  blueprintId: string,
  opts: {
    upkeepCosts?: { resourceId: string; amount: number }[];
    effects?: SimBuildingTier["effectsJson"];
  } = {},
): SimBuildingTier {
  return {
    buildingBlueprintId: blueprintId,
    constructionCostsJson: [],
    effectsJson: opts.effects ?? [],
    id,
    tierNumber: 1,
    upkeepCostsJson: opts.upkeepCosts ?? [],
    workerTurnsRequired: 1,
  };
}

function makeBuilding(
  id: string,
  settlementId: string,
  tierId: string,
  blueprintId: string,
  opts: {
    missedUpkeepCount?: number;
    state?: SimSettlementBuilding["state"];
  } = {},
): SimSettlementBuilding {
  return {
    activatedOnTurnNumber: 1,
    buildingBlueprintId: blueprintId,
    currentTierId: tierId,
    id,
    missedUpkeepCount: opts.missedUpkeepCount ?? 0,
    settlementId,
    sourceProjectId: null,
    state: opts.state ?? "active",
  };
}

function makePartnership(
  id: string,
  citizenAId: string,
  citizenBId: string,
): SimPartnership {
  return {
    citizenAId,
    citizenBId,
    endedOnTurnNumber: null,
    formedOnTurnNumber: 1,
    id,
    status: "active",
  };
}

// ---------------------------------------------------------------------------
// Cross-phase test 1: phase 1 job consumption depletes the phase 4 upkeep budget
// ---------------------------------------------------------------------------

describe("cross-phase stockpile flow", () => {
  describe("phase 1 consumption reaches phase 4 upkeep budget", () => {
    it("building is suspended when a phase-1 job consumes all lumber before phase 4 runs", () => {
      // Phase 1 job consumes 100 lumber. Stockpile starts at 100.
      // Phase 4 upkeep needs 50 lumber. With shared state: 0 remaining → suspended.
      // Without shared state (bug): phase 4 would see 100 → pays → stays active.
      const job = makeJob(
        "lumberjob",
        [{ resourceId: "lumber", amountPerWorker: 100 }],
        [],
      );
      const blueprint = makeBlueprint("bp1", 5);
      const tier = makeTier("t1", "bp1", {
        upkeepCosts: [{ resourceId: "lumber", amount: 50 }],
      });
      const building = makeBuilding("b1", "s1", "t1", "bp1");

      const input = makeInput({
        buildingBlueprints: [blueprint],
        buildingTiers: [tier],
        citizenAssignments: [makeStandardAssignment("c1", "lumberjob")],
        citizens: [makeNpc("c1", "s1")],
        jobs: [job],
        settlementBuildings: [building],
        stockpiles: [makeStockpile("s1", "lumber", 100)],
      });

      const result = runSimulation(input, "cross-phase-test-1");

      const buildingChange = result.buildingStateChanges.find(
        (c) => c.settlementBuildingId === "b1",
      );
      expect(buildingChange).toBeDefined();
      expect(buildingChange?.toState).toBe("suspended");
    });

    it("building stays active when phase-1 produces enough lumber for phase-4 upkeep", () => {
      // Phase 1 job produces 200 lumber. Stockpile starts at 0.
      // Phase 4 upkeep needs 50 lumber. With shared state: 200 available → pays.
      const job = makeJob(
        "lumberjob",
        [],
        [{ resourceId: "lumber", amountPerWorker: 200 }],
      );
      const blueprint = makeBlueprint("bp1", 5);
      const tier = makeTier("t1", "bp1", {
        upkeepCosts: [{ resourceId: "lumber", amount: 50 }],
      });
      // A second building that is the subject of upkeep (the one producing can't self-pay
      // because it isn't built yet — use a separate static building for the upkeep target).
      const upkeepBuilding = makeBuilding("b-upkeep", "s1", "t1", "bp1");

      const input = makeInput({
        buildingBlueprints: [blueprint],
        buildingTiers: [tier],
        citizenAssignments: [makeStandardAssignment("c1", "lumberjob")],
        citizens: [makeNpc("c1", "s1")],
        jobs: [job],
        settlementBuildings: [upkeepBuilding],
        stockpiles: [makeStockpile("s1", "lumber", 0)],
      });

      const result = runSimulation(input, "cross-phase-test-2");

      const buildingChange = result.buildingStateChanges.find(
        (c) => c.settlementBuildingId === "b-upkeep",
      );
      // No state change means the building paid successfully.
      expect(buildingChange).toBeUndefined();
    });

    it("two sequential upkeep buildings: first exhausts remainder, second is suspended", () => {
      // Stockpile: 100 lumber. Phase 1 consumes 60 → 40 remaining.
      // Building b1 needs 40 → pays → 0 remaining.
      // Building b2 needs 40 → cannot pay → suspended.
      const job = makeJob(
        "job",
        [{ resourceId: "lumber", amountPerWorker: 60 }],
        [],
      );
      const blueprint = makeBlueprint("bp1", 5);
      const tier = makeTier("t1", "bp1", {
        upkeepCosts: [{ resourceId: "lumber", amount: 40 }],
      });
      const b1 = makeBuilding("b1", "s1", "t1", "bp1");
      const b2 = makeBuilding("b2", "s1", "t1", "bp1");

      const input = makeInput({
        buildingBlueprints: [blueprint],
        buildingTiers: [tier],
        citizenAssignments: [makeStandardAssignment("c1", "job")],
        citizens: [makeNpc("c1", "s1")],
        jobs: [job],
        settlementBuildings: [b1, b2],
        stockpiles: [makeStockpile("s1", "lumber", 100)],
      });

      const result = runSimulation(input, "cross-phase-test-3");

      const changedIds = result.buildingStateChanges.map(
        (c) => c.settlementBuildingId,
      );
      // Exactly one building suspended (b2); b1 paid.
      expect(changedIds).toHaveLength(1);
      expect(changedIds[0]).toBe("b2");
      expect(result.buildingStateChanges[0]?.toState).toBe("suspended");
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-phase test 2a: phase-8 starvation deaths reduce phase-10 overage
  // ---------------------------------------------------------------------------

  describe("phase-8 starvation deaths reduce phase-10 homeless overage", () => {
    it("no homeless deaths when starvation kills the only NPC above the population cap", () => {
      // Setup:
      //   - cap=2 (barracks building with population_cap_increase 2)
      //   - 3 alive NPCs → raw overage=1 → rate=1 → normally 1 homeless death
      //   - starvation is configured to kill exactly 1 NPC (severity=1, food=0)
      //   - phase 8 kills 1 NPC (c1, eldest); pendingDeaths={c1}
      //   - phase 10 effective alive=2 = cap → overage=0 → no homeless deaths
      //
      // Without the fix: phase 10 reads input.citizens (3 alive) → overage=1 → 1 homeless death.
      // With the fix: phase 10 subtracts pendingDeaths → effective alive=2 → no homeless deaths.
      const blueprint = makeBlueprint("cap-bp", 5);
      const tier = makeTier("cap-tier", "cap-bp", {
        effects: [{ type: "population_cap_increase", amount: 2 }],
      });
      const capBuilding = makeBuilding("cap-b1", "s1", "cap-tier", "cap-bp");

      const c1 = {
        bornOnTurnNumber: 1,
        citizenType: "npc" as const,
        id: "c1",
        name: "c1",
        parentACitizenId: null,
        parentBCitizenId: null,
        settlementId: "s1",
        sex: "male",
        status: "alive" as const,
      };
      const c2 = { ...c1, id: "c2", name: "c2", bornOnTurnNumber: 2 };
      const c3 = { ...c1, id: "c3", name: "c3", bornOnTurnNumber: 3 };

      const input = makeInput({
        buildingBlueprints: [blueprint],
        buildingTiers: [tier],
        citizens: [c1, c2, c3],
        populationRules: {
          ...BASE_POPULATION_RULES,
          // Each citizen needs 1 food; stockpile=0 → deficit=1 → kills floor(1 * 1 * 3) = 3 NPCs.
          // We only want 1 death (to land at overage==0 after phase 10), so we use a very low
          // severity multiplier: floor(1 * 0.1 * 3) = floor(0.3) = 0 — that's too low.
          // Instead use severity=0.4: floor(1 * 0.4 * 3) = floor(1.2) = 1 starvation death.
          foodConsumptionPerCitizen: 1,
          homelessnessDecliningRate: 1,
          starvationSeverityMultiplier: 0.4,
          waterConsumptionPerCitizen: 0,
        },
        settlementBuildings: [capBuilding],
        // No food → full deficit; 1 NPC starves in phase 8.
        stockpiles: [makeStockpile("s1", "food", 0)],
        systemResourceIds: { foodId: "food", freshWaterId: "water" },
      });

      const result = runSimulation(input, "cross-phase-death-test-1");

      // Exactly 1 starvation death (c1, eldest) from phase 8.
      const starvationDeaths = result.citizenDeaths.filter(
        (d) => d.category === "starvation",
      );
      expect(starvationDeaths).toHaveLength(1);
      expect(starvationDeaths[0]?.citizenId).toBe("c1");

      // No homeless deaths — phase 10 saw effective alive=2 = cap.
      const homelessDeaths = result.citizenDeaths.filter(
        (d) => d.category === "homeless",
      );
      expect(homelessDeaths).toHaveLength(0);
    });

    it("total deaths equal starvation-only when starved citizens bring alive count to cap", () => {
      // Mirror of the above: total citizenDeaths count is exactly the starvation count.
      const blueprint = makeBlueprint("cap-bp", 5);
      const tier = makeTier("cap-tier", "cap-bp", {
        effects: [{ type: "population_cap_increase", amount: 2 }],
      });
      const capBuilding = makeBuilding("cap-b1", "s1", "cap-tier", "cap-bp");

      const c1 = {
        bornOnTurnNumber: 1,
        citizenType: "npc" as const,
        id: "c1",
        name: "c1",
        parentACitizenId: null,
        parentBCitizenId: null,
        settlementId: "s1",
        sex: "male",
        status: "alive" as const,
      };
      const c2 = { ...c1, id: "c2", name: "c2", bornOnTurnNumber: 2 };
      const c3 = { ...c1, id: "c3", name: "c3", bornOnTurnNumber: 3 };

      const input = makeInput({
        buildingBlueprints: [blueprint],
        buildingTiers: [tier],
        citizens: [c1, c2, c3],
        populationRules: {
          ...BASE_POPULATION_RULES,
          foodConsumptionPerCitizen: 1,
          homelessnessDecliningRate: 1,
          starvationSeverityMultiplier: 0.4,
          waterConsumptionPerCitizen: 0,
        },
        settlementBuildings: [capBuilding],
        stockpiles: [makeStockpile("s1", "food", 0)],
        systemResourceIds: { foodId: "food", freshWaterId: "water" },
      });

      const result = runSimulation(input, "cross-phase-death-test-2");

      expect(result.citizenDeaths).toHaveLength(1);
      expect(result.citizenDeaths[0]?.category).toBe("starvation");
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-phase test 2: phase 4 auto-deconstruct does not contribute to phase 9
  // fertility population cap
  // ---------------------------------------------------------------------------

  describe("phase 4 auto-deconstruct does not inflate phase 9 fertility cap", () => {
    it("no births when the only pop-cap building is auto-deconstructed in phase 4", () => {
      // Setup:
      //   - One building with grace=0 (auto-deconstructs on first missed upkeep)
      //     and a population_cap_increase of 10.
      //   - No resources → upkeep cannot be paid → building auto-deconstructs in phase 4.
      //   - Two partnered fertile citizens in the settlement.
      //   - fertilityChance = 1.0 so birth would be guaranteed IF cap > 0.
      //   - After deconstruction, cap = 0; 2 alive >= 0 → no fertility roll.
      //
      // Without the fix: phase 9 reads input.settlementBuildings (state="active") → cap=10,
      // 2 alive < 10 → birth occurs. With the fix: cap=0 → no birth.

      const blueprint = makeBlueprint("cap-bp", 0); // grace=0 → deconstruct on first miss
      const tier = makeTier("cap-tier", "cap-bp", {
        upkeepCosts: [{ resourceId: "stone", amount: 1 }],
        effects: [{ type: "population_cap_increase", amount: 10 }],
      });
      const capBuilding = makeBuilding("cap-b1", "s1", "cap-tier", "cap-bp", {
        missedUpkeepCount: 0,
      });

      const male = makeNpc("c-male", "s1", "male");
      const female = makeNpc("c-female", "s1", "female");
      const partnership = makePartnership("p1", "c-male", "c-female");

      const input = makeInput({
        buildingBlueprints: [blueprint],
        buildingTiers: [tier],
        citizens: [male, female],
        partnerships: [partnership],
        populationRules: {
          ...BASE_POPULATION_RULES,
          fertilityChance: 1,
          foodConsumptionPerCitizen: 0,
          minimumPartnershipAgeTurns: 0,
          waterConsumptionPerCitizen: 0,
        },
        settlementBuildings: [capBuilding],
        // No stone stockpile → upkeep fails → auto-deconstruct
        stockpiles: [
          makeStockpile("s1", "food", 1000),
          makeStockpile("s1", "water", 1000),
        ],
        systemResourceIds: { foodId: "food", freshWaterId: "water" },
        turnNumber: 5,
      });

      const result = runSimulation(input, "cross-phase-cap-test-1");

      // Building must have been auto-deconstructed in phase 4.
      const deconstructed = result.buildingStateChanges.find(
        (c) =>
          c.settlementBuildingId === "cap-b1" &&
          c.toState === "auto_deconstructed",
      );
      expect(deconstructed).toBeDefined();

      // No births because pop cap dropped to 0.
      expect(result.citizenBirths).toHaveLength(0);
    });

    it("invariant: no citizen born in phase 9 is killed in phase 10 of the same turn", () => {
      // Babies born in phase 9 are CitizenBirth records without a citizen ID — they
      // are pending DB inserts. phaseHomelessness (phase 10) kills by citizen ID from
      // context.input.citizens, so a baby cannot appear in citizenDeaths.
      //
      // This test constructs the exact scenario described in issue #503:
      //   - A cap building that auto-deconstructs in phase 4 (grace=0, no upkeep resource).
      //   - fertilityChance=1, so a birth is guaranteed if the cap check passes.
      //   - With the fix, pendingPopCapBySettlement drops to 0 after phase 4; phase 9
      //     sees cap=0, 2 alive ≥ 0 → no birth.
      //   - Without the fix, phase 9 would read input.settlementBuildings (state=active)
      //     → cap=10, 2 alive < 10 → birth fires; that baby would push next-turn alive
      //     count over the now-correct cap of 0.
      const blueprint = makeBlueprint("cap-bp", 0);
      const tier = makeTier("cap-tier", "cap-bp", {
        upkeepCosts: [{ resourceId: "stone", amount: 1 }],
        effects: [{ type: "population_cap_increase", amount: 10 }],
      });
      const capBuilding = makeBuilding("cap-b1", "s1", "cap-tier", "cap-bp");

      const male = makeNpc("c-male", "s1", "male");
      const female = makeNpc("c-female", "s1", "female");
      const partnership = makePartnership("p1", "c-male", "c-female");

      const input = makeInput({
        buildingBlueprints: [blueprint],
        buildingTiers: [tier],
        citizens: [male, female],
        partnerships: [partnership],
        populationRules: {
          ...BASE_POPULATION_RULES,
          fertilityChance: 1,
          minimumPartnershipAgeTurns: 0,
        },
        settlementBuildings: [capBuilding],
        stockpiles: [
          makeStockpile("s1", "food", 1000),
          makeStockpile("s1", "water", 1000),
        ],
        systemResourceIds: { foodId: "food", freshWaterId: "water" },
        turnNumber: 5,
      });

      const result = runSimulation(
        input,
        "cross-phase-birth-homeless-invariant",
      );

      // Phase 4 must have auto-deconstructed the cap building.
      const deconstructed = result.buildingStateChanges.find(
        (c) =>
          c.settlementBuildingId === "cap-b1" &&
          c.toState === "auto_deconstructed",
      );
      expect(deconstructed).toBeDefined();

      // Phase 9 must have seen cap=0 → no births.
      expect(result.citizenBirths).toHaveLength(0);

      // No citizen born this turn can appear in citizenDeaths.
      // CitizenBirth records carry no id; all deaths reference ids from input.citizens.
      const inputCitizenIds = new Set(input.citizens.map((c) => c.id));
      for (const death of result.citizenDeaths) {
        expect(inputCitizenIds.has(death.citizenId)).toBe(true);
      }
    });

    it("births occur when pop-cap building pays upkeep and remains active", () => {
      // Same setup but with enough stone to pay upkeep.
      // Building stays active → cap=10 > 2 alive → fertility roll at 1.0 → birth.
      const blueprint = makeBlueprint("cap-bp", 0);
      const tier = makeTier("cap-tier", "cap-bp", {
        upkeepCosts: [{ resourceId: "stone", amount: 1 }],
        effects: [{ type: "population_cap_increase", amount: 10 }],
      });
      const capBuilding = makeBuilding("cap-b1", "s1", "cap-tier", "cap-bp");

      const male = makeNpc("c-male", "s1", "male");
      const female = makeNpc("c-female", "s1", "female");
      const partnership = makePartnership("p1", "c-male", "c-female");

      const input = makeInput({
        buildingBlueprints: [blueprint],
        buildingTiers: [tier],
        citizens: [male, female],
        partnerships: [partnership],
        populationRules: {
          ...BASE_POPULATION_RULES,
          fertilityChance: 1,
          foodConsumptionPerCitizen: 0,
          minimumPartnershipAgeTurns: 0,
          waterConsumptionPerCitizen: 0,
        },
        settlementBuildings: [capBuilding],
        stockpiles: [
          makeStockpile("s1", "stone", 100), // enough to pay upkeep
          makeStockpile("s1", "food", 1000),
          makeStockpile("s1", "water", 1000),
        ],
        systemResourceIds: { foodId: "food", freshWaterId: "water" },
        turnNumber: 5,
      });

      const result = runSimulation(input, "cross-phase-cap-test-2");

      // Building must stay active (no state change).
      const stateChange = result.buildingStateChanges.find(
        (c) => c.settlementBuildingId === "cap-b1",
      );
      expect(stateChange).toBeUndefined();

      // Birth occurs because cap=10 > 2 alive.
      expect(result.citizenBirths).toHaveLength(1);
    });
  });
});
