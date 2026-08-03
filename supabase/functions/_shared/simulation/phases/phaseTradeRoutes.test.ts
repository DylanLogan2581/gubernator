// Unit tests for phaseTradeRoutes — per-leg resource transfer arithmetic,
// all-or-nothing pause/resume behaviour, and multi-route isolation.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseTradeRoutes } from "./phaseTradeRoutes.ts";
import { makeAssignment, makeContext, makeNation, makeSettlement } from "./testFixtures.ts";

import type {
  SimCitizenAssignment,
  SimJob,
  SimNation,
  SimNationOffice,
  SimNationRelationship,
  SimSettlement,
  SimStockpile,
  SimTradeRoute,
  SimTradeRouteLeg,
  SimulationContext,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLeg(overrides: Partial<SimTradeRouteLeg> = {}): SimTradeRouteLeg {
  return {
    direction: "send",
    quantityPerTransition: 10,
    resourceId: "wood",
    ...overrides,
  };
}

function makeRoute(
  overrides: Partial<SimTradeRoute> & { id: string },
): SimTradeRoute {
  return {
    destinationSettlementId: "dest",
    legs: [makeLeg()],
    originSettlementId: "origin",
    status: "active",
    ...overrides,
  };
}

function makeTraderJob(
  overrides: Partial<SimJob> & { id: string },
): SimJob {
  return {
    baseCapacity: null,
    inputsJson: [],
    jobType: "trader",
    linkedDepositTypeId: null,
    linkedManagedPopulationTypeId: null,
    name: overrides.id,
    outputsJson: [],
    requiredEducationLevelId: null,
    traderCapacityPerWorker: 10,
    ...overrides,
  };
}

function makeStockpile(
  overrides: Partial<SimStockpile> & { resourceId: string; settlementId: string },
): SimStockpile {
  return {
    cap: 1000,
    quantity: 0,
    ...overrides,
  };
}

// Full-capacity trader coverage at both ends of `routeId` for `jobId` — most
// tests want this so only the stockpile/status assertions under test vary.
function makeTraderAssignments(
  routeId: string,
  jobId: string,
): SimCitizenAssignment[] {
  return [
    makeAssignment({
      assignmentType: "trade_route",
      citizenId: "trader-origin",
      jobId,
      tradeRouteEnd: "origin",
      tradeRouteId: routeId,
    }),
    makeAssignment({
      assignmentType: "trade_route",
      citizenId: "trader-destination",
      jobId,
      tradeRouteEnd: "destination",
      tradeRouteId: routeId,
    }),
  ];
}

const DEFAULT_SETTLEMENTS: SimSettlement[] = [
  makeSettlement({ id: "origin", name: "Originburg" }),
  makeSettlement({ id: "dest", name: "Destville" }),
];

function buildContext(params: {
  assignments?: SimCitizenAssignment[];
  jobs?: SimJob[];
  nationOffices?: SimNationOffice[];
  nationRelationships?: SimNationRelationship[];
  nations?: SimNation[];
  pendingStockpiles?: Record<string, number>;
  settlements?: SimSettlement[];
  stockpiles?: SimStockpile[];
  tradeRoutes?: SimTradeRoute[];
}): SimulationContext {
  const ctx = makeContext({
    citizenAssignments: params.assignments ?? [],
    jobs: params.jobs ?? [],
    nationOffices: params.nationOffices ?? [],
    nationRelationships: params.nationRelationships ?? [],
    nations: params.nations ?? [],
    settlements: params.settlements ?? DEFAULT_SETTLEMENTS,
    stockpiles: params.stockpiles ?? [],
    tradeRoutes: params.tradeRoutes ?? [],
  });
  for (const [key, qty] of Object.entries(params.pendingStockpiles ?? {})) {
    ctx.shared.pendingStockpiles.set(key, qty);
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseTradeRoutes — successful transfers", () => {
  it("transfers a single 'send' leg origin -> destination with net-zero deltas", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes).toEqual([
      {
        delivered: true,
        pauseReason: null,
        quantityTransferred: 10,
        tradeRouteId: "r1",
      },
    ]);

    expect(result.stockpileDeltas).toEqual([
      { delta: -10, resourceId: "wood", settlementId: "origin" },
      { delta: 10, resourceId: "wood", settlementId: "dest" },
    ]);
    const netDelta = result.stockpileDeltas.reduce((sum, d) => sum + d.delta, 0);
    expect(netDelta).toBe(0);

    expect(result.logs).toEqual([
      {
        category: "trade_route.delivered",
        payload: {
          destinationSettlementId: "dest",
          originSettlementId: "origin",
          quantityTransferred: 10,
          tradeRouteId: "r1",
        },
        phase: "tradeRoutes",
      },
    ]);
    // A plain (non-resuming) delivery emits no notification.
    expect(result.notifications).toEqual([]);
  });

  it("transfers a 'receive' leg destination -> origin with reversed arithmetic", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({
      id: "r2",
      legs: [makeLeg({ direction: "receive", quantityPerTransition: 5, resourceId: "copper" })],
    });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r2", "trader-job"),
      jobs: [job],
      pendingStockpiles: { "dest:copper": 50, "origin:copper": 0 },
      stockpiles: [
        makeStockpile({ resourceId: "copper", settlementId: "origin" }),
        makeStockpile({ resourceId: "copper", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes).toEqual([
      {
        delivered: true,
        pauseReason: null,
        quantityTransferred: 5,
        tradeRouteId: "r2",
      },
    ]);
    expect(result.stockpileDeltas).toEqual([
      { delta: -5, resourceId: "copper", settlementId: "dest" },
      { delta: 5, resourceId: "copper", settlementId: "origin" },
    ]);
  });
});

