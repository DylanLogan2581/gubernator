import { describe, expect, it } from "vitest";

import {
  phaseLogsAndSnapshots,
  type PhaseLogsAndSnapshotsAccumulator,
} from "./phaseLogsAndSnapshots.ts";

import type {
  SimulationContext,
  SimulationInputState,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Test helpers
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
  const pendingStockpiles = new Map<string, number>();
  for (const sp of input.stockpiles) {
    pendingStockpiles.set(`${sp.settlementId}:${sp.resourceId}`, sp.quantity);
  }
  return {
    input,
    shared: { pendingPopCapBySettlement: new Map(), pendingStockpiles },
  };
}

function makeEmptyAccumulator(
  pendingStockpiles: Map<string, number> = new Map(),
): PhaseLogsAndSnapshotsAccumulator {
  return {
    allDeaths: [],
    buildingStateChanges: [],
    citizenBirths: [],
    consumptionDeltas: [],
    depositUpdates: [],
    managedPopulationUpdates: [],
    partnershipChanges: [],
    pendingStockpiles,
    productionDeltas: [],
    tradeRouteDeltas: [],
    tradeRouteOutcomes: [],
  };
}

// ---------------------------------------------------------------------------
// Settlement snapshot: empty settlement
// ---------------------------------------------------------------------------

