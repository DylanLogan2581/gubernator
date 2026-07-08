// Unit tests for phaseHomelessness — kills excess alive NPCs when population
// exceeds the settlement's active-building population cap, at the
// `homelessnessDecliningRate` from populationRules.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseHomelessness } from "./phaseHomelessness.ts";
import { makeCitizen, makeContext, makeSettlement } from "./testFixtures.ts";

import type {
  SimBuildingTier,
  SimCitizen,
  SimSettlementBuilding,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePopCapTier(
  amount: number,
  overrides?: Partial<SimBuildingTier>,
): SimBuildingTier {
  return {
    buildingBlueprintId: "blueprint-1",
    constructionCostsJson: [],
    educationConfigJson: null,
    effectsJson: [{ amount, type: "population_cap_increase" }],
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

/** Alive NPC citizens numbered c0..c{count-1}, born in ascending turn order. */
function makeNpcs(
  count: number,
  overrides?: (index: number) => Partial<Omit<SimCitizen, "settlementId">>,
): SimCitizen[] {
  return Array.from({ length: count }, (_, i) =>
    makeCitizen({
      bornOnTurnNumber: i + 1,
      citizenType: "npc",
      id: `c${i}`,
      settlementId: "s1",
      status: "alive",
      ...(overrides?.(i) ?? {}),
    }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseHomelessness — cap boundary", () => {
  it("kills nobody when alive NPC count is exactly at the population cap", () => {
    const ctx = makeContext({
      buildingTiers: [makePopCapTier(5)],
      citizens: makeNpcs(5),
      populationRules: {
        fertilityChance: 0,
        foodConsumptionPerCitizen: 0,
        homelessnessDecliningRate: 1,
        incestPreventionDepth: 0,
        maximumFertilityAgeTurns: null,
        minimumPartnershipAgeTurns: 0,
        mourningPeriodTurns: 0,
        partnershipSeekChance: 0,
        starvationSeverityMultiplier: 0,
        waterConsumptionPerCitizen: 0,
      },
      settlementBuildings: [makeBuilding({ id: "b1" })],
    });

    const result = phaseHomelessness(ctx, new Set());

    expect(result.citizenDeaths).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("kills exactly one citizen when one over the cap with a full decline rate", () => {
    const ctx = makeContext({
      buildingTiers: [makePopCapTier(5)],
      citizens: makeNpcs(6),
      populationRules: {
        fertilityChance: 0,
        foodConsumptionPerCitizen: 0,
        homelessnessDecliningRate: 1,
        incestPreventionDepth: 0,
        maximumFertilityAgeTurns: null,
        minimumPartnershipAgeTurns: 0,
        mourningPeriodTurns: 0,
        partnershipSeekChance: 0,
        starvationSeverityMultiplier: 0,
        waterConsumptionPerCitizen: 0,
      },
      settlementBuildings: [makeBuilding({ id: "b1" })],
    });

    const result = phaseHomelessness(ctx, new Set());

    expect(result.citizenDeaths).toHaveLength(1);
    expect(result.citizenDeaths[0]).toMatchObject({
      category: "homeless",
      // Eldest citizen (lowest bornOnTurnNumber) dies first: c0 was born on turn 1.
      citizenId: "c0",
      detail: "cap: 5, alive: 6",
    });
  });
});

describe("phaseHomelessness — decline rate arithmetic", () => {
  it("rounds the decline count up via Math.ceil(overage * rate)", () => {
    // overage=10, rate=0.25 -> ceil(2.5) = 3 deaths.
    const ctx = makeContext({
      buildingTiers: [makePopCapTier(0)],
      citizens: makeNpcs(10),
      populationRules: {
        fertilityChance: 0,
        foodConsumptionPerCitizen: 0,
        homelessnessDecliningRate: 0.25,
        incestPreventionDepth: 0,
        maximumFertilityAgeTurns: null,
        minimumPartnershipAgeTurns: 0,
        mourningPeriodTurns: 0,
        partnershipSeekChance: 0,
        starvationSeverityMultiplier: 0,
        waterConsumptionPerCitizen: 0,
      },
      settlementBuildings: [],
    });

    const result = phaseHomelessness(ctx, new Set());

    expect(result.citizenDeaths).toHaveLength(3);
  });

  it("caps the death count at the overage even when rate * overage exceeds it", () => {
    // overage=4, rate=2 -> ceil(8)=8, but min(overage, 8) = 4.
    const ctx = makeContext({
      buildingTiers: [makePopCapTier(0)],
      citizens: makeNpcs(4),
      populationRules: {
        fertilityChance: 0,
        foodConsumptionPerCitizen: 0,
        homelessnessDecliningRate: 2,
        incestPreventionDepth: 0,
        maximumFertilityAgeTurns: null,
        minimumPartnershipAgeTurns: 0,
        mourningPeriodTurns: 0,
        partnershipSeekChance: 0,
        starvationSeverityMultiplier: 0,
        waterConsumptionPerCitizen: 0,
      },
      settlementBuildings: [],
    });

    const result = phaseHomelessness(ctx, new Set());

    expect(result.citizenDeaths).toHaveLength(4);
  });

  it("kills nobody and skips the settlement when the decline rate rounds down to zero deaths", () => {
    // overage=1, rate=0.1 -> ceil(0.1)=1, min(1,1)=1 — still nonzero.
    // Use rate=0 explicitly to hit the homelessDeaths === 0 short-circuit.
    const ctx = makeContext({
      buildingTiers: [makePopCapTier(0)],
      citizens: makeNpcs(3),
      populationRules: {
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
      },
      settlementBuildings: [],
    });

    const result = phaseHomelessness(ctx, new Set());

    expect(result.citizenDeaths).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });
});

describe("phaseHomelessness — deterministic ordering and log/notification shape", () => {
  it("kills eldest citizens first (lowest bornOnTurnNumber), then lowest id as tiebreak", () => {
    const ctx = makeContext({
      buildingTiers: [makePopCapTier(0)],
      citizens: [
        makeCitizen({ bornOnTurnNumber: 5, citizenType: "npc", id: "z", settlementId: "s1" }),
        makeCitizen({ bornOnTurnNumber: 2, citizenType: "npc", id: "b", settlementId: "s1" }),
        makeCitizen({ bornOnTurnNumber: 2, citizenType: "npc", id: "a", settlementId: "s1" }),
      ],
      populationRules: {
        fertilityChance: 0,
        foodConsumptionPerCitizen: 0,
        homelessnessDecliningRate: 1,
        incestPreventionDepth: 0,
        maximumFertilityAgeTurns: null,
        minimumPartnershipAgeTurns: 0,
        mourningPeriodTurns: 0,
        partnershipSeekChance: 0,
        starvationSeverityMultiplier: 0,
        waterConsumptionPerCitizen: 0,
      },
      settlementBuildings: [],
    });

    const result = phaseHomelessness(ctx, new Set());

    // overage=3, rate=1 -> all 3 die, in order: turn 2 (id "a"), turn 2 (id "b"), turn 5 (id "z").
    expect(result.citizenDeaths.map((d) => d.citizenId)).toEqual(["a", "b", "z"]);
  });

  it("emits one citizen.died_homeless log per death with settlement scope and phase name", () => {
    const ctx = makeContext({
      buildingTiers: [makePopCapTier(1)],
      citizens: makeNpcs(3),
      populationRules: {
        fertilityChance: 0,
        foodConsumptionPerCitizen: 0,
        homelessnessDecliningRate: 1,
        incestPreventionDepth: 0,
        maximumFertilityAgeTurns: null,
        minimumPartnershipAgeTurns: 0,
        mourningPeriodTurns: 0,
        partnershipSeekChance: 0,
        starvationSeverityMultiplier: 0,
        waterConsumptionPerCitizen: 0,
      },
      settlementBuildings: [makeBuilding({ id: "b1" })],
    });

    const result = phaseHomelessness(ctx, new Set());

    // overage = 3 - 1 = 2 -> 2 deaths.
    expect(result.logs).toHaveLength(2);
    for (const log of result.logs) {
      expect(log.category).toBe("citizen.died_homeless");
      expect(log.phase).toBe("homelessness");
      expect(log.settlementId).toBe("s1");
      expect(log.citizenId).toBeDefined();
      expect(log.payload).toMatchObject({ deathDetail: "cap: 1, alive: 3" });
    }

    expect(result.notifications).toEqual([
      {
        messageText: "2 citizen(s) died from homelessness in Testville.",
        notificationType: "settlement.homelessness_occurred",
        scope: "settlement",
        settlementId: "s1",
      },
    ]);
  });

  it("excludes citizens already marked as pending deaths from earlier phases", () => {
    const ctx = makeContext({
      buildingTiers: [makePopCapTier(0)],
      citizens: makeNpcs(2),
      populationRules: {
        fertilityChance: 0,
        foodConsumptionPerCitizen: 0,
        homelessnessDecliningRate: 1,
        incestPreventionDepth: 0,
        maximumFertilityAgeTurns: null,
        minimumPartnershipAgeTurns: 0,
        mourningPeriodTurns: 0,
        partnershipSeekChance: 0,
        starvationSeverityMultiplier: 0,
        waterConsumptionPerCitizen: 0,
      },
      settlementBuildings: [],
    });
    ctx.shared.pendingDeaths.add("c0");

    const result = phaseHomelessness(ctx, new Set());

    // Only c1 is alive-and-not-pending, cap=0, overage=1, rate=1 -> 1 death: c1.
    expect(result.citizenDeaths).toHaveLength(1);
    expect(result.citizenDeaths[0]?.citizenId).toBe("c1");
  });

  it("excludes player citizens and non-alive citizens from the population count", () => {
    const ctx = makeContext({
      buildingTiers: [makePopCapTier(0)],
      citizens: [
        makeCitizen({ citizenType: "npc", id: "npc-alive", settlementId: "s1", status: "alive" }),
        makeCitizen({ citizenType: "player_character", id: "pc-alive", settlementId: "s1", status: "alive" }),
        makeCitizen({ citizenType: "npc", id: "npc-dead", settlementId: "s1", status: "dead" }),
      ],
      populationRules: {
        fertilityChance: 0,
        foodConsumptionPerCitizen: 0,
        homelessnessDecliningRate: 1,
        incestPreventionDepth: 0,
        maximumFertilityAgeTurns: null,
        minimumPartnershipAgeTurns: 0,
        mourningPeriodTurns: 0,
        partnershipSeekChance: 0,
        starvationSeverityMultiplier: 0,
        waterConsumptionPerCitizen: 0,
      },
      settlementBuildings: [],
    });

    const result = phaseHomelessness(ctx, new Set());

    // Only "npc-alive" counts toward alive NPCs; cap=0, overage=1, rate=1 -> 1 death.
    expect(result.citizenDeaths).toHaveLength(1);
    expect(result.citizenDeaths[0]?.citizenId).toBe("npc-alive");
  });

  it("isolates population caps and deaths per settlement", () => {
    // s1 has a cap of 5 (well above its 2 NPCs) and should have no deaths.
    // s2 has no cap-granting building (cap=0) with 1 NPC, so it fully overflows.
    const ctx = makeContext({
      buildingTiers: [makePopCapTier(5)],
      citizens: [
        makeCitizen({ id: "s1-0", citizenType: "npc", settlementId: "s1" }),
        makeCitizen({ id: "s1-1", citizenType: "npc", settlementId: "s1" }),
        makeCitizen({ id: "s2-0", citizenType: "npc", settlementId: "s2" }),
      ],
      populationRules: {
        fertilityChance: 0,
        foodConsumptionPerCitizen: 0,
        homelessnessDecliningRate: 1,
        incestPreventionDepth: 0,
        maximumFertilityAgeTurns: null,
        minimumPartnershipAgeTurns: 0,
        mourningPeriodTurns: 0,
        partnershipSeekChance: 0,
        starvationSeverityMultiplier: 0,
        waterConsumptionPerCitizen: 0,
      },
      settlementBuildings: [makeBuilding({ id: "b1", settlementId: "s1" })],
      settlements: [makeSettlement({ id: "s1" }), makeSettlement({ id: "s2" })],
    });

    const result = phaseHomelessness(ctx, new Set());

    const s1Deaths = result.citizenDeaths.filter((d) => d.citizenId.startsWith("s1-"));
    const s2Deaths = result.citizenDeaths.filter((d) => d.citizenId.startsWith("s2-"));
    expect(s1Deaths).toHaveLength(0);
    expect(s2Deaths).toHaveLength(1);
  });
});
