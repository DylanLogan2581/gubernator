// Unit tests for phaseCitizenConsumption — food/water consumption arithmetic,
// starvation floor rounding, PC immunity, and deterministic victim selection.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseCitizenConsumption } from "./phaseCitizenConsumption.ts";
import {
  makeCitizen,
  makeContext,
  makeSettlement,
  POPULATION_RULES,
} from "./testFixtures.ts";

import type { SimulationContext } from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RULES = {
  ...POPULATION_RULES,
  foodConsumptionPerCitizen: 10,
  starvationSeverityMultiplier: 1,
  waterConsumptionPerCitizen: 5,
};

function setStock(
  ctx: SimulationContext,
  settlementId: string,
  resourceId: string,
  quantity: number,
): void {
  ctx.shared.pendingStockpiles.set(`${settlementId}:${resourceId}`, quantity);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseCitizenConsumption — consumption arithmetic", () => {
  it("zero stock: full deficit, zero consumption, no stockpile deltas emitted", () => {
    const ctx = makeContext({
      citizens: [makeCitizen({ bornOnTurnNumber: 1, id: "c1", settlementId: "s1" })],
      populationRules: RULES,
    });

    const result = phaseCitizenConsumption(ctx);

    expect(result.stockpileDeltas).toHaveLength(0);

    const log = result.logs.find((l) => l.category === "citizen.consumed_food_water");
    expect(log?.payload).toMatchObject({
      aliveCount: 1,
      foodConsumed: 0,
      foodRequired: 10,
      foodStock: 0,
      waterConsumed: 0,
      waterRequired: 5,
      waterStock: 0,
    });

    // deficitRatio = 1 → starvationDeaths = floor(1 * 1 * 1) = 1
    expect(result.citizenDeaths).toHaveLength(1);
    expect(result.citizenDeaths[0]).toMatchObject({
      category: "starvation",
      citizenId: "c1",
    });
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].notificationType).toBe(
      "settlement.starvation_occurred",
    );
  });

  it("exact-cap stock: consumption equals requirement exactly, zero deficit, no starvation", () => {
    const ctx = makeContext({
      citizens: [makeCitizen({ id: "c1", settlementId: "s1" })],
      populationRules: RULES,
    });
    setStock(ctx, "s1", "food", 10);
    setStock(ctx, "s1", "water", 5);

    const result = phaseCitizenConsumption(ctx);

    expect(result.stockpileDeltas).toEqual(
      expect.arrayContaining([
        { delta: -10, resourceId: "food", settlementId: "s1" },
        { delta: -5, resourceId: "water", settlementId: "s1" },
      ]),
    );
    expect(result.stockpileDeltas).toHaveLength(2);
    expect(result.citizenDeaths).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("over-abundant stock: consumption is capped at requirement, surplus stock untouched", () => {
    const ctx = makeContext({
      citizens: [makeCitizen({ id: "c1", settlementId: "s1" })],
      populationRules: RULES,
    });
    setStock(ctx, "s1", "food", 1000);
    setStock(ctx, "s1", "water", 1000);

    const result = phaseCitizenConsumption(ctx);

    // Only the required amount is deducted, never the full stock.
    expect(result.stockpileDeltas).toEqual(
      expect.arrayContaining([
        { delta: -10, resourceId: "food", settlementId: "s1" },
        { delta: -5, resourceId: "water", settlementId: "s1" },
      ]),
    );
    expect(result.citizenDeaths).toHaveLength(0);
  });

  it("partial stock: consumed is clamped to available stock (never drives stock negative)", () => {
    const ctx = makeContext({
      citizens: [makeCitizen({ id: "c1", settlementId: "s1" })],
      populationRules: RULES,
    });
    setStock(ctx, "s1", "food", 4);
    setStock(ctx, "s1", "water", 5);

    const result = phaseCitizenConsumption(ctx);

    const log = result.logs.find((l) => l.category === "citizen.consumed_food_water");
    // foodConsumed = min(10, 4) = 4, not 10 and not negative.
    expect(log?.payload).toMatchObject({ foodConsumed: 4, waterConsumed: 5 });
    expect(result.stockpileDeltas).toEqual(
      expect.arrayContaining([{ delta: -4, resourceId: "food", settlementId: "s1" }]),
    );
    // waterConsumed = 5, fully met → waterDeficit = 0; foodDeficit = 1 - 4/10 = 0.6.
    // deficitRatio = max(0.6, 0) = 0.6 → floor(0.6 * 1 * 1) = 0 starvation deaths.
    expect(result.citizenDeaths).toHaveLength(0);
  });

  it("settlement with zero alive citizens is skipped entirely (no log, no delta)", () => {
    const ctx = makeContext({
      citizens: [makeCitizen({ id: "c1", settlementId: "s1", status: "dead" })],
      populationRules: RULES,
    });

    const result = phaseCitizenConsumption(ctx);

    expect(result.logs).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.citizenDeaths).toHaveLength(0);
  });

  it("event consumption multiplier scales required food/water", () => {
    const ctx = makeContext({
      citizens: [makeCitizen({ id: "c1", settlementId: "s1" })],
      populationRules: RULES,
    });
    ctx.shared.pendingEventMultipliers.set("s1", {
      consumption: 2,
      productionByBuildingId: new Map(),
      productionByJobId: new Map(),
      upkeep: 1,
      upkeepByBlueprintId: new Map(),
      upkeepByBuildingInstanceId: new Map(),
    });
    setStock(ctx, "s1", "food", 20);
    setStock(ctx, "s1", "water", 10);

    const result = phaseCitizenConsumption(ctx);

    const log = result.logs.find((l) => l.category === "citizen.consumed_food_water");
    expect(log?.payload).toMatchObject({
      foodConsumed: 20,
      foodRequired: 20,
      waterConsumed: 10,
      waterRequired: 10,
    });
    expect(result.citizenDeaths).toHaveLength(0);
  });
});

