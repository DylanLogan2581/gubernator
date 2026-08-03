// Unit tests for phaseMilitaryUpkeep — upkeep payment, desertion on
// shortfall, unit disband, and deserter settlement placement.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseMilitaryUpkeep } from "./phaseMilitaryUpkeep.ts";
import { makeContext } from "./testFixtures.ts";

import type {
  SimArmy,
  SimArmyUnit,
  SimulationContext,
  SimUnitSoldier,
  SimUnitType,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArmy(overrides: Partial<SimArmy> & { id: string }): SimArmy {
  return {
    fundingSource: "nation",
    name: "Testguard",
    nationId: "n1",
    stationedSettlementId: "s1",
    ...overrides,
  };
}

function makeUnit(overrides: Partial<SimArmyUnit> & { id: string }): SimArmyUnit {
  return {
    armyId: "a1",
    unitTypeId: "ut1",
    ...overrides,
  };
}

function makeUnitType(overrides: Partial<SimUnitType> & { id: string }): SimUnitType {
  return {
    desertionRate: 0.5,
    upkeepCostsJson: [{ amount: 2, resourceId: "food" }],
    ...overrides,
  };
}

function makeSoldier(
  overrides: Partial<SimUnitSoldier> & { id: string; unitId: string },
): SimUnitSoldier {
  return {
    citizenId: overrides.id,
    homeSettlementId: "home1",
    ...overrides,
  };
}

/** Builds a context and pre-seeds shared stockpile pools from key/value pairs. */
function makeUpkeepContext(
  overrides: Parameters<typeof makeContext>[0] & {
    pendingStockpiles?: Record<string, number>;
    pendingNationStockpiles?: Record<string, number>;
  },
): SimulationContext {
  const { pendingStockpiles = {}, pendingNationStockpiles = {}, ...rest } = overrides;
  const ctx = makeContext(rest);
  for (const [key, value] of Object.entries(pendingStockpiles)) {
    ctx.shared.pendingStockpiles.set(key, value);
  }
  for (const [key, value] of Object.entries(pendingNationStockpiles)) {
    ctx.shared.pendingNationStockpiles.set(key, value);
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseMilitaryUpkeep — full payment", () => {
  it("pays upkeep in full and causes no desertion", () => {
    const ctx = makeUpkeepContext({
      armies: [makeArmy({ id: "a1" })],
      armyUnits: [makeUnit({ id: "u1" })],
      unitTypes: [makeUnitType({ id: "ut1" })],
      unitSoldiers: [
        makeSoldier({ id: "sol1", unitId: "u1" }),
        makeSoldier({ id: "sol2", unitId: "u1" }),
        makeSoldier({ id: "sol3", unitId: "u1" }),
      ],
      pendingNationStockpiles: { "n1:food": 10 },
      turnNumber: 5,
    });

    const result = phaseMilitaryUpkeep(ctx);

    expect(result.nationStockpileDeltas).toEqual([
      { delta: -6, nationId: "n1", resourceId: "food" },
    ]);
    expect(result.stockpileDeltas).toEqual([]);
    expect(result.desertedSoldiers).toEqual([]);
    expect(result.disbandedUnits).toEqual([]);
    expect(result.notifications).toEqual([]);
    expect(result.armyTurnSnapshots).toEqual([
      {
        armyId: "a1",
        soldierCountTotal: 3,
        soldiersByUnitTypeJson: { ut1: 3 },
        turnNumber: 5,
        upkeepPaid: true,
      },
    ]);
  });

  it("pays from the host settlement stockpile when funding source is host_settlement", () => {
    const ctx = makeUpkeepContext({
      armies: [makeArmy({ id: "a1", fundingSource: "host_settlement", stationedSettlementId: "s1" })],
      armyUnits: [makeUnit({ id: "u1" })],
      unitTypes: [makeUnitType({ id: "ut1" })],
      unitSoldiers: [makeSoldier({ id: "sol1", unitId: "u1" })],
      pendingStockpiles: { "s1:food": 10 },
      turnNumber: 1,
    });

    const result = phaseMilitaryUpkeep(ctx);

    expect(result.stockpileDeltas).toEqual([{ delta: -2, resourceId: "food", settlementId: "s1" }]);
    expect(result.nationStockpileDeltas).toEqual([]);
    expect(result.armyTurnSnapshots[0].upkeepPaid).toBe(true);
    expect(result.desertedSoldiers).toEqual([]);
  });
});

describe("phaseMilitaryUpkeep — shortfall desertion", () => {
  it("deducts what's available and deserts floor(soldiers * desertionRate) on shortfall", () => {
    const ctx = makeUpkeepContext({
      armies: [makeArmy({ id: "a1" })],
      armyUnits: [makeUnit({ id: "u1" })],
      unitTypes: [makeUnitType({ id: "ut1", desertionRate: 0.5 })],
      unitSoldiers: [
        makeSoldier({ id: "sol1", unitId: "u1" }),
        makeSoldier({ id: "sol2", unitId: "u1" }),
        makeSoldier({ id: "sol3", unitId: "u1" }),
      ],
      pendingNationStockpiles: { "n1:food": 3 },
      turnNumber: 1,
    });

    const result = phaseMilitaryUpkeep(ctx);

    // Paid whatever was available, capped at the required amount.
    expect(result.nationStockpileDeltas).toEqual([
      { delta: -3, nationId: "n1", resourceId: "food" },
    ]);
    expect(result.armyTurnSnapshots[0].upkeepPaid).toBe(false);
    expect(result.desertedSoldiers).toHaveLength(1);
    expect(result.armyTurnSnapshots[0].soldierCountTotal).toBe(2);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].messageText).toBe(
      "Testguard went unpaid — 1 soldier deserted",
    );
    expect(result.notifications[0].notificationType).toBe("military.upkeep_unpaid");
    expect(result.logs).toContainEqual({
      category: "military.upkeep_unpaid",
      nationId: "n1",
      payload: { armyId: "a1", desertedSoldierCount: 1 },
      phase: "militaryUpkeep",
    });
  });

  it("deserts a minimum of 1 soldier when the raw floor rounds to zero", () => {
    const ctx = makeUpkeepContext({
      armies: [makeArmy({ id: "a1" })],
      armyUnits: [makeUnit({ id: "u1" })],
      unitTypes: [makeUnitType({ id: "ut1", desertionRate: 0.1 })],
      unitSoldiers: [
        makeSoldier({ id: "sol1", unitId: "u1" }),
        makeSoldier({ id: "sol2", unitId: "u1" }),
        makeSoldier({ id: "sol3", unitId: "u1" }),
      ],
      pendingNationStockpiles: { "n1:food": 0 },
      turnNumber: 1,
    });

    const result = phaseMilitaryUpkeep(ctx);

    expect(result.desertedSoldiers).toHaveLength(1);
    expect(result.armyTurnSnapshots[0].soldierCountTotal).toBe(2);
  });

  it("causes no desertion when desertionRate is zero, even on shortfall", () => {
    const ctx = makeUpkeepContext({
      armies: [makeArmy({ id: "a1" })],
      armyUnits: [makeUnit({ id: "u1" })],
      unitTypes: [makeUnitType({ id: "ut1", desertionRate: 0 })],
      unitSoldiers: [makeSoldier({ id: "sol1", unitId: "u1" })],
      pendingNationStockpiles: { "n1:food": 0 },
      turnNumber: 1,
    });

    const result = phaseMilitaryUpkeep(ctx);

    expect(result.armyTurnSnapshots[0].upkeepPaid).toBe(false);
    expect(result.desertedSoldiers).toEqual([]);
    expect(result.armyTurnSnapshots[0].soldierCountTotal).toBe(1);
  });
});

