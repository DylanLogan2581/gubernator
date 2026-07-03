// Unit tests for phasePartnerships/fertility — seeded-RNG determinism plus
// age/pop-cap/resource gating logic.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { createSeededRng } from "../../seededRng.ts";
import { makeCitizen, makeSettlement } from "../testFixtures.ts";

import { applyFertilityForSettlement } from "./fertility.ts";

import type { SeededRng } from "../../seededRng.ts";
import type {
  NpcFlavorConfig,
  SimCitizen,
  SimNamingConfig,
  SimPartnership,
  SimSettlement,
} from "../../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePartnership(
  overrides: Partial<SimPartnership> & { citizenAId: string; citizenBId: string },
): SimPartnership {
  return {
    endedOnTurnNumber: null,
    formedOnTurnNumber: 1,
    id: `${overrides.citizenAId}-${overrides.citizenBId}`,
    status: "active",
    ...overrides,
  };
}

function makeNpcFlavorConfig(
  overrides?: Partial<NpcFlavorConfig>,
): NpcFlavorConfig {
  return {
    contradictions: ["contra-1", "contra-2"],
    flaws: ["flaw-1", "flaw-2"],
    goals: ["goal-1", "goal-2"],
    traits: ["trait-1", "trait-2", "trait-3"],
    ...overrides,
  };
}

function makeNamesetConfig(
  overrides?: Partial<SimNamingConfig>,
): SimNamingConfig {
  return {
    convention: "pool",
    female_given_names: ["Alice", "Beth"],
    male_given_names: ["Adam", "Bob"],
    surnames: ["Smith", "Jones"],
    ...overrides,
  };
}

type FertilityArgs = {
  settlement: SimSettlement;
  activePartnerships: readonly SimPartnership[];
  citizenById: Map<string, SimCitizen>;
  stockpileQty: Map<string, number>;
  popCapBySettlement: Map<string, number>;
  aliveCountBySettlement: Map<string, number>;
  systemResourceIds: { foodId: string; freshWaterId: string };
  fertilityChance: number;
  minimumPartnershipAgeTurns: number;
  maximumFertilityAgeTurns: number | null;
  npcFlavorConfig: NpcFlavorConfig | null | undefined;
  namesetConfigById: Readonly<Record<string, SimNamingConfig>>;
  fallbackNamesetId: string | null;
  turnNumber: number;
  rng: SeededRng;
};

function makeDefaultArgs(rng: SeededRng): FertilityArgs {
  const settlement = makeSettlement({ id: "s1" });
  const citizenA = makeCitizen({
    bornOnTurnNumber: 0,
    id: "cA",
    settlementId: "s1",
    sex: "male",
  });
  const citizenB = makeCitizen({
    bornOnTurnNumber: 0,
    id: "cB",
    settlementId: "s1",
    sex: "female",
  });

  return {
    activePartnerships: [makePartnership({ citizenAId: "cA", citizenBId: "cB" })],
    aliveCountBySettlement: new Map([["s1", 2]]),
    citizenById: new Map([["cA", citizenA], ["cB", citizenB]]),
    fallbackNamesetId: null,
    fertilityChance: 1,
    maximumFertilityAgeTurns: null,
    minimumPartnershipAgeTurns: 0,
    namesetConfigById: {},
    npcFlavorConfig: null,
    popCapBySettlement: new Map([["s1", 10]]),
    rng,
    settlement,
    stockpileQty: new Map([["s1:food", 100], ["s1:water", 100]]),
    systemResourceIds: { foodId: "food", freshWaterId: "water" },
    turnNumber: 10,
  };
}