describe("phaseCitizenConsumption — starvation selection and PC immunity", () => {
  it("floors the starvation death count rather than rounding", () => {
    // deficitRatio = 0.6 (food only), severityMultiplier = 2, 3 npcs → 0.6*2*3 = 3.6 → floor = 3
    const ctx = makeContext({
      citizens: [
        makeCitizen({ bornOnTurnNumber: 1, id: "c1", settlementId: "s1" }),
        makeCitizen({ bornOnTurnNumber: 2, id: "c2", settlementId: "s1" }),
        makeCitizen({ bornOnTurnNumber: 3, id: "c3", settlementId: "s1" }),
      ],
      populationRules: {
        ...RULES,
        foodConsumptionPerCitizen: 10,
        starvationSeverityMultiplier: 2,
        waterConsumptionPerCitizen: 0,
      },
    });
    // Required = 3 * 10 = 30. Stock 12 → deficit = 1 - 12/30 = 0.6.
    setStock(ctx, "s1", "food", 12);

    const result = phaseCitizenConsumption(ctx);

    expect(result.citizenDeaths).toHaveLength(3);
  });

  it("selects eldest citizens first (lowest bornOnTurnNumber), tie-broken by citizenId ascending", () => {
    const ctx = makeContext({
      citizens: [
        makeCitizen({ bornOnTurnNumber: 5, id: "young", settlementId: "s1" }),
        makeCitizen({ bornOnTurnNumber: 1, id: "zeta", settlementId: "s1" }),
        makeCitizen({ bornOnTurnNumber: 1, id: "alpha", settlementId: "s1" }),
      ],
      populationRules: {
        ...RULES,
        foodConsumptionPerCitizen: 10,
        starvationSeverityMultiplier: 1,
        waterConsumptionPerCitizen: 0,
      },
    });
    // aliveCount=3, required=30, stock=9 → deficitRatio = 1 - 9/30 = 0.7
    // → floor(0.7 * 1 * 3) = floor(2.1) = 2 deaths (not all 3).
    setStock(ctx, "s1", "food", 9);

    const result = phaseCitizenConsumption(ctx);

    expect(result.citizenDeaths).toHaveLength(2);
    // Both born on turn 1 (eldest); "alpha" < "zeta" so alpha is picked first,
    // "young" (born turn 5) must never be selected while elders remain.
    const diedIds = result.citizenDeaths.map((d) => d.citizenId);
    expect(diedIds).toEqual(["alpha", "zeta"]);
  });

  it("PCs are immune to starvation and excluded from the NPC denominator, but still consume", () => {
    const ctx = makeContext({
      citizens: [
        makeCitizen({ citizenType: "player_character", id: "player", settlementId: "s1" }),
        makeCitizen({ citizenType: "npc", id: "commoner", settlementId: "s1" }),
      ],
      populationRules: {
        ...RULES,
        foodConsumptionPerCitizen: 10,
        starvationSeverityMultiplier: 1,
        waterConsumptionPerCitizen: 0,
      },
    });
    // aliveCount=2 (pc+npc) → required=20; stock=0 → deficitRatio=1.
    // livingNpcs.length=1 (pc excluded) → floor(1*1*1)=1 death, must be the npc.
    setStock(ctx, "s1", "food", 0);

    const result = phaseCitizenConsumption(ctx);

    const log = result.logs.find((l) => l.category === "citizen.consumed_food_water");
    expect(log?.payload.aliveCount).toBe(2);
    expect(log?.payload.foodRequired).toBe(20);
    expect(result.citizenDeaths).toHaveLength(1);
    expect(result.citizenDeaths[0].citizenId).toBe("commoner");
  });

  it("caps actual deaths at available NPC count even when the raw starvation count exceeds it", () => {
    // Only 1 npc available; severityMultiplier inflated so raw starvationDeaths
    // computes higher than the population that can actually die.
    const ctx = makeContext({
      citizens: [
        makeCitizen({ citizenType: "player_character", id: "player", settlementId: "s1" }),
        makeCitizen({ citizenType: "npc", id: "commoner", settlementId: "s1" }),
      ],
      populationRules: {
        ...RULES,
        foodConsumptionPerCitizen: 10,
        starvationSeverityMultiplier: 5,
        waterConsumptionPerCitizen: 0,
      },
    });
    setStock(ctx, "s1", "food", 0);

    const result = phaseCitizenConsumption(ctx);

    // Raw starvationDeaths = floor(1 * 5 * 1) = 5, but only 1 npc exists to kill.
    expect(result.citizenDeaths).toHaveLength(1);
    // Notification text uses the uncapped raw count, not the actual death count —
    // documents current phase behaviour so a future change is deliberate, not accidental.
    expect(result.notifications[0].messageText).toContain("5 citizen(s) starved");
  });
});