describe("phaseLogsAndSnapshots — settlement snapshot", () => {
  describe("empty settlement — all zeros", () => {
    it("produces one snapshot per settlement with all-zero counts", () => {
      const ctx = makeContext({
        settlements: [{ id: "s1", name: "Empty Town" }],
        citizens: [],
      });
      const result = phaseLogsAndSnapshots(ctx, makeEmptyAccumulator());

      expect(result.settlementSnapshots).toHaveLength(1);
      const snap = result.settlementSnapshots[0];
      expect(snap?.settlementId).toBe("s1");
      expect(snap?.turnNumber).toBe(5);
      expect(snap?.aliveTotal).toBe(0);
      expect(snap?.aliveNpc).toBe(0);
      expect(snap?.alivePc).toBe(0);
      expect(snap?.populationCap).toBe(0);
      expect(snap?.birthCount).toBe(0);
      expect(snap?.deathCount).toBe(0);
      expect(snap?.starvationDeathsCount).toBe(0);
      expect(snap?.homelessDeathsCount).toBe(0);
      expect(snap?.partnershipsFormedCount).toBe(0);
      expect(snap?.managedPopulationSummary).toHaveLength(0);
      expect(snap?.tradeSummary).toHaveLength(0);
      expect(snap?.warnings.pausedProjectIds).toHaveLength(0);
      expect(snap?.warnings.depletedDepositIds).toHaveLength(0);
    });

    it("produces one snapshot per settlement in multi-settlement worlds", () => {
      const ctx = makeContext({
        settlements: [
          { id: "s1", name: "Town A" },
          { id: "s2", name: "Town B" },
        ],
      });
      const result = phaseLogsAndSnapshots(ctx, makeEmptyAccumulator());

      expect(result.settlementSnapshots).toHaveLength(2);
      const ids = result.settlementSnapshots.map((s) => s.settlementId);
      expect(ids).toContain("s1");
      expect(ids).toContain("s2");
    });
  });

  describe("alive citizen counts", () => {
    it("counts initial alive NPCs and PCs separately", () => {
      const ctx = makeContext({
        citizens: [
          {
            id: "npc1",
            name: "npc1",
            citizenType: "npc",
            status: "alive",
            settlementId: "s1",
            bornOnTurnNumber: 1,
            parentACitizenId: null,
            parentBCitizenId: null,
            sex: "male",
          },
          {
            id: "npc2",
            name: "npc2",
            citizenType: "npc",
            status: "alive",
            settlementId: "s1",
            bornOnTurnNumber: 1,
            parentACitizenId: null,
            parentBCitizenId: null,
            sex: "female",
          },
          {
            id: "pc1",
            name: "pc1",
            citizenType: "player_character",
            status: "alive",
            settlementId: "s1",
            bornOnTurnNumber: 1,
            parentACitizenId: null,
            parentBCitizenId: null,
            sex: "female",
          },
        ],
      });
      const result = phaseLogsAndSnapshots(ctx, makeEmptyAccumulator());

      const snap = result.settlementSnapshots[0];
      expect(snap?.aliveNpc).toBe(2);
      expect(snap?.alivePc).toBe(1);
      expect(snap?.aliveTotal).toBe(3);
    });

    it("subtracts starvation deaths from alive counts", () => {
      const ctx = makeContext({
        citizens: [
          {
            id: "npc1",
            name: "npc1",
            citizenType: "npc",
            status: "alive",
            settlementId: "s1",
            bornOnTurnNumber: 1,
            parentACitizenId: null,
            parentBCitizenId: null,
            sex: "male",
          },
          {
            id: "npc2",
            name: "npc2",
            citizenType: "npc",
            status: "alive",
            settlementId: "s1",
            bornOnTurnNumber: 1,
            parentACitizenId: null,
            parentBCitizenId: null,
            sex: "female",
          },
        ],
      });
      const acc = makeEmptyAccumulator();
      const result = phaseLogsAndSnapshots(ctx, {
        ...acc,
        allDeaths: [
          { citizenId: "npc1", category: "starvation", detail: null },
        ],
      });

      const snap = result.settlementSnapshots[0];
      expect(snap?.aliveNpc).toBe(1);
      expect(snap?.aliveTotal).toBe(1);
      expect(snap?.deathCount).toBe(1);
      expect(snap?.starvationDeathsCount).toBe(1);
      expect(snap?.homelessDeathsCount).toBe(0);
    });

    it("subtracts homeless deaths from alive counts", () => {
      const ctx = makeContext({
        citizens: [
          {
            id: "npc1",
            name: "npc1",
            citizenType: "npc",
            status: "alive",
            settlementId: "s1",
            bornOnTurnNumber: 1,
            parentACitizenId: null,
            parentBCitizenId: null,
            sex: "male",
          },
        ],
      });
      const acc = makeEmptyAccumulator();
      const result = phaseLogsAndSnapshots(ctx, {
        ...acc,
        allDeaths: [{ citizenId: "npc1", category: "homeless", detail: null }],
      });

      const snap = result.settlementSnapshots[0];
      expect(snap?.aliveNpc).toBe(0);
      expect(snap?.homelessDeathsCount).toBe(1);
    });

    it("adds births to alive NPC count", () => {
      const ctx = makeContext({
        citizens: [
          {
            id: "npc1",
            name: "npc1",
            citizenType: "npc",
            status: "alive",
            settlementId: "s1",
            bornOnTurnNumber: 1,
            parentACitizenId: null,
            parentBCitizenId: null,
            sex: "male",
          },
        ],
      });
      const acc = makeEmptyAccumulator();
      const result = phaseLogsAndSnapshots(ctx, {
        ...acc,
        citizenBirths: [
          {
            settlementId: "s1",
            parentACitizenId: "npc1",
            parentBCitizenId: "npc1",
            sex: "female",
            npcFlaw: null,
            npcGoal: null,
            npcSecretContradiction: null,
            npcTrait1: null,
            npcTrait2: null,
          },
        ],
      });

      const snap = result.settlementSnapshots[0];
      expect(snap?.birthCount).toBe(1);
      expect(snap?.aliveNpc).toBe(2); // 1 initial + 1 birth
      expect(snap?.aliveTotal).toBe(2);
    });
  });

  describe("population cap from active buildings", () => {
    it("sums population_cap_increase from active buildings only", () => {
      const tierId = "tier-1";
      const tier = {
        id: tierId,
        buildingBlueprintId: "bp-1",
        constructionCostsJson: [],
        effectsJson: [{ type: "population_cap_increase" as const, amount: 10 }],
        tierNumber: 1,
        upkeepCostsJson: [],
        workerTurnsRequired: 0,
      };
      const ctx = makeContext({
        buildingTiers: [tier],
        settlementBuildings: [
          {
            id: "b1",
            buildingBlueprintId: "bp-1",
            currentTierId: tierId,
            settlementId: "s1",
            state: "active",
            activatedOnTurnNumber: 1,
            missedUpkeepCount: 0,
            sourceProjectId: null,
          },
          {
            id: "b2",
            buildingBlueprintId: "bp-1",
            currentTierId: tierId,
            settlementId: "s1",
            state: "suspended", // should not count
            activatedOnTurnNumber: 1,
            missedUpkeepCount: 1,
            sourceProjectId: null,
          },
        ],
      });

      const result = phaseLogsAndSnapshots(ctx, makeEmptyAccumulator());
      const snap = result.settlementSnapshots[0];
      expect(snap?.populationCap).toBe(10); // only b1 is active
    });

    it("applies building state changes from this turn when computing cap", () => {
      const tierId = "tier-1";
      const tier = {
        id: tierId,
        buildingBlueprintId: "bp-1",
        constructionCostsJson: [],
        effectsJson: [{ type: "population_cap_increase" as const, amount: 5 }],
        tierNumber: 1,
        upkeepCostsJson: [],
        workerTurnsRequired: 0,
      };
      const ctx = makeContext({
        buildingTiers: [tier],
        settlementBuildings: [
          {
            id: "b1",
            buildingBlueprintId: "bp-1",
            currentTierId: tierId,
            settlementId: "s1",
            state: "active",
            activatedOnTurnNumber: 1,
            missedUpkeepCount: 0,
            sourceProjectId: null,
          },
        ],
      });
      // b1 gets suspended this turn
      const acc = {
        ...makeEmptyAccumulator(),
        buildingStateChanges: [
          {
            settlementBuildingId: "b1",
            toState: "suspended" as const,
            missedUpkeepCountDelta: 1,
          },
        ],
      };

      const result = phaseLogsAndSnapshots(ctx, acc);
      const snap = result.settlementSnapshots[0];
      expect(snap?.populationCap).toBe(0); // suspended buildings don't count
    });
  });

  describe("building summary counts", () => {
    it("counts buildings by final state after state changes", () => {
      const tierId = "tier-1";
      const tier = {
        id: tierId,
        buildingBlueprintId: "bp-1",
        constructionCostsJson: [],
        effectsJson: [],
        tierNumber: 1,
        upkeepCostsJson: [],
        workerTurnsRequired: 0,
      };
      const ctx = makeContext({
        buildingTiers: [tier],
        settlementBuildings: [
          {
            id: "b1",
            buildingBlueprintId: "bp-1",
            currentTierId: tierId,
            settlementId: "s1",
            state: "active",
            activatedOnTurnNumber: 1,
            missedUpkeepCount: 0,
            sourceProjectId: null,
          },
          {
            id: "b2",
            buildingBlueprintId: "bp-1",
            currentTierId: tierId,
            settlementId: "s1",
            state: "active", // will be suspended this turn
            activatedOnTurnNumber: 1,
            missedUpkeepCount: 0,
            sourceProjectId: null,
          },
        ],
      });
      const acc = {
        ...makeEmptyAccumulator(),
        buildingStateChanges: [
          {
            settlementBuildingId: "b2",
            toState: "suspended" as const,
            missedUpkeepCountDelta: 1,
          },
        ],
      };

      const result = phaseLogsAndSnapshots(ctx, acc);
      const snap = result.settlementSnapshots[0];
      expect(snap?.buildingSummary.active).toBe(1);
      expect(snap?.buildingSummary.suspended).toBe(1);
      expect(snap?.buildingSummary.auto_deconstructed).toBe(0);
      expect(snap?.buildingSummary.manually_deconstructed).toBe(0);
    });
  });

  describe("partnerships formed count", () => {
    it("counts formed partnerships where citizenA is in the settlement", () => {
      const ctx = makeContext({
        citizens: [
          {
            id: "npc1",
            name: "npc1",
            citizenType: "npc",
            status: "alive",
            settlementId: "s1",
            bornOnTurnNumber: 1,
            parentACitizenId: null,
            parentBCitizenId: null,
            sex: "male",
          },
          {
            id: "npc2",
            name: "npc2",
            citizenType: "npc",
            status: "alive",
            settlementId: "s1",
            bornOnTurnNumber: 1,
            parentACitizenId: null,
            parentBCitizenId: null,
            sex: "female",
          },
        ],
      });
      const acc = {
        ...makeEmptyAccumulator(),
        partnershipChanges: [
          { type: "formed" as const, citizenAId: "npc1", citizenBId: "npc2" },
        ],
      };

      const result = phaseLogsAndSnapshots(ctx, acc);
      const snap = result.settlementSnapshots[0];
      expect(snap?.partnershipsFormedCount).toBe(1);
    });
  });

  describe("warnings", () => {
    it("lists paused construction projects", () => {
      const ctx = makeContext({
        constructionProjects: [
          {
            id: "proj-1",
            settlementId: "s1",
            buildingBlueprintId: "bp-1",
            targetTierId: "tier-1",
            progressWorkerTurns: 0,
            queuePosition: 1,
            status: "paused",
            workerTurnsRequired: 10,
          },
          {
            id: "proj-2",
            settlementId: "s1",
            buildingBlueprintId: "bp-1",
            targetTierId: "tier-1",
            progressWorkerTurns: 5,
            queuePosition: 0,
            status: "in_progress", // not a warning
            workerTurnsRequired: 10,
          },
        ],
      });

      const result = phaseLogsAndSnapshots(ctx, makeEmptyAccumulator());
      const snap = result.settlementSnapshots[0];
      expect(snap?.warnings.pausedProjectIds).toEqual(["proj-1"]);
    });

    it("lists depleted deposits from this turn's deposit updates", () => {
      const ctx = makeContext({
        deposits: [
          {
            id: "dep-1",
            depositTypeId: "dt-1",
            maxWorkers: null,
            name: "Iron Vein",
            resources: [],
            settlementId: "s1",
            status: "active",
          },
        ],
      });
      const acc = {
        ...makeEmptyAccumulator(),
        depositUpdates: [
          {
            depositInstanceId: "dep-1",
            resourceDeltas: [],
            toStatus: "depleted" as const,
          },
        ],
      };

      const result = phaseLogsAndSnapshots(ctx, acc);
      const snap = result.settlementSnapshots[0];
      expect(snap?.warnings.depletedDepositIds).toEqual(["dep-1"]);
    });
  });

  describe("managed population summary", () => {
    it("lists current count per instance after applying updates", () => {
      const ctx = makeContext({
        managedPopulations: [
          {
            id: "mp-1",
            managedPopulationTypeId: "mpt-1",
            name: "Cattle",
            settlementId: "s1",
            status: "active",
            configuredCullQuantity: 0,
            currentCount: 20,
          },
        ],
      });
      const acc = {
        ...makeEmptyAccumulator(),
        managedPopulationUpdates: [
          {
            managedPopulationInstanceId: "mp-1",
            countDelta: 5,
            toStatus: null,
          },
        ],
      };

      const result = phaseLogsAndSnapshots(ctx, acc);
      const snap = result.settlementSnapshots[0];
      expect(snap?.managedPopulationSummary).toHaveLength(1);
      expect(snap?.managedPopulationSummary[0]?.instanceId).toBe("mp-1");
      expect(snap?.managedPopulationSummary[0]?.currentCount).toBe(25); // 20 + 5
    });
  });

  describe("trade summary", () => {
    it("includes trade route outcomes for routes touching this settlement", () => {
      const ctx = makeContext({
        settlements: [
          { id: "s1", name: "Town A" },
          { id: "s2", name: "Town B" },
        ],
        tradeRoutes: [
          {
            id: "tr-1",
            originSettlementId: "s1",
            destinationSettlementId: "s2",
            resourceId: "res-1",
            quantityPerTransition: 10,
            status: "active",
          },
          {
            id: "tr-2",
            originSettlementId: "s2",
            destinationSettlementId: "s2",
            resourceId: "res-2",
            quantityPerTransition: 5,
            status: "active", // no outcome provided — not included
          },
        ],
      });
      const acc = {
        ...makeEmptyAccumulator(),
        tradeRouteOutcomes: [
          {
            tradeRouteId: "tr-1",
            delivered: true,
            quantityTransferred: 10,
            pauseReason: null,
          },
        ],
      };

      const result = phaseLogsAndSnapshots(ctx, acc);
      const snapS1 = result.settlementSnapshots.find(
        (s) => s.settlementId === "s1",
      );
      expect(snapS1?.tradeSummary).toHaveLength(1);
      expect(snapS1?.tradeSummary[0]?.tradeRouteId).toBe("tr-1");
      expect(snapS1?.tradeSummary[0]?.delivered).toBe(true);
      expect(snapS1?.tradeSummary[0]?.quantityTransferred).toBe(10);
    });
  });
});

