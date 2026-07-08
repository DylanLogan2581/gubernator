// Unit tests for phasePassiveEffects — passive_resource_production effects
// from active buildings' current tiers.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phasePassiveEffects } from "./phasePassiveEffects.ts";
import { makeContext } from "./testFixtures.ts";

import type {
  SimBuildingTier,
  SimSettlementBuilding,
  SimTierEffect,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTier(overrides?: Partial<SimBuildingTier>): SimBuildingTier {
  return {
    buildingBlueprintId: "blueprint-1",
    constructionCostsJson: [],
    educationConfigJson: null,
    effectsJson: [],
    id: "tier-1",
    tierNumber: 1,
    upkeepCostsJson: [],
    workerTurnsRequired: 0,
    ...overrides,
  };
}

function makeBuilding(
  overrides: Partial<SimSettlementBuilding> & { id: string },
): SimSettlementBuilding {
  return {
    activatedOnTurnNumber: 1,
    buildingBlueprintId: "blueprint-1",
    currentTierId: "tier-1",
    missedUpkeepCount: 0,
    settlementId: "s1",
    sourceProjectId: null,
    state: "active",
    ...overrides,
  };
}

function makePassiveEffect(
  overrides?: Partial<Extract<SimTierEffect, { type: "passive_resource_production" }>>,
): SimTierEffect {
  return {
    amount: 5,
    resourceId: "food",
    type: "passive_resource_production",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phasePassiveEffects — basic production", () => {
  it("emits a stockpile delta and log for a passive_resource_production effect", () => {
    const ctx = makeContext({
      buildingTiers: [makeTier({ effectsJson: [makePassiveEffect({ amount: 5, resourceId: "food" })] })],
      settlementBuildings: [makeBuilding({ id: "b1" })],
    });

    const result = phasePassiveEffects(ctx);

    expect(result.stockpileDeltas).toEqual([
      { delta: 5, resourceId: "food", settlementId: "s1" },
    ]);
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]).toMatchObject({
      category: "passive_effect.applied",
      payload: {
        amount: 5,
        buildingId: "b1",
        resourceId: "food",
        settlementId: "s1",
        tierId: "tier-1",
      },
      phase: "passiveEffects",
    });
  });

  it("produces nothing for a building whose tier has no effects", () => {
    const ctx = makeContext({
      buildingTiers: [makeTier({ effectsJson: [] })],
      settlementBuildings: [makeBuilding({ id: "b1" })],
    });

    const result = phasePassiveEffects(ctx);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
  });

  it("ignores non-passive-production effects (e.g. population_cap_increase)", () => {
    const ctx = makeContext({
      buildingTiers: [
        makeTier({
          effectsJson: [{ amount: 10, type: "population_cap_increase" }],
        }),
      ],
      settlementBuildings: [makeBuilding({ id: "b1" })],
    });

    const result = phasePassiveEffects(ctx);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
  });
});

describe("phasePassiveEffects — stacking and multiple effects", () => {
  it("sums multiple passive effects from the same tier independently (not merged)", () => {
    const ctx = makeContext({
      buildingTiers: [
        makeTier({
          effectsJson: [
            makePassiveEffect({ amount: 5, resourceId: "food" }),
            makePassiveEffect({ amount: 3, resourceId: "wood" }),
          ],
        }),
      ],
      settlementBuildings: [makeBuilding({ id: "b1" })],
    });

    const result = phasePassiveEffects(ctx);

    expect(result.stockpileDeltas).toEqual([
      { delta: 5, resourceId: "food", settlementId: "s1" },
      { delta: 3, resourceId: "wood", settlementId: "s1" },
    ]);
  });

  it("accumulates deltas across multiple active buildings producing the same resource", () => {
    const ctx = makeContext({
      buildingTiers: [
        makeTier({ id: "tier-1", effectsJson: [makePassiveEffect({ amount: 5, resourceId: "food" })] }),
        makeTier({ id: "tier-2", effectsJson: [makePassiveEffect({ amount: 7, resourceId: "food" })] }),
      ],
      settlementBuildings: [
        makeBuilding({ id: "b1", currentTierId: "tier-1" }),
        makeBuilding({ id: "b2", currentTierId: "tier-2" }),
      ],
    });

    const result = phasePassiveEffects(ctx);

    // Each building contributes its own delta entry; totals are summed by the caller
    // when applying deltas, but the phase itself emits one entry per building/effect.
    expect(result.stockpileDeltas).toEqual([
      { delta: 5, resourceId: "food", settlementId: "s1" },
      { delta: 7, resourceId: "food", settlementId: "s1" },
    ]);
    expect(result.logs).toHaveLength(2);
  });
});

describe("phasePassiveEffects — building state and lookup exclusions", () => {
  it("excludes buildings that are not in the active state", () => {
    const ctx = makeContext({
      buildingTiers: [makeTier({ effectsJson: [makePassiveEffect()] })],
      settlementBuildings: [
        makeBuilding({ id: "b-suspended", state: "suspended" }),
        makeBuilding({ id: "b-auto", state: "auto_deconstructed" }),
        makeBuilding({ id: "b-manual", state: "manually_deconstructed" }),
      ],
    });

    const result = phasePassiveEffects(ctx);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
  });

  it("skips a building whose currentTierId does not resolve to a known tier", () => {
    const ctx = makeContext({
      buildingTiers: [makeTier({ id: "tier-1", effectsJson: [makePassiveEffect()] })],
      settlementBuildings: [makeBuilding({ id: "b1", currentTierId: "missing-tier" })],
    });

    const result = phasePassiveEffects(ctx);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
  });

  it("isolates production per settlement", () => {
    const ctx = makeContext({
      buildingTiers: [makeTier({ effectsJson: [makePassiveEffect({ amount: 5, resourceId: "food" })] })],
      settlementBuildings: [
        makeBuilding({ id: "b1", settlementId: "s1" }),
        makeBuilding({ id: "b2", settlementId: "s2" }),
      ],
    });

    const result = phasePassiveEffects(ctx);

    expect(result.stockpileDeltas).toEqual([
      { delta: 5, resourceId: "food", settlementId: "s1" },
      { delta: 5, resourceId: "food", settlementId: "s2" },
    ]);
  });
});