function callFertility(args: FertilityArgs): ReturnType<typeof applyFertilityForSettlement> {
  return applyFertilityForSettlement(
    args.settlement,
    args.activePartnerships,
    args.citizenById,
    args.stockpileQty,
    args.popCapBySettlement,
    args.aliveCountBySettlement,
    args.systemResourceIds,
    args.fertilityChance,
    args.minimumPartnershipAgeTurns,
    args.maximumFertilityAgeTurns,
    args.npcFlavorConfig,
    args.namesetConfigById,
    args.fallbackNamesetId,
    args.turnNumber,
    args.rng,
  );
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("applyFertilityForSettlement — determinism", () => {
  it("same seed + same inputs produce identical citizenBirths and logs", () => {
    const buildArgs = (rng: SeededRng): FertilityArgs => {
      const args = makeDefaultArgs(rng);
      const citizenA = makeCitizen({
        bornOnTurnNumber: 0,
        id: "cA",
        namesetId: "ns1",
        settlementId: "s1",
        sex: "male",
      });
      const citizenB = makeCitizen({
        bornOnTurnNumber: 0,
        id: "cB",
        namesetId: "ns2",
        settlementId: "s1",
        sex: "female",
      });
      args.citizenById = new Map([["cA", citizenA], ["cB", citizenB]]);
      args.npcFlavorConfig = makeNpcFlavorConfig();
      args.namesetConfigById = {
        ns1: makeNamesetConfig(),
        ns2: makeNamesetConfig({ male_given_names: ["Carl"], female_given_names: ["Dana"] }),
      };
      return args;
    };

    const result1 = callFertility(buildArgs(createSeededRng("same-seed")));
    const result2 = callFertility(buildArgs(createSeededRng("same-seed")));

    expect(result1.citizenBirths).toHaveLength(1);
    expect(result1).toStrictEqual(result2);
  });

  it("different seeds can produce a different outcome (rng is actually consulted)", () => {
    // Verified offline: "fert-a" picks sex=male, "fert-b" picks sex=female
    // for this exact call sequence (gate roll, then sex roll).
    const resultA = callFertility(makeDefaultArgs(createSeededRng("fert-a")));
    const resultB = callFertility(makeDefaultArgs(createSeededRng("fert-b")));

    expect(resultA.citizenBirths).toHaveLength(1);
    expect(resultB.citizenBirths).toHaveLength(1);
    expect(resultA.citizenBirths[0]?.sex).toBe("male");
    expect(resultB.citizenBirths[0]?.sex).toBe("female");
    expect(resultA.citizenBirths[0]?.sex).not.toBe(resultB.citizenBirths[0]?.sex);
  });
});

// ---------------------------------------------------------------------------
// Age gating
// ---------------------------------------------------------------------------

describe("applyFertilityForSettlement — age gating", () => {
  it("blocks birth when either partner is below minimumPartnershipAgeTurns", () => {
    const args = makeDefaultArgs(createSeededRng("age-seed"));
    args.minimumPartnershipAgeTurns = 5;
    args.turnNumber = 10;
    // citizen born at turn 6 -> age 4 < 5
    args.citizenById.set(
      "cB",
      makeCitizen({ bornOnTurnNumber: 6, id: "cB", settlementId: "s1", sex: "female" }),
    );

    const result = callFertility(args);

    expect(result.citizenBirths).toHaveLength(0);
  });

  it("allows birth when both partners are exactly at minimumPartnershipAgeTurns", () => {
    const args = makeDefaultArgs(createSeededRng("age-seed"));
    args.minimumPartnershipAgeTurns = 5;
    args.turnNumber = 10;
    args.citizenById.set(
      "cA",
      makeCitizen({ bornOnTurnNumber: 5, id: "cA", settlementId: "s1", sex: "male" }),
    );
    args.citizenById.set(
      "cB",
      makeCitizen({ bornOnTurnNumber: 5, id: "cB", settlementId: "s1", sex: "female" }),
    );

    const result = callFertility(args);

    expect(result.citizenBirths).toHaveLength(1);
  });

  it("blocks birth when either partner is above maximumFertilityAgeTurns", () => {
    const args = makeDefaultArgs(createSeededRng("age-seed"));
    args.maximumFertilityAgeTurns = 10;
    args.turnNumber = 10;
    // born at turn -1 -> age 11 > 10
    args.citizenById.set(
      "cB",
      makeCitizen({ bornOnTurnNumber: -1, id: "cB", settlementId: "s1", sex: "female" }),
    );

    const result = callFertility(args);

    expect(result.citizenBirths).toHaveLength(0);
  });

  it("allows birth when both partners are exactly at maximumFertilityAgeTurns", () => {
    const args = makeDefaultArgs(createSeededRng("age-seed"));
    args.maximumFertilityAgeTurns = 10;
    args.turnNumber = 10;
    // born at turn 0 -> age 10, not > 10
    const result = callFertility(args);

    expect(result.citizenBirths).toHaveLength(1);
  });

  it("null maximumFertilityAgeTurns means no upper age bound", () => {
    const args = makeDefaultArgs(createSeededRng("age-seed"));
    args.maximumFertilityAgeTurns = null;
    args.turnNumber = 10_000;
    args.citizenById.set(
      "cA",
      makeCitizen({ bornOnTurnNumber: 0, id: "cA", settlementId: "s1", sex: "male" }),
    );
    args.citizenById.set(
      "cB",
      makeCitizen({ bornOnTurnNumber: 0, id: "cB", settlementId: "s1", sex: "female" }),
    );

    const result = callFertility(args);

    expect(result.citizenBirths).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Pop cap / resources / chance
// ---------------------------------------------------------------------------

describe("applyFertilityForSettlement — pop cap and resource gating", () => {
  it("blocks birth when currentAliveCount >= popCap", () => {
    const args = makeDefaultArgs(createSeededRng("cap-seed"));
    args.aliveCountBySettlement = new Map([["s1", 10]]);
    args.popCapBySettlement = new Map([["s1", 10]]);

    const result = callFertility(args);

    expect(result.citizenBirths).toHaveLength(0);
  });

  it("blocks birth when food stock is zero", () => {
    const args = makeDefaultArgs(createSeededRng("food-seed"));
    args.stockpileQty = new Map([["s1:food", 0], ["s1:water", 100]]);

    const result = callFertility(args);

    expect(result.citizenBirths).toHaveLength(0);
  });

  it("blocks birth when water stock is zero", () => {
    const args = makeDefaultArgs(createSeededRng("water-seed"));
    args.stockpileQty = new Map([["s1:food", 100], ["s1:water", 0]]);

    const result = callFertility(args);

    expect(result.citizenBirths).toHaveLength(0);
  });

  it("fertilityChance of 0 never produces a birth", () => {
    const args = makeDefaultArgs(createSeededRng("chance-seed"));
    args.fertilityChance = 0;

    const result = callFertility(args);

    expect(result.citizenBirths).toHaveLength(0);
  });

  it("fertilityChance of 1 always produces a birth (rng() >= 1 is never true)", () => {
    const args = makeDefaultArgs(createSeededRng("chance-seed"));
    args.fertilityChance = 1;

    const result = callFertility(args);

    expect(result.citizenBirths).toHaveLength(1);
  });

  it("accumulates currentAliveCount across partnerships within the same call, stopping at popCap", () => {
    const settlement = makeSettlement({ id: "s1" });
    const citizens: SimCitizen[] = [
      makeCitizen({ bornOnTurnNumber: 0, id: "a1", settlementId: "s1", sex: "male" }),
      makeCitizen({ bornOnTurnNumber: 0, id: "a2", settlementId: "s1", sex: "female" }),
      makeCitizen({ bornOnTurnNumber: 0, id: "b1", settlementId: "s1", sex: "male" }),
      makeCitizen({ bornOnTurnNumber: 0, id: "b2", settlementId: "s1", sex: "female" }),
    ];
    const citizenById = new Map(citizens.map((c) => [c.id, c]));
    const args: FertilityArgs = {
      activePartnerships: [
        makePartnership({ citizenAId: "a1", citizenBId: "a2" }),
        makePartnership({ citizenAId: "b1", citizenBId: "b2" }),
      ],
      aliveCountBySettlement: new Map([["s1", 9]]),
      citizenById,
      fallbackNamesetId: null,
      fertilityChance: 1,
      maximumFertilityAgeTurns: null,
      minimumPartnershipAgeTurns: 0,
      namesetConfigById: {},
      npcFlavorConfig: null,
      popCapBySettlement: new Map([["s1", 10]]),
      rng: createSeededRng("accum-seed"),
      settlement,
      stockpileQty: new Map([["s1:food", 100], ["s1:water", 100]]),
      systemResourceIds: { foodId: "food", freshWaterId: "water" },
      turnNumber: 10,
    };

    const result = callFertility(args);

    // Only the first partnership should succeed: alive count starts at 9,
    // cap is 10, so after the first birth currentAliveCount hits 10 and the
    // second partnership is blocked.
    expect(result.citizenBirths).toHaveLength(1);
    expect(result.citizenBirths[0]?.parentACitizenId).toBe("a1");
  });
});

// ---------------------------------------------------------------------------
// Partnership / citizen filtering
// ---------------------------------------------------------------------------

describe("applyFertilityForSettlement — partnership and citizen filtering", () => {
  it("skips a partnership belonging to a different settlement", () => {
    const args = makeDefaultArgs(createSeededRng("cross-seed"));
    args.citizenById.set(
      "cA",
      makeCitizen({ bornOnTurnNumber: 0, id: "cA", settlementId: "other", sex: "male" }),
    );
    args.citizenById.set(
      "cB",
      makeCitizen({ bornOnTurnNumber: 0, id: "cB", settlementId: "other", sex: "female" }),
    );

    const result = callFertility(args);

    expect(result.citizenBirths).toHaveLength(0);
  });

  it("skips a partnership where one partner is dead", () => {
    const args = makeDefaultArgs(createSeededRng("dead-seed"));
    args.citizenById.set(
      "cB",
      makeCitizen({
        bornOnTurnNumber: 0,
        id: "cB",
        settlementId: "s1",
        sex: "female",
        status: "dead",
      }),
    );

    const result = callFertility(args);

    expect(result.citizenBirths).toHaveLength(0);
  });

  it("skips a partnership referencing a citizen id missing from citizenById", () => {
    const args = makeDefaultArgs(createSeededRng("missing-seed"));
    args.citizenById.delete("cB");

    const result = callFertility(args);

    expect(result.citizenBirths).toHaveLength(0);
  });
});