describe("phaseMilitaryUpkeep — unit disband", () => {
  it("disbands a unit that reaches zero soldiers and keeps the army/group structure implicit", () => {
    const ctx = makeUpkeepContext({
      armies: [makeArmy({ id: "a1" })],
      armyUnits: [makeUnit({ id: "u1" })],
      unitTypes: [makeUnitType({ id: "ut1", desertionRate: 1 })],
      unitSoldiers: [makeSoldier({ id: "sol1", unitId: "u1" })],
      pendingNationStockpiles: { "n1:food": 0 },
      turnNumber: 1,
    });

    const result = phaseMilitaryUpkeep(ctx);

    expect(result.disbandedUnits).toEqual([{ armyId: "a1", unitId: "u1" }]);
    expect(result.armyTurnSnapshots[0].soldierCountTotal).toBe(0);
    expect(result.logs).toContainEqual({
      category: "military.unit_disbanded",
      nationId: "n1",
      payload: { armyId: "a1", unitId: "u1" },
      phase: "militaryUpkeep",
    });
    expect(result.notifications).toContainEqual({
      messageText: "A unit in Testguard disbanded after losing all its soldiers.",
      nationId: "n1",
      notificationType: "military.unit_disbanded",
      scope: "nation",
    });
  });

  it("does not disband a unit that still has surviving soldiers", () => {
    const ctx = makeUpkeepContext({
      armies: [makeArmy({ id: "a1" })],
      armyUnits: [makeUnit({ id: "u1" })],
      unitTypes: [makeUnitType({ id: "ut1", desertionRate: 0.5 })],
      unitSoldiers: [
        makeSoldier({ id: "sol1", unitId: "u1" }),
        makeSoldier({ id: "sol2", unitId: "u1" }),
      ],
      pendingNationStockpiles: { "n1:food": 0 },
      turnNumber: 1,
    });

    const result = phaseMilitaryUpkeep(ctx);

    expect(result.disbandedUnits).toEqual([]);
    expect(result.armyTurnSnapshots[0].soldierCountTotal).toBe(1);
  });
});

