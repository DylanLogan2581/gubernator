import { describe, expect, it } from "vitest";

import { phaseCitizenConsumption } from "./phaseCitizenConsumption.ts";

import type {
  SimCitizen,
  SimSettlement,
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

const FOOD_ID = "food-resource-id";
const WATER_ID = "water-resource-id";

const BASE_POPULATION_RULES: SimulationInputState["populationRules"] = {
  fertilityChance: 0,
  foodConsumptionPerCitizen: 1,
  homelessnessDecliningRate: 0,
  incestPreventionDepth: 0,
  maximumFertilityAgeTurns: null,
  minimumPartnershipAgeTurns: 0,
  mourningPeriodTurns: 0,
  partnershipSeekChance: 0,
  starvationSeverityMultiplier: 1,
  waterConsumptionPerCitizen: 1,
};

function makeSettlement(id: string, name = id): SimSettlement {
  return { id, name };
}

function makeNpc(
  id: string,
  settlementId: string,
  bornOnTurnNumber: number | null = 1,
): SimCitizen {
  return {
    bornOnTurnNumber,
    citizenType: "npc",
    id,
    name: id,
    parentACitizenId: null,
    parentBCitizenId: null,
    settlementId,
    sex: "male",
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
    sex: "female",
    status: "alive",
  };
}

function makeStockpile(
  settlementId: string,
  resourceId: string,
  quantity: number,
): SimStockpile {
  return { cap: 999999, quantity, resourceId, settlementId };
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
    populationRules: BASE_POPULATION_RULES,
    settlementBuildings: [],
    settlementId: "s1",
    settlements: [makeSettlement("s1")],
    stockpiles: [],
    systemResourceIds: { foodId: FOOD_ID, freshWaterId: WATER_ID },
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
    shared: {
      pendingDeaths: new Set<string>(),
      pendingPopCapBySettlement: new Map(),
      pendingStockpiles,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseCitizenConsumption", () => {
  describe("no shortage — no deaths", () => {
    it("returns no deaths when stockpiles fully cover food and water", () => {
      const ctx = makeContext({
        citizens: [makeNpc("c1", "s1"), makeNpc("c2", "s1")],
        // 2 alive × 1 each = 2 food, 2 water required; 100 available
        stockpiles: [
          makeStockpile("s1", FOOD_ID, 100),
          makeStockpile("s1", WATER_ID, 100),
        ],
      });

      const result = phaseCitizenConsumption(ctx);

      expect(result.citizenDeaths).toHaveLength(0);
      expect(result.notifications).toHaveLength(0);
      // Consumption log emitted even without shortage
      expect(
        result.logs.filter((l) => l.category === "citizen.consumed_food_water"),
      ).toHaveLength(1);
    });

    it("deducts correct consumption from stockpiles when fully covered", () => {
      const ctx = makeContext({
        citizens: [
          makeNpc("c1", "s1"),
          makeNpc("c2", "s1"),
          makeNpc("c3", "s1"),
        ],
        stockpiles: [
          makeStockpile("s1", FOOD_ID, 50),
          makeStockpile("s1", WATER_ID, 50),
        ],
      });

      const result = phaseCitizenConsumption(ctx);

      const foodDelta = result.stockpileDeltas.find(
        (d) => d.resourceId === FOOD_ID,
      );
      const waterDelta = result.stockpileDeltas.find(
        (d) => d.resourceId === WATER_ID,
      );
      expect(foodDelta?.delta).toBe(-3);
      expect(waterDelta?.delta).toBe(-3);
      expect(result.citizenDeaths).toHaveLength(0);
    });
  });

  describe("multiplier = 0 produces zero deaths", () => {
    it("produces no deaths even when full deficit if multiplier is 0", () => {
      const ctx = makeContext({
        citizens: [makeNpc("c1", "s1"), makeNpc("c2", "s1")],
        populationRules: {
          ...BASE_POPULATION_RULES,
          starvationSeverityMultiplier: 0,
        },
        stockpiles: [], // no food or water — full deficit
      });

      const result = phaseCitizenConsumption(ctx);

      expect(result.citizenDeaths).toHaveLength(0);
      expect(result.notifications).toHaveLength(0);
    });
  });

  describe("partial deficit", () => {
    it("kills proportional number of NPCs on partial food shortage", () => {
      // 10 NPCs, food_consumption=1, water_consumption=1
      // food: 5/10 → foodDeficit = 1 - 0.5 = 0.5
      // water: 100/10 → waterDeficit = 0
      // deficitRatio = 0.5, multiplier=1, livingNpcs=10
      // deaths = floor(0.5 * 1 * 10) = 5
      const npcs = Array.from({ length: 10 }, (_, i) =>
        makeNpc(`c${i + 1}`, "s1", i + 1),
      );
      const ctx = makeContext({
        citizens: npcs,
        stockpiles: [
          makeStockpile("s1", FOOD_ID, 5),
          makeStockpile("s1", WATER_ID, 100),
        ],
      });

      const result = phaseCitizenConsumption(ctx);

      expect(result.citizenDeaths).toHaveLength(5);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.notificationType).toBe(
        "settlement.starvation_occurred",
      );
    });
  });

  describe("full water shortage", () => {
    it("kills all eligible NPCs when water stock is 0 and multiplier=1", () => {
      // 4 NPCs, water=0 → waterDeficit=1, foodDeficit=0
      // deficitRatio=1, deaths = floor(1 * 1 * 4) = 4
      const npcs = Array.from({ length: 4 }, (_, i) =>
        makeNpc(`c${i + 1}`, "s1", i + 1),
      );
      const ctx = makeContext({
        citizens: npcs,
        stockpiles: [makeStockpile("s1", FOOD_ID, 100)],
        // no water stockpile at all
      });

      const result = phaseCitizenConsumption(ctx);

      expect(result.citizenDeaths).toHaveLength(4);
      const deadIds = result.citizenDeaths.map((d) => d.citizenId);
      expect(deadIds).toContain("c1");
      expect(deadIds).toContain("c2");
    });

    it("consumes 0 water when stock is absent (clamped to 0)", () => {
      const ctx = makeContext({
        citizens: [makeNpc("c1", "s1")],
        stockpiles: [makeStockpile("s1", FOOD_ID, 10)],
      });

      const result = phaseCitizenConsumption(ctx);

      const waterDelta = result.stockpileDeltas.find(
        (d) => d.resourceId === WATER_ID,
      );
      expect(waterDelta).toBeUndefined();
    });
  });

  describe("full food shortage", () => {
    it("kills all eligible NPCs when food stock is 0 and multiplier=1", () => {
      // 3 NPCs, food=0 → foodDeficit=1, water full → waterDeficit=0
      // deficitRatio=1, deaths = floor(1 * 1 * 3) = 3
      const npcs = Array.from({ length: 3 }, (_, i) =>
        makeNpc(`c${i + 1}`, "s1", i + 1),
      );
      const ctx = makeContext({
        citizens: npcs,
        stockpiles: [makeStockpile("s1", WATER_ID, 100)],
        // no food stockpile
      });

      const result = phaseCitizenConsumption(ctx);

      expect(result.citizenDeaths).toHaveLength(3);
    });

    it("emits death detail string with stock/required values", () => {
      const ctx = makeContext({
        citizens: [makeNpc("c1", "s1", 1)],
        stockpiles: [makeStockpile("s1", WATER_ID, 100)],
      });

      const result = phaseCitizenConsumption(ctx);

      expect(result.citizenDeaths[0]?.detail).toMatch(/food: 0\/1/);
      expect(result.citizenDeaths[0]?.detail).toMatch(/water: 100\/1/);
      expect(result.citizenDeaths[0]?.category).toBe("starvation");
    });
  });

  describe("both shortages — max dominates", () => {
    it("uses max of foodDeficit and waterDeficit", () => {
      // 10 NPCs
      // food: 2/10 → foodDeficit = 0.8
      // water: 5/10 → waterDeficit = 0.5
      // deficitRatio = max(0.8, 0.5) = 0.8
      // deaths = floor(0.8 * 1 * 10) = 8
      const npcs = Array.from({ length: 10 }, (_, i) =>
        makeNpc(`c${i + 1}`, "s1", i + 1),
      );
      const ctx = makeContext({
        citizens: npcs,
        stockpiles: [
          makeStockpile("s1", FOOD_ID, 2),
          makeStockpile("s1", WATER_ID, 5),
        ],
      });

      const result = phaseCitizenConsumption(ctx);

      expect(result.citizenDeaths).toHaveLength(8);
    });

    it("uses the larger deficit when water is worse", () => {
      // 10 NPCs
      // food: 8/10 → foodDeficit = 0.2
      // water: 1/10 → waterDeficit = 0.9
      // deficitRatio = 0.9
      // deaths = floor(0.9 * 1 * 10) = 9
      const npcs = Array.from({ length: 10 }, (_, i) =>
        makeNpc(`c${i + 1}`, "s1", i + 1),
      );
      const ctx = makeContext({
        citizens: npcs,
        stockpiles: [
          makeStockpile("s1", FOOD_ID, 8),
          makeStockpile("s1", WATER_ID, 1),
        ],
      });

      const result = phaseCitizenConsumption(ctx);

      expect(result.citizenDeaths).toHaveLength(9);
    });
  });

  describe("PCs always survive", () => {
    it("never selects player_character citizens for starvation death", () => {
      // 1 NPC + 1 PC; full deficit with multiplier=1
      // livingNpcs = 1, deaths = floor(1 * 1 * 1) = 1
      // Only the NPC should die, PC is immune
      const ctx = makeContext({
        citizens: [makeNpc("npc1", "s1", 1), makePc("pc1", "s1")],
        stockpiles: [], // 0 food, 0 water → full deficit
      });

      const result = phaseCitizenConsumption(ctx);

      const deadIds = result.citizenDeaths.map((d) => d.citizenId);
      expect(deadIds).toContain("npc1");
      expect(deadIds).not.toContain("pc1");
    });

    it("produces zero deaths when only PCs are alive (no NPCs to kill)", () => {
      const ctx = makeContext({
        citizens: [makePc("pc1", "s1"), makePc("pc2", "s1")],
        stockpiles: [], // full deficit
      });

      const result = phaseCitizenConsumption(ctx);

      expect(result.citizenDeaths).toHaveLength(0);
      expect(result.notifications).toHaveLength(0);
    });
  });

  describe("deterministic selection order", () => {
    it("kills eldest NPCs (lowest bornOnTurnNumber) first", () => {
      // 3 NPCs with different birth turns; full deficit, 2 deaths expected
      // multiplier=1, 3 NPCs, deficitRatio=1 → floor(1*1*3)=3 but let's set multiplier 0.6
      // deaths = floor(1 * 0.6 * 3) = 1 — select the eldest
      const ctx = makeContext({
        citizens: [
          makeNpc("c-young", "s1", 10),
          makeNpc("c-old", "s1", 1),
          makeNpc("c-mid", "s1", 5),
        ],
        populationRules: {
          ...BASE_POPULATION_RULES,
          starvationSeverityMultiplier: 0.6,
        },
        stockpiles: [], // full deficit
      });

      const result = phaseCitizenConsumption(ctx);

      // floor(1 * 0.6 * 3) = 1, oldest born_on_turn_number=1 → c-old dies
      expect(result.citizenDeaths).toHaveLength(1);
      expect(result.citizenDeaths[0]?.citizenId).toBe("c-old");
    });

    it("breaks bornOnTurnNumber ties by citizenId ascending", () => {
      // 3 NPCs all born on turn 1; 1 death expected → alphabetically first id
      const ctx = makeContext({
        citizens: [
          makeNpc("c-beta", "s1", 1),
          makeNpc("c-alpha", "s1", 1),
          makeNpc("c-gamma", "s1", 1),
        ],
        populationRules: {
          ...BASE_POPULATION_RULES,
          starvationSeverityMultiplier: 0.4,
        },
        stockpiles: [],
      });

      const result = phaseCitizenConsumption(ctx);

      // floor(1 * 0.4 * 3) = 1; alphabetically first is c-alpha
      expect(result.citizenDeaths).toHaveLength(1);
      expect(result.citizenDeaths[0]?.citizenId).toBe("c-alpha");
    });
  });

  describe("property: total deaths ≤ alive NPC count", () => {
    it("never kills more NPCs than exist in a settlement", () => {
      const npcs = Array.from({ length: 5 }, (_, i) =>
        makeNpc(`c${i + 1}`, "s1", i + 1),
      );
      const ctx = makeContext({
        citizens: npcs,
        populationRules: {
          ...BASE_POPULATION_RULES,
          starvationSeverityMultiplier: 10, // extreme multiplier
        },
        stockpiles: [],
      });

      const result = phaseCitizenConsumption(ctx);

      // deaths = floor(1 * 10 * 5) = 50, but only 5 NPCs exist
      // slice(0, 50) on a 5-element array returns all 5
      expect(result.citizenDeaths.length).toBeLessThanOrEqual(5);
    });
  });

  describe("multiple settlements processed independently", () => {
    it("handles two settlements with different deficit levels", () => {
      const ctx = makeContext({
        citizens: [
          makeNpc("s1c1", "s1", 1),
          makeNpc("s2c1", "s2", 1),
          makeNpc("s2c2", "s2", 2),
        ],
        settlements: [
          makeSettlement("s1", "Town A"),
          makeSettlement("s2", "Town B"),
        ],
        stockpiles: [
          makeStockpile("s1", FOOD_ID, 100), // s1 fully supplied
          makeStockpile("s1", WATER_ID, 100),
          // s2 has no food or water
        ],
      });

      const result = phaseCitizenConsumption(ctx);

      // s1 has no shortage → 0 deaths
      // s2 has full deficit, multiplier=1, 2 NPCs → floor(1*1*2)=2 deaths
      const deadIds = result.citizenDeaths.map((d) => d.citizenId);
      expect(deadIds).not.toContain("s1c1");
      expect(deadIds).toContain("s2c1");
      expect(deadIds).toContain("s2c2");
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.messageText).toContain("Town B");
    });
  });

  describe("log entries", () => {
    it("emits citizen.consumed_food_water log per settlement with alive citizens", () => {
      const ctx = makeContext({
        citizens: [makeNpc("c1", "s1")],
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        stockpiles: [
          makeStockpile("s1", FOOD_ID, 10),
          makeStockpile("s1", WATER_ID, 10),
        ],
      });

      const result = phaseCitizenConsumption(ctx);

      const consumptionLogs = result.logs.filter(
        (l) => l.category === "citizen.consumed_food_water",
      );
      // s2 has no citizens, only s1 emits
      expect(consumptionLogs).toHaveLength(1);
      expect(consumptionLogs[0]?.phase).toBe("citizenConsumption");
    });

    it("emits citizen.starved log per dead citizen", () => {
      const ctx = makeContext({
        citizens: [makeNpc("c1", "s1", 1), makeNpc("c2", "s1", 2)],
        stockpiles: [], // full deficit → 2 deaths
      });

      const result = phaseCitizenConsumption(ctx);

      const starvedLogs = result.logs.filter(
        (l) => l.category === "citizen.starved",
      );
      expect(starvedLogs).toHaveLength(2);
      expect(starvedLogs[0]?.phase).toBe("citizenConsumption");
    });
  });
});