// ---------------------------------------------------------------------------
// Resource snapshot tests
// ---------------------------------------------------------------------------

describe("phaseLogsAndSnapshots — resource snapshot", () => {
  describe("empty settlement — no stockpiles", () => {
    it("produces no resource snapshots when stockpiles are empty", () => {
      const ctx = makeContext({ stockpiles: [] });
      const result = phaseLogsAndSnapshots(ctx, makeEmptyAccumulator());
      expect(result.resourceSnapshots).toHaveLength(0);
    });
  });

  describe("one row per stockpile entry", () => {
    it("produces one resource snapshot per (settlement × resource) stockpile", () => {
      const ctx = makeContext({
        stockpiles: [
          { settlementId: "s1", resourceId: "food", quantity: 100, cap: 200 },
          { settlementId: "s1", resourceId: "water", quantity: 50, cap: 100 },
        ],
      });
      const pending = new Map([
        ["s1:food", 100],
        ["s1:water", 50],
      ]);
      const result = phaseLogsAndSnapshots(ctx, makeEmptyAccumulator(pending));

      expect(result.resourceSnapshots).toHaveLength(2);
      const foodSnap = result.resourceSnapshots.find(
        (s) => s.resourceId === "food",
      );
      expect(foodSnap?.settlementId).toBe("s1");
      expect(foodSnap?.turnNumber).toBe(5);
      expect(foodSnap?.quantityBefore).toBe(100);
      expect(foodSnap?.quantityAfter).toBe(100);
      expect(foodSnap?.produced).toBe(0);
      expect(foodSnap?.consumed).toBe(0);
      expect(foodSnap?.tradeIn).toBe(0);
      expect(foodSnap?.tradeOut).toBe(0);
    });
  });

  describe("quantityBefore and quantityAfter", () => {
    it("captures quantity before from original stockpile and after from pendingStockpiles", () => {
      const ctx = makeContext({
        stockpiles: [
          { settlementId: "s1", resourceId: "food", quantity: 80, cap: 200 },
        ],
      });
      const pending = new Map([["s1:food", 60]]);
      const result = phaseLogsAndSnapshots(ctx, makeEmptyAccumulator(pending));

      const snap = result.resourceSnapshots[0];
      expect(snap?.quantityBefore).toBe(80);
      expect(snap?.quantityAfter).toBe(60);
    });
  });

  describe("flow totals — produced and consumed", () => {
    it("sums production and consumption deltas correctly", () => {
      const ctx = makeContext({
        stockpiles: [
          { settlementId: "s1", resourceId: "food", quantity: 50, cap: 200 },
        ],
      });
      const pending = new Map([["s1:food", 70]]); // 50 + 30 - 10 = 70
      const acc: PhaseLogsAndSnapshotsAccumulator = {
        ...makeEmptyAccumulator(pending),
        productionDeltas: [
          { settlementId: "s1", resourceId: "food", delta: 30 },
        ],
        consumptionDeltas: [
          { settlementId: "s1", resourceId: "food", delta: -10 },
        ],
      };

      const result = phaseLogsAndSnapshots(ctx, acc);
      const snap = result.resourceSnapshots[0];
      expect(snap?.produced).toBe(30);
      expect(snap?.consumed).toBe(10);
    });

    it("sums multiple deltas for the same resource", () => {
      const ctx = makeContext({
        stockpiles: [
          { settlementId: "s1", resourceId: "food", quantity: 100, cap: 200 },
        ],
      });
      const pending = new Map([["s1:food", 110]]);
      const acc: PhaseLogsAndSnapshotsAccumulator = {
        ...makeEmptyAccumulator(pending),
        productionDeltas: [
          { settlementId: "s1", resourceId: "food", delta: 40 },
          { settlementId: "s1", resourceId: "food", delta: 20 },
        ],
        consumptionDeltas: [
          { settlementId: "s1", resourceId: "food", delta: -30 },
          { settlementId: "s1", resourceId: "food", delta: -20 },
        ],
      };

      const result = phaseLogsAndSnapshots(ctx, acc);
      const snap = result.resourceSnapshots[0];
      expect(snap?.produced).toBe(60);
      expect(snap?.consumed).toBe(50);
    });
  });

  describe("flow totals — trade in and trade out", () => {
    it("separates positive trade deltas (tradeIn) from negative (tradeOut)", () => {
      const ctx = makeContext({
        settlements: [
          { id: "s1", name: "Town A" },
          { id: "s2", name: "Town B" },
        ],
        stockpiles: [
          { settlementId: "s1", resourceId: "food", quantity: 100, cap: 200 },
          { settlementId: "s2", resourceId: "food", quantity: 80, cap: 200 },
        ],
      });
      const pending = new Map([
        ["s1:food", 90], // sent 10 out
        ["s2:food", 90], // received 10 in
      ]);
      const acc: PhaseLogsAndSnapshotsAccumulator = {
        ...makeEmptyAccumulator(pending),
        tradeRouteDeltas: [
          { settlementId: "s1", resourceId: "food", delta: -10 }, // trade out
          { settlementId: "s2", resourceId: "food", delta: 10 }, // trade in
        ],
      };

      const result = phaseLogsAndSnapshots(ctx, acc);
      const s1Snap = result.resourceSnapshots.find(
        (s) => s.settlementId === "s1",
      );
      const s2Snap = result.resourceSnapshots.find(
        (s) => s.settlementId === "s2",
      );
      expect(s1Snap?.tradeOut).toBe(10);
      expect(s1Snap?.tradeIn).toBe(0);
      expect(s2Snap?.tradeIn).toBe(10);
      expect(s2Snap?.tradeOut).toBe(0);
    });
  });

  describe("all phases combined — partial activity", () => {
    it("produces correct snapshot with production, consumption, and trade", () => {
      const ctx = makeContext({
        settlements: [
          { id: "s1", name: "Town A" },
          { id: "s2", name: "Town B" },
        ],
        citizens: [
          {
            id: "npc1",
            name: "npc1",
            citizenType: "npc",
            status: "alive",
            settlementId: "s1",
            bornOnTurnNumber: 1,
            parentACitizenId: null,
            parentBCitizenId: null,
            sex: "male",
          },
        ],
        stockpiles: [
          { settlementId: "s1", resourceId: "food", quantity: 50, cap: 200 },
          { settlementId: "s1", resourceId: "wood", quantity: 10, cap: 100 },
        ],
        tradeRoutes: [
          {
            id: "tr-1",
            originSettlementId: "s1",
            destinationSettlementId: "s2",
            resourceId: "wood",
            quantityPerTransition: 5,
            status: "active",
          },
        ],
      });
      // food: produced 20, consumed 15 (citizen consumption), net = +5; before=50, after=55
      // wood: produced 10, trade_out 5; before=10, after=15
      const pending = new Map([
        ["s1:food", 55],
        ["s1:wood", 15],
      ]);
      const acc: PhaseLogsAndSnapshotsAccumulator = {
        ...makeEmptyAccumulator(pending),
        productionDeltas: [
          { settlementId: "s1", resourceId: "food", delta: 20 },
          { settlementId: "s1", resourceId: "wood", delta: 10 },
        ],
        consumptionDeltas: [
          { settlementId: "s1", resourceId: "food", delta: -15 },
        ],
        tradeRouteDeltas: [
          { settlementId: "s1", resourceId: "wood", delta: -5 },
        ],
        tradeRouteOutcomes: [
          {
            tradeRouteId: "tr-1",
            delivered: true,
            quantityTransferred: 5,
            pauseReason: null,
          },
        ],
        allDeaths: [],
        citizenBirths: [],
      };

      const result = phaseLogsAndSnapshots(ctx, acc);

      // Settlement snapshot
      expect(result.settlementSnapshots).toHaveLength(2);
      const s1Snap = result.settlementSnapshots.find(
        (s) => s.settlementId === "s1",
      );
      expect(s1Snap?.aliveTotal).toBe(1);
      expect(s1Snap?.aliveNpc).toBe(1);
      expect(s1Snap?.tradeSummary).toHaveLength(1);
      expect(s1Snap?.tradeSummary[0]?.delivered).toBe(true);

      // Resource snapshots
      expect(result.resourceSnapshots).toHaveLength(2);
      const foodSnap = result.resourceSnapshots.find(
        (s) => s.resourceId === "food",
      );
      const woodSnap = result.resourceSnapshots.find(
        (s) => s.resourceId === "wood",
      );
      expect(foodSnap?.quantityBefore).toBe(50);
      expect(foodSnap?.quantityAfter).toBe(55);
      expect(foodSnap?.produced).toBe(20);
      expect(foodSnap?.consumed).toBe(15);
      expect(woodSnap?.tradeOut).toBe(5);
      expect(woodSnap?.produced).toBe(10);
    });
  });

  describe("logs are always empty (this phase emits no logs)", () => {
    it("returns empty logs array", () => {
      const ctx = makeContext({});
      const result = phaseLogsAndSnapshots(ctx, makeEmptyAccumulator());
      expect(result.logs).toHaveLength(0);
    });
  });
});