describe("phaseTradeRoutes — pause behavior", () => {
  it("pauses all-or-nothing on insufficient origin stock (no deltas at all)", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 5 }, // needs 10
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes).toEqual([
      {
        delivered: false,
        pauseReason: "insufficient_origin_stock",
        quantityTransferred: 0,
        tradeRouteId: "r1",
      },
    ]);
    expect(result.stockpileDeltas).toEqual([]);
    expect(result.logs).toEqual([
      {
        category: "trade_route.paused",
        payload: {
          destinationSettlementId: "dest",
          pauseReason: "insufficient_origin_stock",
          quantityPerTransition: 10,
          resourceId: "wood",
          tradeRouteId: "r1",
        },
        phase: "tradeRoutes",
        settlementId: "origin",
      },
    ]);
    // Freshly paused (was previously active) -> notification emitted once.
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]).toMatchObject({
      notificationType: "trade_route.paused",
      scope: "settlement",
      settlementId: "origin",
    });
  });

  it("does not re-notify when a route that was already paused stays paused", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1", status: "paused" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 5 },
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes[0].delivered).toBe(false);
    // Log is still emitted every turn the route stays paused...
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].category).toBe("trade_route.paused");
    // ...but the "just paused" notification does not repeat.
    expect(result.notifications).toEqual([]);
  });

  it("pauses on insufficient trader capacity at origin before checking stock", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1" });
    const ctx = buildContext({
      // Only destination end staffed — origin has zero trader capacity.
      assignments: [
        makeAssignment({
          assignmentType: "trade_route",
          citizenId: "trader-destination",
          jobId: "trader-job",
          tradeRouteEnd: "destination",
          tradeRouteId: "r1",
        }),
      ],
      jobs: [job],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes[0].pauseReason).toBe("insufficient_trader_origin");
    expect(result.stockpileDeltas).toEqual([]);
    // Gate-level pauses (not tied to a specific leg failure) still report the
    // route's resource/quantity so history entries aren't blank (#1324).
    expect(result.logs[0].payload).toMatchObject({
      quantityPerTransition: 10,
      resourceId: "wood",
    });
  });

  it("pauses on insufficient trader capacity at destination", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1" });
    const ctx = buildContext({
      // Only origin end staffed — destination has zero trader capacity.
      assignments: [
        makeAssignment({
          assignmentType: "trade_route",
          citizenId: "trader-origin",
          jobId: "trader-job",
          tradeRouteEnd: "origin",
          tradeRouteId: "r1",
        }),
      ],
      jobs: [job],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes[0].pauseReason).toBe("insufficient_trader_destination");
    expect(result.stockpileDeltas).toEqual([]);
  });

  it("blocks the whole route (all-or-nothing) when only a later leg fails", () => {
    const job = makeTraderJob({ id: "trader-job", traderCapacityPerWorker: 30 });
    const route = makeRoute({
      id: "r1",
      legs: [
        // First leg alone would succeed...
        makeLeg({ direction: "send", quantityPerTransition: 10, resourceId: "wood" }),
        // ...but the second leg cannot fit in destination's remaining capacity.
        makeLeg({ direction: "send", quantityPerTransition: 10, resourceId: "stone" }),
      ],
    });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      pendingStockpiles: {
        "dest:stone": 195, // cap 200, room for only 5
        "dest:wood": 0,
        "origin:stone": 100,
        "origin:wood": 100,
      },
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
        makeStockpile({ cap: 200, resourceId: "stone", settlementId: "origin" }),
        makeStockpile({ cap: 200, resourceId: "stone", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes).toEqual([
      {
        delivered: false,
        pauseReason: "insufficient_destination_space",
        quantityTransferred: 0,
        tradeRouteId: "r1",
      },
    ]);
    // Neither leg's transfer is applied — no wood delta despite leg 1 being fine on its own.
    expect(result.stockpileDeltas).toEqual([]);
  });
});

