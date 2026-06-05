import { describe, expect, it } from "vitest";

import { phaseTradeRoutes } from "./phaseTradeRoutes.ts";

import type {
  SimCitizenAssignment,
  SimJob,
  SimSettlement,
  SimStockpile,
  SimTradeRoute,
  SimTradeRouteLeg,
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

const POPULATION_RULES: SimulationInputState["populationRules"] = {
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

function makeSettlement(id: string, name = id): SimSettlement {
  return { id, name };
}

function makeTraderJob(id: string, capacityPerWorker: number): SimJob {
  return {
    baseCapacity: null,
    id,
    inputsJson: [],
    jobType: "trader",
    linkedDepositTypeId: null,
    linkedManagedPopulationTypeId: null,
    name: id,
    outputsJson: [],
    traderCapacityPerWorker: capacityPerWorker,
  };
}

function makeTradeAssignment(
  citizenId: string,
  tradeRouteId: string,
  tradeRouteEnd: "origin" | "destination",
  jobId: string,
): SimCitizenAssignment {
  return {
    assignedOnTurnNumber: 1,
    assignmentType: "trade_route",
    citizenId,
    constructionProjectId: null,
    depositInstanceId: null,
    jobId,
    managedPopulationInstanceId: null,
    tradeRouteEnd,
    tradeRouteId,
  };
}

function makeSendLeg(resourceId: string, qty: number): SimTradeRouteLeg {
  return { direction: "send", quantityPerTransition: qty, resourceId };
}

function makeReceiveLeg(resourceId: string, qty: number): SimTradeRouteLeg {
  return { direction: "receive", quantityPerTransition: qty, resourceId };
}

function makeRoute(
  id: string,
  originSettlementId: string,
  destinationSettlementId: string,
  legs: readonly SimTradeRouteLeg[],
  status: SimTradeRoute["status"] = "active",
): SimTradeRoute {
  return {
    destinationSettlementId,
    id,
    legs,
    originSettlementId,
    status,
  };
}

function makeStockpile(
  settlementId: string,
  resourceId: string,
  quantity: number,
  cap = 9999,
): SimStockpile {
  return { cap, quantity, resourceId, settlementId };
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
    depositTypes: [],
    deposits: [],
    jobs: [],
    managedPopulationTypes: [],
    managedPopulations: [],
    partnerships: [],
    populationRules: POPULATION_RULES,
    settlementBuildings: [],
    settlements: [],
    stockpiles: [],
    systemResourceIds: { foodId: "food", freshWaterId: "fresh-water" },
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

describe("phaseTradeRoutes", () => {
  it("returns empty output when no trade routes exist", () => {
    const ctx = makeContext({});
    const result = phaseTradeRoutes(ctx);
    expect(result.logs).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.tradeRouteOutcomes).toHaveLength(0);
  });

  it("skips routes with non-active/non-paused statuses", () => {
    const ctx = makeContext({
      settlements: [makeSettlement("s1"), makeSettlement("s2")],
      tradeRoutes: [
        makeRoute("r1", "s1", "s2", [makeSendLeg("grain", 10)], "proposed"),
        makeRoute("r2", "s1", "s2", [makeSendLeg("grain", 10)], "cancelled"),
        makeRoute("r3", "s1", "s2", [makeSendLeg("grain", 10)], "replaced"),
      ],
    });
    const result = phaseTradeRoutes(ctx);
    expect(result.tradeRouteOutcomes).toHaveLength(0);
  });

  describe("happy transfer — single send leg", () => {
    it("delivers goods, decrements origin, increments destination by exact quantity", () => {
      const traderJob = makeTraderJob("j1", 10);
      const ctx = makeContext({
        settlements: [makeSettlement("origin"), makeSettlement("dest")],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute(
            "r1",
            "origin",
            "dest",
            [makeSendLeg("grain", 10)],
            "active",
          ),
        ],
        stockpiles: [
          makeStockpile("origin", "grain", 50),
          makeStockpile("dest", "grain", 0, 100),
        ],
      });

      const result = phaseTradeRoutes(ctx);

      expect(result.tradeRouteOutcomes).toHaveLength(1);
      const outcome = result.tradeRouteOutcomes[0];
      expect(outcome?.delivered).toBe(true);
      expect(outcome?.pauseReason).toBeNull();
      expect(outcome?.quantityTransferred).toBe(10);
      expect(outcome?.tradeRouteId).toBe("r1");

      const originDelta = result.stockpileDeltas.find(
        (d) => d.settlementId === "origin" && d.resourceId === "grain",
      );
      const destDelta = result.stockpileDeltas.find(
        (d) => d.settlementId === "dest" && d.resourceId === "grain",
      );
      expect(originDelta?.delta).toBe(-10);
      expect(destDelta?.delta).toBe(10);

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]?.category).toBe("trade_route.delivered");
      expect(result.logs[0]?.phase).toBe("tradeRoutes");
      expect(result.notifications).toHaveLength(0);
    });
  });

  describe("multi-resource legs", () => {
    it("delivers all send legs atomically", () => {
      const traderJob = makeTraderJob("j1", 20);
      const ctx = makeContext({
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute(
            "r1",
            "s1",
            "s2",
            [makeSendLeg("grain", 5), makeSendLeg("wood", 5)],
            "active",
          ),
        ],
        stockpiles: [
          makeStockpile("s1", "grain", 20),
          makeStockpile("s1", "wood", 20),
          makeStockpile("s2", "grain", 0, 100),
          makeStockpile("s2", "wood", 0, 100),
        ],
      });

      const result = phaseTradeRoutes(ctx);

      expect(result.tradeRouteOutcomes[0]?.delivered).toBe(true);
      expect(result.tradeRouteOutcomes[0]?.quantityTransferred).toBe(10);

      const grainOriginDelta = result.stockpileDeltas.find(
        (d) => d.settlementId === "s1" && d.resourceId === "grain",
      );
      const woodOriginDelta = result.stockpileDeltas.find(
        (d) => d.settlementId === "s1" && d.resourceId === "wood",
      );
      expect(grainOriginDelta?.delta).toBe(-5);
      expect(woodOriginDelta?.delta).toBe(-5);
    });

    it("delivers send and receive legs atomically (barter)", () => {
      const traderJob = makeTraderJob("j1", 15);
      const ctx = makeContext({
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute(
            "r1",
            "s1",
            "s2",
            [makeSendLeg("grain", 10), makeReceiveLeg("gold", 5)],
            "active",
          ),
        ],
        stockpiles: [
          makeStockpile("s1", "grain", 20),
          makeStockpile("s1", "gold", 0, 100),
          makeStockpile("s2", "grain", 0, 100),
          makeStockpile("s2", "gold", 20),
        ],
      });

      const result = phaseTradeRoutes(ctx);

      expect(result.tradeRouteOutcomes[0]?.delivered).toBe(true);

      // s1 sends grain, receives gold
      const grainDeltaS1 = result.stockpileDeltas.find(
        (d) => d.settlementId === "s1" && d.resourceId === "grain",
      );
      const goldDeltaS1 = result.stockpileDeltas.find(
        (d) => d.settlementId === "s1" && d.resourceId === "gold",
      );
      expect(grainDeltaS1?.delta).toBe(-10);
      expect(goldDeltaS1?.delta).toBe(5);

      // s2 receives grain, sends gold
      const grainDeltaS2 = result.stockpileDeltas.find(
        (d) => d.settlementId === "s2" && d.resourceId === "grain",
      );
      const goldDeltaS2 = result.stockpileDeltas.find(
        (d) => d.settlementId === "s2" && d.resourceId === "gold",
      );
      expect(grainDeltaS2?.delta).toBe(10);
      expect(goldDeltaS2?.delta).toBe(-5);
    });

    it("pauses when one send leg fails — no partial delivery", () => {
      const traderJob = makeTraderJob("j1", 25);
      const ctx = makeContext({
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute(
            "r1",
            "s1",
            "s2",
            [
              makeSendLeg("grain", 10),
              makeSendLeg("wood", 10), // insufficient
            ],
            "active",
          ),
        ],
        stockpiles: [
          makeStockpile("s1", "grain", 20),
          makeStockpile("s1", "wood", 5), // only 5, need 10
          makeStockpile("s2", "grain", 0, 100),
          makeStockpile("s2", "wood", 0, 100),
        ],
      });

      const result = phaseTradeRoutes(ctx);

      expect(result.tradeRouteOutcomes[0]?.delivered).toBe(false);
      expect(result.tradeRouteOutcomes[0]?.pauseReason).toBe(
        "insufficient_origin_stock",
      );
      expect(result.stockpileDeltas).toHaveLength(0);
    });

    it("pauses when receive leg has insufficient destination stock", () => {
      const traderJob = makeTraderJob("j1", 15);
      const ctx = makeContext({
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute(
            "r1",
            "s1",
            "s2",
            [
              makeSendLeg("grain", 10),
              makeReceiveLeg("gold", 5), // destination doesn't have enough gold
            ],
            "active",
          ),
        ],
        stockpiles: [
          makeStockpile("s1", "grain", 20),
          makeStockpile("s1", "gold", 0, 100),
          makeStockpile("s2", "grain", 0, 100),
          makeStockpile("s2", "gold", 2), // only 2, need 5
        ],
      });

      const result = phaseTradeRoutes(ctx);

      expect(result.tradeRouteOutcomes[0]?.delivered).toBe(false);
      expect(result.tradeRouteOutcomes[0]?.pauseReason).toBe(
        "insufficient_destination_stock",
      );
      expect(result.stockpileDeltas).toHaveLength(0);
    });
  });

  describe("pause on origin trader shortage", () => {
    it("pauses when origin has no traders assigned", () => {
      const traderJob = makeTraderJob("j1", 10);
      const ctx = makeContext({
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        jobs: [traderJob],
        citizenAssignments: [
          // Only destination trader assigned, no origin trader
          makeTradeAssignment("c2", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute("r1", "s1", "s2", [makeSendLeg("grain", 10)], "active"),
        ],
        stockpiles: [
          makeStockpile("s1", "grain", 50),
          makeStockpile("s2", "grain", 0, 100),
        ],
      });

      const result = phaseTradeRoutes(ctx);

      expect(result.tradeRouteOutcomes).toHaveLength(1);
      const outcome = result.tradeRouteOutcomes[0];
      expect(outcome?.delivered).toBe(false);
      expect(outcome?.pauseReason).toBe("insufficient_trader_origin");
      expect(outcome?.quantityTransferred).toBe(0);

      expect(result.stockpileDeltas).toHaveLength(0);
      expect(result.logs[0]?.category).toBe("trade_route.paused");
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.notificationType).toBe(
        "trade_route.paused",
      );
    });

    it("pauses when origin trader capacity is below total leg quantity", () => {
      const traderJob = makeTraderJob("j1", 8); // capacity 8 < 10 required
      const ctx = makeContext({
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute("r1", "s1", "s2", [makeSendLeg("grain", 10)], "active"),
        ],
        stockpiles: [
          makeStockpile("s1", "grain", 50),
          makeStockpile("s2", "grain", 0, 100),
        ],
      });

      const result = phaseTradeRoutes(ctx);

      expect(result.tradeRouteOutcomes[0]?.pauseReason).toBe(
        "insufficient_trader_origin",
      );
    });
  });

  describe("pause on destination trader shortage", () => {
    it("pauses when destination has no traders assigned", () => {
      const traderJob = makeTraderJob("j1", 10);
      const ctx = makeContext({
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        jobs: [traderJob],
        citizenAssignments: [
          // Only origin trader assigned
          makeTradeAssignment("c1", "r1", "origin", "j1"),
        ],
        tradeRoutes: [
          makeRoute("r1", "s1", "s2", [makeSendLeg("grain", 10)], "active"),
        ],
        stockpiles: [
          makeStockpile("s1", "grain", 50),
          makeStockpile("s2", "grain", 0, 100),
        ],
      });

      const result = phaseTradeRoutes(ctx);

      expect(result.tradeRouteOutcomes[0]?.pauseReason).toBe(
        "insufficient_trader_destination",
      );
      expect(result.stockpileDeltas).toHaveLength(0);
    });
  });

  describe("pause on origin shortage", () => {
    it("pauses when origin stockpile has insufficient stock", () => {
      const traderJob = makeTraderJob("j1", 10);
      const ctx = makeContext({
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute("r1", "s1", "s2", [makeSendLeg("grain", 10)], "active"),
        ],
        stockpiles: [
          makeStockpile("s1", "grain", 5), // only 5, need 10
          makeStockpile("s2", "grain", 0, 100),
        ],
      });

      const result = phaseTradeRoutes(ctx);

      expect(result.tradeRouteOutcomes[0]?.delivered).toBe(false);
      expect(result.tradeRouteOutcomes[0]?.pauseReason).toBe(
        "insufficient_origin_stock",
      );
      expect(result.stockpileDeltas).toHaveLength(0);
      expect(result.logs[0]?.category).toBe("trade_route.paused");
      expect(result.notifications[0]?.notificationType).toBe(
        "trade_route.paused",
      );
    });

    it("pauses when origin has no stockpile entry for the resource", () => {
      const traderJob = makeTraderJob("j1", 10);
      const ctx = makeContext({
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute("r1", "s1", "s2", [makeSendLeg("grain", 10)], "active"),
        ],
        stockpiles: [makeStockpile("s2", "grain", 0, 100)],
      });

      const result = phaseTradeRoutes(ctx);
      expect(result.tradeRouteOutcomes[0]?.pauseReason).toBe(
        "insufficient_origin_stock",
      );
    });
  });

  describe("pause on destination cap", () => {
    it("pauses when destination stockpile is full", () => {
      const traderJob = makeTraderJob("j1", 10);
      const ctx = makeContext({
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute("r1", "s1", "s2", [makeSendLeg("grain", 10)], "active"),
        ],
        stockpiles: [
          makeStockpile("s1", "grain", 50),
          makeStockpile("s2", "grain", 95, 100), // only 5 space, need 10
        ],
      });

      const result = phaseTradeRoutes(ctx);

      expect(result.tradeRouteOutcomes[0]?.delivered).toBe(false);
      expect(result.tradeRouteOutcomes[0]?.pauseReason).toBe(
        "insufficient_destination_space",
      );
      expect(result.stockpileDeltas).toHaveLength(0);
      expect(result.logs[0]?.category).toBe("trade_route.paused");
      expect(result.notifications[0]?.notificationType).toBe(
        "trade_route.paused",
      );
    });

    it("pauses when destination has no stockpile entry (cap defaults to 0)", () => {
      const traderJob = makeTraderJob("j1", 10);
      const ctx = makeContext({
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute("r1", "s1", "s2", [makeSendLeg("grain", 10)], "active"),
        ],
        stockpiles: [makeStockpile("s1", "grain", 50)],
      });

      const result = phaseTradeRoutes(ctx);
      expect(result.tradeRouteOutcomes[0]?.pauseReason).toBe(
        "insufficient_destination_space",
      );
    });
  });

  describe("resume from paused", () => {
    it("resumes a paused route when all checks pass and emits resume log + notification", () => {
      const traderJob = makeTraderJob("j1", 10);
      const ctx = makeContext({
        settlements: [makeSettlement("origin"), makeSettlement("dest")],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute(
            "r1",
            "origin",
            "dest",
            [makeSendLeg("grain", 10)],
            "paused",
          ),
        ],
        stockpiles: [
          makeStockpile("origin", "grain", 50),
          makeStockpile("dest", "grain", 0, 100),
        ],
      });

      const result = phaseTradeRoutes(ctx);

      expect(result.tradeRouteOutcomes).toHaveLength(1);
      const outcome = result.tradeRouteOutcomes[0];
      expect(outcome?.delivered).toBe(true);
      expect(outcome?.pauseReason).toBeNull();
      expect(outcome?.quantityTransferred).toBe(10);

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]?.category).toBe("trade_route.resumed");
      expect(result.logs[0]?.phase).toBe("tradeRoutes");

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.notificationType).toBe(
        "trade_route.resumed",
      );

      const originDelta = result.stockpileDeltas.find(
        (d) => d.settlementId === "origin",
      );
      const destDelta = result.stockpileDeltas.find(
        (d) => d.settlementId === "dest",
      );
      expect(originDelta?.delta).toBe(-10);
      expect(destDelta?.delta).toBe(10);
    });

    it("paused route that still fails emits paused outcome with updated reason", () => {
      const traderJob = makeTraderJob("j1", 10);
      const ctx = makeContext({
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute("r1", "s1", "s2", [makeSendLeg("grain", 10)], "paused"),
        ],
        stockpiles: [
          makeStockpile("s1", "grain", 3), // still insufficient
          makeStockpile("s2", "grain", 0, 100),
        ],
      });

      const result = phaseTradeRoutes(ctx);
      expect(result.tradeRouteOutcomes[0]?.delivered).toBe(false);
      expect(result.tradeRouteOutcomes[0]?.pauseReason).toBe(
        "insufficient_origin_stock",
      );
    });

    it("already-paused route that still fails emits a log entry but no notification", () => {
      const traderJob = makeTraderJob("j1", 10);
      const ctx = makeContext({
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute("r1", "s1", "s2", [makeSendLeg("grain", 10)], "paused"),
        ],
        stockpiles: [
          makeStockpile("s1", "grain", 3), // still insufficient
          makeStockpile("s2", "grain", 0, 100),
        ],
      });

      const result = phaseTradeRoutes(ctx);
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]?.category).toBe("trade_route.paused");
      expect(result.notifications).toHaveLength(0);
    });
  });

  describe("intra-phase stockpile state", () => {
    it("second route sees updated stockpile after first route's transfer", () => {
      const traderJob = makeTraderJob("j1", 10);
      const ctx = makeContext({
        settlements: [
          makeSettlement("s1"),
          makeSettlement("s2"),
          makeSettlement("s3"),
        ],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
          makeTradeAssignment("c3", "r2", "origin", "j1"),
          makeTradeAssignment("c4", "r2", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute("r1", "s1", "s2", [makeSendLeg("grain", 10)], "active"),
          // r2 ships from s2 to s3 — after r1, s2 has 10 grain
          makeRoute("r2", "s2", "s3", [makeSendLeg("grain", 10)], "active"),
        ],
        stockpiles: [
          makeStockpile("s1", "grain", 20),
          makeStockpile("s2", "grain", 0, 200),
          makeStockpile("s3", "grain", 0, 200),
        ],
      });

      const result = phaseTradeRoutes(ctx);

      // Both routes should have delivered
      expect(result.tradeRouteOutcomes).toHaveLength(2);
      expect(result.tradeRouteOutcomes[0]?.delivered).toBe(true);
      expect(result.tradeRouteOutcomes[1]?.delivered).toBe(true);
    });

    it("second route fails if first route drains the shared stockpile", () => {
      const traderJob = makeTraderJob("j1", 10);
      const ctx = makeContext({
        settlements: [
          makeSettlement("s1"),
          makeSettlement("s2"),
          makeSettlement("s3"),
        ],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "destination", "j1"),
          makeTradeAssignment("c3", "r2", "origin", "j1"),
          makeTradeAssignment("c4", "r2", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute("r1", "s1", "s2", [makeSendLeg("grain", 10)], "active"),
          // r2 also ships from s1 which has only 10 — after r1 it will be empty
          makeRoute("r2", "s1", "s3", [makeSendLeg("grain", 10)], "active"),
        ],
        stockpiles: [
          makeStockpile("s1", "grain", 10), // exactly enough for r1, not r2
          makeStockpile("s2", "grain", 0, 200),
          makeStockpile("s3", "grain", 0, 200),
        ],
      });

      const result = phaseTradeRoutes(ctx);

      expect(result.tradeRouteOutcomes[0]?.delivered).toBe(true);
      expect(result.tradeRouteOutcomes[1]?.delivered).toBe(false);
      expect(result.tradeRouteOutcomes[1]?.pauseReason).toBe(
        "insufficient_origin_stock",
      );
    });
  });

  describe("multiple traders summing capacity", () => {
    it("two traders each with capacity 5 satisfy a route requiring 10", () => {
      const traderJob = makeTraderJob("j1", 5);
      const ctx = makeContext({
        settlements: [makeSettlement("s1"), makeSettlement("s2")],
        jobs: [traderJob],
        citizenAssignments: [
          makeTradeAssignment("c1", "r1", "origin", "j1"),
          makeTradeAssignment("c2", "r1", "origin", "j1"),
          makeTradeAssignment("c3", "r1", "destination", "j1"),
          makeTradeAssignment("c4", "r1", "destination", "j1"),
        ],
        tradeRoutes: [
          makeRoute("r1", "s1", "s2", [makeSendLeg("grain", 10)], "active"),
        ],
        stockpiles: [
          makeStockpile("s1", "grain", 50),
          makeStockpile("s2", "grain", 0, 100),
        ],
      });

      const result = phaseTradeRoutes(ctx);
      expect(result.tradeRouteOutcomes[0]?.delivered).toBe(true);
    });
  });
});