describe("phaseCitizenConsumption — multi-settlement isolation", () => {
  it("keeps deltas, logs, and deaths scoped per settlement with no cross-contamination", () => {
    const ctx = makeContext({
      citizens: [
        makeCitizen({ id: "c1", settlementId: "s1" }),
        makeCitizen({ id: "c2", settlementId: "s2" }),
      ],
      populationRules: {
        ...RULES,
        foodConsumptionPerCitizen: 10,
        starvationSeverityMultiplier: 1,
        waterConsumptionPerCitizen: 0,
      },
      settlements: [makeSettlement({ id: "s1" }), makeSettlement({ id: "s2", name: "Otherton" })],
    });
    // s1 is well-stocked, s2 is starving.
    setStock(ctx, "s1", "food", 10);
    setStock(ctx, "s2", "food", 0);

    const result = phaseCitizenConsumption(ctx);

    const s1Delta = result.stockpileDeltas.find((d) => d.settlementId === "s1");
    const s2Delta = result.stockpileDeltas.find((d) => d.settlementId === "s2");
    expect(s1Delta).toEqual({ delta: -10, resourceId: "food", settlementId: "s1" });
    expect(s2Delta).toBeUndefined(); // s2 consumed 0 → no delta pushed.

    expect(result.citizenDeaths).toHaveLength(1);
    expect(result.citizenDeaths[0].citizenId).toBe("c2");

    const logs = result.logs.filter((l) => l.category === "citizen.consumed_food_water");
    expect(logs).toHaveLength(2);
    // settlementId lives inside the payload for this log category (no top-level field).
    expect(logs.map((l) => l.payload.settlementId).sort()).toEqual(["s1", "s2"]);
  });
});

describe("phaseCitizenConsumption — determinism", () => {
  it("produces identical output across repeated calls with equivalent input (no hidden randomness or clock reads)", () => {
    function buildCtx(): SimulationContext {
      const ctx = makeContext({
        citizens: [
          makeCitizen({ bornOnTurnNumber: 1, id: "c1", settlementId: "s1" }),
          makeCitizen({ bornOnTurnNumber: 2, id: "c2", settlementId: "s1" }),
        ],
        populationRules: {
          ...RULES,
          foodConsumptionPerCitizen: 10,
          starvationSeverityMultiplier: 1,
          waterConsumptionPerCitizen: 0,
        },
      });
      setStock(ctx, "s1", "food", 5);
      return ctx;
    }

    const first = phaseCitizenConsumption(buildCtx());
    const second = phaseCitizenConsumption(buildCtx());

    expect(second).toEqual(first);
  });
});