describe("phaseTradeRoutes — resume behavior", () => {
  it("resumes a paused route once checks pass, emitting resumed log + notification", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1", status: "paused" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes).toEqual([
      {
        delivered: true,
        pauseReason: null,
        quantityTransferred: 10,
        tradeRouteId: "r1",
      },
    ]);
    expect(result.logs).toEqual([
      {
        category: "trade_route.resumed",
        payload: {
          destinationSettlementId: "dest",
          quantityTransferred: 10,
          tradeRouteId: "r1",
        },
        phase: "tradeRoutes",
        settlementId: "origin",
      },
    ]);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]).toMatchObject({
      notificationType: "trade_route.resumed",
      scope: "settlement",
      settlementId: "origin",
    });
  });
});

describe("phaseTradeRoutes — diplomacy (#1088)", () => {
  const WARRING_SETTLEMENTS: SimSettlement[] = [
    makeSettlement({ id: "origin", name: "Originburg", nationId: "nation-a" }),
    makeSettlement({ id: "dest", name: "Destville", nationId: "nation-b" }),
  ];

  it("pauses an active international route with reason nations_at_war when either direction is at_war", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      nationRelationships: [
        { currentStance: "at_war", fromNationId: "nation-a", toNationId: "nation-b" },
      ],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      settlements: WARRING_SETTLEMENTS,
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes).toEqual([
      {
        delivered: false,
        pauseReason: "nations_at_war",
        quantityTransferred: 0,
        tradeRouteId: "r1",
      },
    ]);
    expect(result.stockpileDeltas).toEqual([]);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]).toMatchObject({
      notificationType: "trade_route.paused",
      scope: "settlement",
      settlementId: "origin",
    });
  });

  it("pauses when only the reciprocal direction's row reads at_war", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      // Row is keyed nation-b -> nation-a, not nation-a -> nation-b.
      nationRelationships: [
        { currentStance: "at_war", fromNationId: "nation-b", toNationId: "nation-a" },
      ],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      settlements: WARRING_SETTLEMENTS,
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes[0]).toMatchObject({
      delivered: false,
      pauseReason: "nations_at_war",
    });
  });

  it("does not re-notify while a war-paused route stays at war", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1", status: "paused" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      nationRelationships: [
        { currentStance: "at_war", fromNationId: "nation-a", toNationId: "nation-b" },
      ],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      settlements: WARRING_SETTLEMENTS,
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes[0]?.pauseReason).toBe("nations_at_war");
    expect(result.notifications).toEqual([]);
  });

  it("auto-resumes a war-paused route once peace is restored (subject to normal checks)", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1", status: "paused" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      // No at_war relationship rows — peace has been restored.
      nationRelationships: [],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      settlements: WARRING_SETTLEMENTS,
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes).toEqual([
      {
        delivered: true,
        pauseReason: null,
        quantityTransferred: 10,
        tradeRouteId: "r1",
      },
    ]);
    expect(result.logs[0]?.category).toBe("trade_route.resumed");
  });

  it("does not pause an internal (same-nation) route even if hostile/at_war rows exist elsewhere", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      nationRelationships: [
        { currentStance: "at_war", fromNationId: "nation-a", toNationId: "nation-c" },
      ],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      settlements: [
        makeSettlement({ id: "origin", nationId: "nation-a" }),
        makeSettlement({ id: "dest", nationId: "nation-a" }),
      ],
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes[0]).toMatchObject({ delivered: true, pauseReason: null });
  });

  it("does not pause on hostile alone (only at_war pauses trade)", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      nationRelationships: [
        { currentStance: "hostile", fromNationId: "nation-a", toNationId: "nation-b" },
      ],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      settlements: WARRING_SETTLEMENTS,
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes[0]).toMatchObject({ delivered: true, pauseReason: null });
  });
});