describe("phaseMilitaryUpkeep — deserter settlement placement", () => {
  it("sends deserters to home_settlement_id, falling back to the stationed settlement", () => {
    const ctx = makeUpkeepContext({
      armies: [makeArmy({ id: "a1", stationedSettlementId: "s1" })],
      armyUnits: [makeUnit({ id: "u1" })],
      unitTypes: [makeUnitType({ id: "ut1", desertionRate: 1 })],
      unitSoldiers: [
        makeSoldier({ id: "sol1", unitId: "u1", homeSettlementId: "home1" }),
        makeSoldier({ id: "sol2", unitId: "u1", homeSettlementId: null }),
      ],
      pendingNationStockpiles: { "n1:food": 0 },
      turnNumber: 1,
    });

    const result = phaseMilitaryUpkeep(ctx);

    const byId = new Map(result.desertedSoldiers.map((d) => [d.soldierId, d]));
    expect(byId.get("sol1")?.newSettlementId).toBe("home1");
    expect(byId.get("sol2")?.newSettlementId).toBe("s1");
  });
});

describe("phaseMilitaryUpkeep — determinism", () => {
  it("selects the same deserters across runs given the same world/turn/unit seed", () => {
    const build = (): SimulationContext =>
      makeUpkeepContext({
        armies: [makeArmy({ id: "a1" })],
        armyUnits: [makeUnit({ id: "u1" })],
        unitTypes: [makeUnitType({ id: "ut1", desertionRate: 0.5 })],
        unitSoldiers: [
          makeSoldier({ id: "sol1", unitId: "u1" }),
          makeSoldier({ id: "sol2", unitId: "u1" }),
          makeSoldier({ id: "sol3", unitId: "u1" }),
          makeSoldier({ id: "sol4", unitId: "u1" }),
        ],
        pendingNationStockpiles: { "n1:food": 0 },
        turnNumber: 7,
        worldId: "w1",
      });

    const result1 = phaseMilitaryUpkeep(build());
    const result2 = phaseMilitaryUpkeep(build());

    expect(result1.desertedSoldiers.map((d) => d.soldierId).sort()).toEqual(
      result2.desertedSoldiers.map((d) => d.soldierId).sort(),
    );
  });
});
