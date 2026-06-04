import { describe, expect, it } from "vitest";

import { phaseHomelessness } from "./phaseHomelessness.ts";

import type {
  SimBuildingTier,
  SimCitizen,
  SimSettlement,
  SimSettlementBuilding,
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

const BASE_POPULATION_RULES: SimulationInputState["populationRules"] = {
  fertilityChance: 0,
  foodConsumptionPerCitizen: 1,
  homelessnessDecliningRate: 0.5,
  incestPreventionDepth: 0,
  maximumFertilityAgeTurns: null,
  minimumPartnershipAgeTurns: 0,
  mourningPeriodTurns: 0,
  partnershipSeekChance: 0,
  starvationSeverityMultiplier: 1,
  waterConsumptionPerCitizen: 1,
};

let _idCounter = 0;
function nextId(): string {
  return `id-${++_idCounter}`;
}

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

function makeCapBuilding(
  settlementId: string,
  capAmount: number,
): { building: SimSettlementBuilding; tier: SimBuildingTier } {
  const tierId = nextId();
  const buildingId = nextId();
  const tier: SimBuildingTier = {
    buildingBlueprintId: nextId(),
    constructionCostsJson: [],
    effectsJson: [{ amount: capAmount, type: "population_cap_increase" }],
    id: tierId,
    tierNumber: 1,
    upkeepCostsJson: [],
    workerTurnsRequired: 0,
  };
  const building: SimSettlementBuilding = {
    activatedOnTurnNumber: 1,
    buildingBlueprintId: tier.buildingBlueprintId,
    currentTierId: tierId,
    id: buildingId,
    missedUpkeepCount: 0,
    settlementId,
    sourceProjectId: null,
    state: "active",
  };
  return { building, tier };
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
    systemResourceIds: { foodId: "food", freshWaterId: "water" },
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

describe("phaseHomelessness", () => {
  describe("cap satisfied — no deaths", () => {
    it("produces no deaths when alive NPC count is below cap", () => {
      const { building, tier } = makeCapBuilding("s1", 10);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [
          makeNpc("c1", "s1", 1),
          makeNpc("c2", "s1", 2),
          makeNpc("c3", "s1", 3),
        ],
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      expect(result.citizenDeaths).toHaveLength(0);
      expect(result.notifications).toHaveLength(0);
      expect(result.logs).toHaveLength(0);
    });

    it("produces no deaths when alive NPC count exactly equals cap", () => {
      const { building, tier } = makeCapBuilding("s1", 3);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [
          makeNpc("c1", "s1", 1),
          makeNpc("c2", "s1", 2),
          makeNpc("c3", "s1", 3),
        ],
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      expect(result.citizenDeaths).toHaveLength(0);
    });
  });

  describe("decline_rate = 0 — zero deaths", () => {
    it("produces no deaths even when overage exists if rate is 0", () => {
      const { building, tier } = makeCapBuilding("s1", 2);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [
          makeNpc("c1", "s1", 1),
          makeNpc("c2", "s1", 2),
          makeNpc("c3", "s1", 3),
        ],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 0,
        },
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      expect(result.citizenDeaths).toHaveLength(0);
      expect(result.notifications).toHaveLength(0);
    });
  });

  describe("single overage with decline_rate=0.1 — ceil produces 1 death", () => {
    it("kills 1 NPC when overage=1 and rate=0.1 (ceil(1*0.1)=1)", () => {
      // cap=4, 5 NPCs → overage=1; ceil(1*0.1)=ceil(0.1)=1 death
      const { building, tier } = makeCapBuilding("s1", 4);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [
          makeNpc("c1", "s1", 1),
          makeNpc("c2", "s1", 2),
          makeNpc("c3", "s1", 3),
          makeNpc("c4", "s1", 4),
          makeNpc("c5", "s1", 5),
        ],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 0.1,
        },
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      expect(result.citizenDeaths).toHaveLength(1);
      // Eldest (born turn 1) dies first
      expect(result.citizenDeaths[0]?.citizenId).toBe("c1");
    });
  });

  describe("overage smaller than rate — ceil still produces a death", () => {
    it("kills 1 NPC when overage=1 and rate=0.5 (ceil(0.5)=1)", () => {
      // cap=3, 4 NPCs → overage=1; ceil(1*0.5)=1 death
      const { building, tier } = makeCapBuilding("s1", 3);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [
          makeNpc("c1", "s1", 1),
          makeNpc("c2", "s1", 2),
          makeNpc("c3", "s1", 3),
          makeNpc("c4", "s1", 4),
        ],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 0.5,
        },
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      expect(result.citizenDeaths).toHaveLength(1);
    });
  });

  describe("decline_rate = 1 — kills exactly the overage", () => {
    it("kills all overage NPCs when rate=1", () => {
      // cap=2, 5 NPCs → overage=3; ceil(3*1)=3 deaths
      const { building, tier } = makeCapBuilding("s1", 2);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [
          makeNpc("c1", "s1", 1),
          makeNpc("c2", "s1", 2),
          makeNpc("c3", "s1", 3),
          makeNpc("c4", "s1", 4),
          makeNpc("c5", "s1", 5),
        ],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      expect(result.citizenDeaths).toHaveLength(3);
    });
  });

  describe("PCs are immune", () => {
    it("never selects player_character citizens for homeless death", () => {
      // cap=2, 2 NPCs + 2 PCs; NPCs match cap exactly → overage=0
      const { building, tier } = makeCapBuilding("s1", 2);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [
          makeNpc("npc1", "s1", 1),
          makeNpc("npc2", "s1", 2),
          makePc("pc1", "s1"),
          makePc("pc2", "s1"),
        ],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      // NPC count=2, cap=2, overage=0 → no deaths
      expect(result.citizenDeaths).toHaveLength(0);
    });

    it("kills only NPCs even when overage exists alongside PCs", () => {
      // cap=1, 3 NPCs + 2 PCs; NPC overage=2; rate=1 → kills 2 NPCs
      const { building, tier } = makeCapBuilding("s1", 1);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [
          makeNpc("npc1", "s1", 1),
          makeNpc("npc2", "s1", 2),
          makeNpc("npc3", "s1", 3),
          makePc("pc1", "s1"),
          makePc("pc2", "s1"),
        ],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      expect(result.citizenDeaths).toHaveLength(2);
      const deadIds = result.citizenDeaths.map((d) => d.citizenId);
      expect(deadIds).not.toContain("pc1");
      expect(deadIds).not.toContain("pc2");
    });
  });

  describe("deterministic selection order", () => {
    it("kills eldest NPCs (lowest bornOnTurnNumber) first", () => {
      // cap=2, 4 NPCs, rate=1 → overage=2; eldest 2 die
      const { building, tier } = makeCapBuilding("s1", 2);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [
          makeNpc("c-young", "s1", 10),
          makeNpc("c-old", "s1", 1),
          makeNpc("c-mid", "s1", 5),
          makeNpc("c-mid2", "s1", 6),
        ],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      const deadIds = result.citizenDeaths.map((d) => d.citizenId);
      expect(deadIds).toContain("c-old");
      expect(deadIds).toContain("c-mid");
      expect(deadIds).not.toContain("c-young");
    });

    it("breaks bornOnTurnNumber ties by citizenId ascending", () => {
      // All born turn 1, cap=2, 4 NPCs, rate=1 → kills 2; alphabetically first 2
      const { building, tier } = makeCapBuilding("s1", 2);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [
          makeNpc("c-delta", "s1", 1),
          makeNpc("c-alpha", "s1", 1),
          makeNpc("c-gamma", "s1", 1),
          makeNpc("c-beta", "s1", 1),
        ],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      const deadIds = result.citizenDeaths.map((d) => d.citizenId);
      expect(deadIds).toContain("c-alpha");
      expect(deadIds).toContain("c-beta");
      expect(deadIds).not.toContain("c-gamma");
      expect(deadIds).not.toContain("c-delta");
    });
  });

  describe("death detail and log format", () => {
    it("emits correct death_cause_category and detail string", () => {
      // cap=1, 3 NPCs, rate=1 → overage=2, kills 2
      const { building, tier } = makeCapBuilding("s1", 1);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [
          makeNpc("c1", "s1", 1),
          makeNpc("c2", "s1", 2),
          makeNpc("c3", "s1", 3),
        ],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      expect(result.citizenDeaths[0]?.category).toBe("homeless");
      expect(result.citizenDeaths[0]?.detail).toBe("cap: 1, alive: 3");
    });

    it("emits citizen.died_homeless log per dead citizen", () => {
      const { building, tier } = makeCapBuilding("s1", 1);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [makeNpc("c1", "s1", 1), makeNpc("c2", "s1", 2)],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      const homelessLogs = result.logs.filter(
        (l) => l.category === "citizen.died_homeless",
      );
      expect(homelessLogs).toHaveLength(1);
      expect(homelessLogs[0]?.phase).toBe("homelessness");
      expect(homelessLogs[0]?.citizenId).toBe("c1");
    });

    it("emits settlement.homelessness_occurred notification per settlement with deaths", () => {
      const { building, tier } = makeCapBuilding("s1", 1);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [makeNpc("c1", "s1", 1), makeNpc("c2", "s1", 2)],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [building],
        settlements: [makeSettlement("s1", "Testville")],
      });

      const result = phaseHomelessness(ctx);

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.notificationType).toBe(
        "settlement.homelessness_occurred",
      );
      expect(result.notifications[0]?.messageText).toContain("Testville");
    });

    it("emits no notification when no deaths occur", () => {
      const { building, tier } = makeCapBuilding("s1", 10);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [makeNpc("c1", "s1", 1)],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      expect(result.notifications).toHaveLength(0);
    });
  });

  describe("property: post-phase NPC count ≥ cap - homelessDeaths", () => {
    it("never kills more NPCs than the overage", () => {
      // cap=2, 10 NPCs, rate=1 → overage=8; kills exactly 8, leaving 2 alive
      const { building, tier } = makeCapBuilding("s1", 2);
      const npcs = Array.from({ length: 10 }, (_, i) =>
        makeNpc(`c${i + 1}`, "s1", i + 1),
      );
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: npcs,
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      const aliveAfter = 10 - result.citizenDeaths.length;
      expect(aliveAfter).toBeGreaterThanOrEqual(2); // ≥ cap
    });

    it("alive NPC count after deaths equals cap when rate=1", () => {
      // cap=3, 7 NPCs, rate=1 → kills 4, leaving 3 alive
      const { building, tier } = makeCapBuilding("s1", 3);
      const npcs = Array.from({ length: 7 }, (_, i) =>
        makeNpc(`c${i + 1}`, "s1", i + 1),
      );
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: npcs,
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      const aliveAfter = 7 - result.citizenDeaths.length;
      expect(aliveAfter).toBe(3);
    });
  });

  describe("overshoot ledger pass-through", () => {
    it("passes deconstructOvershootLedger through as consumedOvershootEntries", () => {
      const { building, tier } = makeCapBuilding("s1", 10);
      const ledgerEntry = {
        amount: 5,
        resourceId: "res-1",
        settlementBuildingId: "b-1",
      };
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [],
        deconstructOvershootLedger: [ledgerEntry],
        settlementBuildings: [building],
      });

      const result = phaseHomelessness(ctx);

      expect(result.consumedOvershootEntries).toHaveLength(1);
      expect(result.consumedOvershootEntries[0]).toEqual(ledgerEntry);
    });

    it("returns empty consumedOvershootEntries when ledger is empty", () => {
      const ctx = makeContext({ deconstructOvershootLedger: [] });

      const result = phaseHomelessness(ctx);

      expect(result.consumedOvershootEntries).toHaveLength(0);
    });
  });

  describe("multiple settlements processed independently", () => {
    it("handles two settlements with different overage levels", () => {
      // s1: cap=5, 5 NPCs → no overage; s2: cap=1, 4 NPCs, rate=1 → 3 deaths
      const { building: b1, tier: t1 } = makeCapBuilding("s1", 5);
      const { building: b2, tier: t2 } = makeCapBuilding("s2", 1);
      const ctx = makeContext({
        buildingTiers: [t1, t2],
        citizens: [
          makeNpc("s1c1", "s1", 1),
          makeNpc("s1c2", "s1", 2),
          makeNpc("s1c3", "s1", 3),
          makeNpc("s1c4", "s1", 4),
          makeNpc("s1c5", "s1", 5),
          makeNpc("s2c1", "s2", 1),
          makeNpc("s2c2", "s2", 2),
          makeNpc("s2c3", "s2", 3),
          makeNpc("s2c4", "s2", 4),
        ],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [b1, b2],
        settlements: [
          makeSettlement("s1", "Town A"),
          makeSettlement("s2", "Town B"),
        ],
      });

      const result = phaseHomelessness(ctx);

      const deadIds = result.citizenDeaths.map((d) => d.citizenId);
      expect(deadIds.filter((id) => id.startsWith("s1"))).toHaveLength(0);
      expect(deadIds.filter((id) => id.startsWith("s2"))).toHaveLength(3);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.messageText).toContain("Town B");
    });
  });

  describe("pendingDeaths exclusion — phase-8 starvation victims not counted", () => {
    it("no homelessness deaths when alive NPCs equal cap but one is already pending-dead", () => {
      // cap=2, 3 NPCs in input, but 1 died in phase 8 (starvation) → effective alive=2 = cap
      // → overage=0 → no homeless deaths.
      const { building, tier } = makeCapBuilding("s1", 2);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [
          makeNpc("c1", "s1", 1),
          makeNpc("c2", "s1", 2),
          makeNpc("c3", "s1", 3),
        ],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [building],
      });
      // Simulate phase-8 having killed c1 (starvation) before phase 10 runs.
      ctx.shared.pendingDeaths.add("c1");

      const result = phaseHomelessness(ctx);

      expect(result.citizenDeaths).toHaveLength(0);
      expect(result.notifications).toHaveLength(0);
    });

    it("reduces overage by the number of pending-dead citizens", () => {
      // cap=2, 5 NPCs, 2 pending-dead → effective alive=3, overage=1, rate=1 → 1 death.
      const { building, tier } = makeCapBuilding("s1", 2);
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [
          makeNpc("c1", "s1", 1),
          makeNpc("c2", "s1", 2),
          makeNpc("c3", "s1", 3),
          makeNpc("c4", "s1", 4),
          makeNpc("c5", "s1", 5),
        ],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [building],
      });
      ctx.shared.pendingDeaths.add("c1");
      ctx.shared.pendingDeaths.add("c2");

      const result = phaseHomelessness(ctx);

      expect(result.citizenDeaths).toHaveLength(1);
      // c1 and c2 are pending-dead so the eldest survivor (c3) dies.
      expect(result.citizenDeaths[0]?.citizenId).toBe("c3");
    });
  });

  describe("no active buildings — cap is 0", () => {
    it("treats suspended/deconstructed buildings as not contributing to cap", () => {
      const tierId = nextId();
      const tier: SimBuildingTier = {
        buildingBlueprintId: nextId(),
        constructionCostsJson: [],
        effectsJson: [{ amount: 10, type: "population_cap_increase" }],
        id: tierId,
        tierNumber: 1,
        upkeepCostsJson: [],
        workerTurnsRequired: 0,
      };
      const suspendedBuilding: SimSettlementBuilding = {
        activatedOnTurnNumber: 1,
        buildingBlueprintId: tier.buildingBlueprintId,
        currentTierId: tierId,
        id: nextId(),
        missedUpkeepCount: 1,
        settlementId: "s1",
        sourceProjectId: null,
        state: "suspended",
      };
      const ctx = makeContext({
        buildingTiers: [tier],
        citizens: [makeNpc("c1", "s1", 1)],
        populationRules: {
          ...BASE_POPULATION_RULES,
          homelessnessDecliningRate: 1,
        },
        settlementBuildings: [suspendedBuilding],
      });

      // cap=0, 1 NPC → overage=1, rate=1 → 1 death
      const result = phaseHomelessness(ctx);

      expect(result.citizenDeaths).toHaveLength(1);
    });
  });
});