describe("phaseTradeRoutes — trade policy (#1134)", () => {
  const TRADE_SETTLEMENTS: SimSettlement[] = [
    makeSettlement({ id: "origin", name: "Originburg", nationId: "nation-a" }),
    makeSettlement({ id: "dest", name: "Destville", nationId: "nation-b" }),
  ];

  it("pauses an active international route with reason trade_policy_closed when the origin nation closes its borders", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      nations: [
        makeNation({ id: "nation-a", tradePolicy: "closed" }),
        makeNation({ id: "nation-b" }),
      ],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      settlements: TRADE_SETTLEMENTS,
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes).toEqual([
      {
        delivered: false,
        pauseReason: "trade_policy_closed",
        quantityTransferred: 0,
        tradeRouteId: "r1",
      },
    ]);
    expect(result.stockpileDeltas).toEqual([]);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]).toMatchObject({
      notificationType: "trade_route.paused",
      scope: "settlement",
      settlementId: "origin",
    });
  });

  it("pauses when the destination nation closes its borders", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      nations: [
        makeNation({ id: "nation-a" }),
        makeNation({ id: "nation-b", tradePolicy: "closed" }),
      ],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      settlements: TRADE_SETTLEMENTS,
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes[0]).toMatchObject({
      delivered: false,
      pauseReason: "trade_policy_closed",
    });
  });

  it("does not re-notify while a closed-border-paused route stays closed", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1", status: "paused" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      nations: [
        makeNation({ id: "nation-a", tradePolicy: "closed" }),
        makeNation({ id: "nation-b" }),
      ],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      settlements: TRADE_SETTLEMENTS,
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes[0]?.pauseReason).toBe("trade_policy_closed");
    expect(result.notifications).toEqual([]);
  });

  it("auto-resumes a closed-border-paused route once the policy reopens (subject to normal checks)", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1", status: "paused" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      // Both nations back to 'free' — borders reopened.
      nations: [
        makeNation({ id: "nation-a" }),
        makeNation({ id: "nation-b" }),
      ],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      settlements: TRADE_SETTLEMENTS,
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes).toEqual([
      {
        delivered: true,
        pauseReason: null,
        quantityTransferred: 10,
        tradeRouteId: "r1",
      },
    ]);
    expect(result.logs[0]?.category).toBe("trade_route.resumed");
  });

  it("does not pause an internal (same-nation) route even if its nation is closed", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      nations: [makeNation({ id: "nation-a", tradePolicy: "closed" })],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      settlements: [
        makeSettlement({ id: "origin", nationId: "nation-a" }),
        makeSettlement({ id: "dest", nationId: "nation-a" }),
      ],
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes[0]).toMatchObject({ delivered: true, pauseReason: null });
  });

  it("does not pause on state_controlled alone (only closed pauses existing routes)", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      nations: [
        makeNation({ id: "nation-a", tradePolicy: "state_controlled" }),
        makeNation({ id: "nation-b" }),
      ],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      settlements: TRADE_SETTLEMENTS,
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes[0]).toMatchObject({ delivered: true, pauseReason: null });
  });
});

