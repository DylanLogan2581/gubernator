// Unit tests for phaseLogsAndSnapshots — this phase itself never emits log
// entries (it always returns `logs: []`); its own responsibility is wiring
// the accumulated outputs of every earlier phase into
// buildSettlementSnapshots / buildResourceSnapshots. These tests verify that
// wiring, not the builders' internal arithmetic (covered elsewhere).
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseLogsAndSnapshots } from "./phaseLogsAndSnapshots.ts";
import { makeCitizen, makeContext, makeSettlement } from "./testFixtures.ts";

import type { PhaseLogsAndSnapshotsAccumulator } from "./phaseLogsAndSnapshots.ts";
import type {
  CitizenBirth,
  CitizenDeath,
  SimCitizen,
  SimSettlement,
  SimStockpile,
  SimulationContext,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAccumulator(
  overrides: Partial<PhaseLogsAndSnapshotsAccumulator> = {},
): PhaseLogsAndSnapshotsAccumulator {
  return {
    allDeaths: [],
    buildingStateChanges: [],
    citizenBirths: [],
    consumptionDeltas: [],
    depositUpdates: [],
    educationSummaryBySettlementId: new Map(),
    managedPopulationUpdates: [],
    partnershipChanges: [],
    pendingStockpiles: new Map(),
    productionDeltas: [],
    tradeRouteDeltas: [],
    tradeRouteOutcomes: [],
    ...overrides,
  };
}

function makeDeath(
  overrides: Partial<CitizenDeath> & { citizenId: string },
): CitizenDeath {
  return {
    category: "starvation",
    detail: null,
    ...overrides,
  };
}

function makeBirth(
  overrides: Partial<CitizenBirth> & { settlementId: string },
): CitizenBirth {
  return {
    cultureId: null,
    givenName: "Newborn",
    namesetId: null,
    npcFlaw: null,
    npcGoal: null,
    npcSecretContradiction: null,
    npcTrait1: null,
    npcTrait2: null,
    parentACitizenId: "parent-a",
    parentBCitizenId: "parent-b",
    religionId: null,
    sex: "female",
    surname: null,
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

function buildContext(params: {
  citizens?: SimCitizen[];
  settlements?: SimSettlement[];
  stockpiles?: SimStockpile[];
  turnNumber?: number;
}): SimulationContext {
  return makeContext({
    citizens: params.citizens ?? [],
    settlements: params.settlements ?? [makeSettlement({ id: "s1" })],
    stockpiles: params.stockpiles ?? [],
    turnNumber: params.turnNumber ?? 1,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseLogsAndSnapshots — log emission", () => {
  it("always returns an empty logs array, even when the accumulator is full of events", () => {
    const ctx = buildContext({
      citizens: [makeCitizen({ id: "c1", settlementId: "s1", status: "alive" })],
    });
    const accumulator = makeAccumulator({
      allDeaths: [makeDeath({ citizenId: "c1" })],
      citizenBirths: [makeBirth({ settlementId: "s1" })],
      partnershipChanges: [
        { citizenAId: "c1", citizenBId: "c2", type: "formed" },
      ],
    });

    const result = phaseLogsAndSnapshots(ctx, accumulator);

    expect(result.logs).toEqual([]);
  });

  it("returns an empty logs array for a fully empty accumulator too", () => {
    const ctx = buildContext({});
    const result = phaseLogsAndSnapshots(ctx, makeAccumulator());

    expect(result.logs).toEqual([]);
  });
});

describe("phaseLogsAndSnapshots — settlement snapshot wiring", () => {
  it("wires deaths/births/partnerships into buildSettlementSnapshots for a single settlement", () => {
    const ctx = buildContext({
      citizens: [
        makeCitizen({ id: "c1", settlementId: "s1", status: "alive" }),
        makeCitizen({ id: "c2", settlementId: "s1", status: "alive" }),
      ],
      settlements: [makeSettlement({ id: "s1" })],
      turnNumber: 7,
    });
    const accumulator = makeAccumulator({
      allDeaths: [makeDeath({ citizenId: "c1" })],
      citizenBirths: [makeBirth({ settlementId: "s1" })],
      partnershipChanges: [
        { citizenAId: "c2", citizenBId: "c1", type: "formed" },
      ],
    });

    const result = phaseLogsAndSnapshots(ctx, accumulator);

    expect(result.settlementSnapshots).toHaveLength(1);
    const snap = result.settlementSnapshots[0];
    expect(snap.settlementId).toBe("s1");
    expect(snap.turnNumber).toBe(7);
    expect(snap.deathCount).toBe(1);
    expect(snap.starvationDeathsCount).toBe(1);
    expect(snap.birthCount).toBe(1);
    expect(snap.partnershipsFormedCount).toBe(1);
  });

  it("produces one settlementSnapshot per settlement in context.input.settlements", () => {
    const ctx = buildContext({
      settlements: [makeSettlement({ id: "s1" }), makeSettlement({ id: "s2" })],
      turnNumber: 3,
    });

    const result = phaseLogsAndSnapshots(ctx, makeAccumulator());

    expect(result.settlementSnapshots).toHaveLength(2);
    expect(result.settlementSnapshots.map((s) => s.settlementId).sort()).toEqual([
      "s1",
      "s2",
    ]);
    for (const snap of result.settlementSnapshots) {
      expect(snap.turnNumber).toBe(3);
      expect(snap.aliveTotal).toBe(0);
    }
  });
});

describe("phaseLogsAndSnapshots — resource snapshot wiring", () => {
  it("wires production/consumption/trade deltas and pendingStockpiles into buildResourceSnapshots", () => {
    const ctx = buildContext({
      stockpiles: [makeStockpile({ quantity: 50, resourceId: "wood", settlementId: "s1" })],
      turnNumber: 9,
    });
    const accumulator = makeAccumulator({
      consumptionDeltas: [{ delta: -15, resourceId: "wood", settlementId: "s1" }],
      pendingStockpiles: new Map([["s1:wood", 55]]),
      productionDeltas: [{ delta: 20, resourceId: "wood", settlementId: "s1" }],
      tradeRouteDeltas: [{ delta: -10, resourceId: "wood", settlementId: "s1" }],
    });

    const result = phaseLogsAndSnapshots(ctx, accumulator);

    expect(result.resourceSnapshots).toEqual([
      {
        consumed: 15,
        produced: 20,
        quantityAfter: 55,
        quantityBefore: 50,
        resourceId: "wood",
        settlementId: "s1",
        tradeIn: 0,
        tradeOut: 10,
        turnNumber: 9,
      },
    ]);
  });

  it("produces one resourceSnapshot per stockpile across multiple settlements/resources", () => {
    const ctx = buildContext({
      stockpiles: [
        makeStockpile({ quantity: 10, resourceId: "wood", settlementId: "s1" }),
        makeStockpile({ quantity: 20, resourceId: "stone", settlementId: "s2" }),
      ],
    });

    const result = phaseLogsAndSnapshots(ctx, makeAccumulator());

    expect(result.resourceSnapshots).toHaveLength(2);
    // With no deltas and no pendingStockpiles entries, quantityAfter falls
    // back to quantityBefore for every stockpile.
    for (const snap of result.resourceSnapshots) {
      expect(snap.quantityAfter).toBe(snap.quantityBefore);
      expect(snap.produced).toBe(0);
      expect(snap.consumed).toBe(0);
      expect(snap.tradeIn).toBe(0);
      expect(snap.tradeOut).toBe(0);
    }
  });
});