describe("phaseTradeRoutes — route status filtering & multi-route isolation", () => {
  it("skips routes that are neither active nor paused", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const cancelledRoute = makeRoute({ id: "r-cancelled", status: "cancelled" });
    const proposedRoute = makeRoute({ id: "r-proposed", status: "proposed" });
    const ctx = buildContext({
      assignments: [
        ...makeTraderAssignments("r-cancelled", "trader-job"),
        ...makeTraderAssignments("r-proposed", "trader-job"),
      ],
      jobs: [job],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [cancelledRoute, proposedRoute],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes).toEqual([]);
    expect(result.logs).toEqual([]);
    expect(result.stockpileDeltas).toEqual([]);
  });

  it("processes multiple routes independently — one succeeds, one pauses", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const settlements: SimSettlement[] = [
      makeSettlement({ id: "origin" }),
      makeSettlement({ id: "dest" }),
      makeSettlement({ id: "origin2" }),
      makeSettlement({ id: "dest2" }),
    ];
    const goodRoute = makeRoute({ id: "r-good" });
    const badRoute = makeRoute({
      destinationSettlementId: "dest2",
      id: "r-bad",
      originSettlementId: "origin2",
    });
    const ctx = buildContext({
      assignments: [
        ...makeTraderAssignments("r-good", "trader-job"),
        ...makeTraderAssignments("r-bad", "trader-job"),
      ],
      jobs: [job],
      pendingStockpiles: {
        "dest2:wood": 0,
        "dest:wood": 0,
        "origin2:wood": 2, // insufficient — needs 10
        "origin:wood": 100,
      },
      settlements,
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
        makeStockpile({ resourceId: "wood", settlementId: "origin2" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest2" }),
      ],
      tradeRoutes: [goodRoute, badRoute],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes).toHaveLength(2);
    const good = result.tradeRouteOutcomes.find((o) => o.tradeRouteId === "r-good");
    const bad = result.tradeRouteOutcomes.find((o) => o.tradeRouteId === "r-bad");
    expect(good).toEqual({
      delivered: true,
      pauseReason: null,
      quantityTransferred: 10,
      tradeRouteId: "r-good",
    });
    expect(bad).toEqual({
      delivered: false,
      pauseReason: "insufficient_origin_stock",
      quantityTransferred: 0,
      tradeRouteId: "r-bad",
    });
    // Only the succeeding route contributes deltas.
    expect(result.stockpileDeltas).toEqual([
      { delta: -10, resourceId: "wood", settlementId: "origin" },
      { delta: 10, resourceId: "wood", settlementId: "dest" },
    ]);
  });
});

describe("phaseTradeRoutes — officeholder exclusion", () => {
  it("does not count an officeholder's trader capacity, pausing the route", () => {
    const job = makeTraderJob({ id: "trader-job" });
    const route = makeRoute({ id: "r1" });
    const ctx = buildContext({
      assignments: makeTraderAssignments("r1", "trader-job"),
      jobs: [job],
      // trader-origin holds a nation office and stops counting toward capacity.
      nationOffices: [{ citizenId: "trader-origin", excludesFromLabor: true }],
      pendingStockpiles: { "dest:wood": 0, "origin:wood": 100 },
      stockpiles: [
        makeStockpile({ resourceId: "wood", settlementId: "origin" }),
        makeStockpile({ resourceId: "wood", settlementId: "dest" }),
      ],
      tradeRoutes: [route],
    });

    const result = phaseTradeRoutes(ctx);

    expect(result.tradeRouteOutcomes).toEqual([
      {
        delivered: false,
        pauseReason: "insufficient_trader_origin",
        quantityTransferred: 0,
        tradeRouteId: "r1",
      },
    ]);
  });
});
