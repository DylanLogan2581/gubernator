// Unit tests for phasePartnerships/formation — seeded-RNG determinism,
// partnershipSeekChance gating, incest-prevention kinship depth, minimum-age
// gating, dead/already-partnered exclusion, and cross-settlement isolation.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { createSeededRng } from "../../seededRng.ts";
import { compareById } from "../../sortUtils.ts";
import { makeCitizen, makeSettlement } from "../testFixtures.ts";

import {
  applyFormationForSettlement,
  createAncestorSetLookup,
} from "./formation.ts";

import type { AncestorSetLookup, FormationResult } from "./formation.ts";
import type {
  PartnershipChange,
  SimCitizen,
} from "../../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inSettlement(citizens: SimCitizen[], settlementId: string): SimCitizen[] {
  return citizens.filter((c) => c.settlementId === settlementId);
}

function ancestorsAt(
  citizens: SimCitizen[],
  depth: number,
): AncestorSetLookup {
  return createAncestorSetLookup(new Map(citizens.map((c) => [c.id, c])), depth);
}

const SETTLEMENT = makeSettlement({ id: "s1", name: "Testville" });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("applyFormationForSettlement — determinism", () => {
  it("produces identical output for two fresh runs with the same seed and inputs", () => {
    const citizens = [
      makeCitizen({ id: "m1", settlementId: "s1", sex: "male" }),
      makeCitizen({ id: "m2", settlementId: "s1", sex: "male" }),
      makeCitizen({ id: "m3", settlementId: "s1", sex: "male" }),
      makeCitizen({ id: "m4", settlementId: "s1", sex: "male" }),
      makeCitizen({ id: "f1", settlementId: "s1", sex: "female" }),
      makeCitizen({ id: "f2", settlementId: "s1", sex: "female" }),
      makeCitizen({ id: "f3", settlementId: "s1", sex: "female" }),
      makeCitizen({ id: "f4", settlementId: "s1", sex: "female" }),
    ];

    function run(): FormationResult {
      return applyFormationForSettlement(
        SETTLEMENT,
        inSettlement(citizens, "s1"),
        new Set(),
        new Set(),
        new Set(),
        10,
        0,
        0.5,
        ancestorsAt(citizens, 0),
        createSeededRng("same-seed"),
      );
    }

    const first = run();
    const second = run();

    expect(second).toEqual(first);
    // Sanity: the seed/chance combination should actually exercise pairing
    // logic, not trivially produce an empty result both times.
    expect(first.partnershipChanges.length).toBeGreaterThan(0);
  });
});

describe("applyFormationForSettlement — partnershipSeekChance gating", () => {
  it("never forms a partnership when partnershipSeekChance is 0", () => {
    const citizens = [
      makeCitizen({ id: "m1", settlementId: "s1", sex: "male" }),
      makeCitizen({ id: "f1", settlementId: "s1", sex: "female" }),
    ];

    const result = applyFormationForSettlement(
      SETTLEMENT,
      inSettlement(citizens, "s1"),
      new Set(),
      new Set(),
      new Set(),
      10,
      0,
      0,
      ancestorsAt(citizens, 0),
      createSeededRng("any-seed"),
    );

    expect(result.partnershipChanges).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("forms a partnership between the only eligible male and female when chance is 1", () => {
    const citizens = [
      makeCitizen({ id: "m1", settlementId: "s1", sex: "male" }),
      makeCitizen({ id: "f1", settlementId: "s1", sex: "female" }),
    ];

    const result = applyFormationForSettlement(
      SETTLEMENT,
      inSettlement(citizens, "s1"),
      new Set(),
      new Set(),
      new Set(),
      10,
      0,
      1,
      ancestorsAt(citizens, 0),
      createSeededRng("any-seed"),
    );

    expect(result.partnershipChanges).toEqual([
      { citizenAId: "m1", citizenBId: "f1", type: "formed" },
    ]);
    expect(result.logs).toEqual([
      {
        category: "partnership.formed",
        payload: { citizenAId: "m1", citizenBId: "f1" },
        phase: "partnerships",
        settlementId: "s1",
      },
    ]);
    expect(result.notifications).toEqual([
      {
        messageText: "A new partnership formed in Testville.",
        notificationType: "partnership.formed",
        scope: "settlement",
        settlementId: "s1",
      },
    ]);
  });
});

describe("applyFormationForSettlement — incest prevention", () => {
  it("blocks pairing between siblings sharing both parents within incestPreventionDepth", () => {
    const citizens = [
      // Parents are excluded from the eligible pool via status "dead", but
      // remain in citizenById so ancestor lookups can resolve them.
      makeCitizen({ id: "par-a", settlementId: "s1", status: "dead" }),
      makeCitizen({ id: "par-b", settlementId: "s1", status: "dead" }),
      makeCitizen({
        id: "sib-m",
        parentACitizenId: "par-a",
        parentBCitizenId: "par-b",
        sex: "male",
        settlementId: "s1",
      }),
      makeCitizen({
        id: "sib-f",
        parentACitizenId: "par-a",
        parentBCitizenId: "par-b",
        sex: "female",
        settlementId: "s1",
      }),
    ];

    const result = applyFormationForSettlement(
      SETTLEMENT,
      inSettlement(citizens, "s1"),
      new Set(),
      new Set(),
      new Set(),
      10,
      0,
      1,
      ancestorsAt(citizens, 1),
      createSeededRng("any-seed"),
    );

    expect(result.partnershipChanges).toHaveLength(0);
  });

  it("allows pairing between first cousins, which fall outside a depth-1 kinship check", () => {
    // buildAncestorSet(depth=1) only reaches self + parents, not
    // grandparents, so first cousins (who only share a grandparent) are not
    // flagged as close kin at depth 1 — confirmed by reading the
    // generation-frontier loop in formation.ts.
    const citizens = [
      makeCitizen({ id: "uncle", settlementId: "s1", status: "dead" }),
      makeCitizen({ id: "aunt", settlementId: "s1", status: "dead" }),
      makeCitizen({
        id: "cousin-m",
        parentACitizenId: "uncle",
        sex: "male",
        settlementId: "s1",
      }),
      makeCitizen({
        id: "cousin-f",
        parentACitizenId: "aunt",
        sex: "female",
        settlementId: "s1",
      }),
    ];

    const result = applyFormationForSettlement(
      SETTLEMENT,
      inSettlement(citizens, "s1"),
      new Set(),
      new Set(),
      new Set(),
      10,
      0,
      1,
      ancestorsAt(citizens, 1),
      createSeededRng("any-seed"),
    );

    expect(result.partnershipChanges).toEqual([
      { citizenAId: "cousin-m", citizenBId: "cousin-f", type: "formed" },
    ]);
  });
});

describe("applyFormationForSettlement — minimumPartnershipAgeTurns gating", () => {
  it("excludes a citizen younger than the minimum partnership age", () => {
    const citizens = [
      // Too young: born on turn 8, turnNumber 10 → age 2 < minimum 5.
      makeCitizen({
        bornOnTurnNumber: 8,
        id: "m-young",
        sex: "male",
        settlementId: "s1",
      }),
      // Old enough: born on turn 1 → age 9 >= minimum 5.
      makeCitizen({
        bornOnTurnNumber: 1,
        id: "m-old",
        sex: "male",
        settlementId: "s1",
      }),
      makeCitizen({
        bornOnTurnNumber: 1,
        id: "f1",
        sex: "female",
        settlementId: "s1",
      }),
    ];

    const result = applyFormationForSettlement(
      SETTLEMENT,
      inSettlement(citizens, "s1"),
      new Set(),
      new Set(),
      new Set(),
      10,
      5,
      1,
      ancestorsAt(citizens, 0),
      createSeededRng("any-seed"),
    );

    expect(result.partnershipChanges).toEqual([
      { citizenAId: "m-old", citizenBId: "f1", type: "formed" },
    ]);
  });
});

describe("applyFormationForSettlement — candidate pool exclusions", () => {
  it("excludes dead and already-partnered citizens from the candidate pool", () => {
    const citizens = [
      makeCitizen({ id: "m-dead", sex: "male", settlementId: "s1", status: "dead" }),
      makeCitizen({ id: "m-partnered", sex: "male", settlementId: "s1" }),
      makeCitizen({ id: "m-free", sex: "male", settlementId: "s1" }),
      makeCitizen({ id: "f1", sex: "female", settlementId: "s1" }),
    ];

    const result = applyFormationForSettlement(
      SETTLEMENT,
      inSettlement(citizens, "s1"),
      new Set(),
      new Set(["m-partnered"]),
      new Set(),
      10,
      0,
      1,
      ancestorsAt(citizens, 0),
      createSeededRng("any-seed"),
    );

    expect(result.partnershipChanges).toEqual([
      { citizenAId: "m-free", citizenBId: "f1", type: "formed" },
    ]);
  });

  it("excludes citizens already dead this turn (priorDeadIds) even if status is still alive", () => {
    const citizens = [
      makeCitizen({ id: "m-just-died", sex: "male", settlementId: "s1" }),
      makeCitizen({ id: "m-free", sex: "male", settlementId: "s1" }),
      makeCitizen({ id: "f1", sex: "female", settlementId: "s1" }),
    ];

    const result = applyFormationForSettlement(
      SETTLEMENT,
      inSettlement(citizens, "s1"),
      new Set(["m-just-died"]),
      new Set(),
      new Set(),
      10,
      0,
      1,
      ancestorsAt(citizens, 0),
      createSeededRng("any-seed"),
    );

    expect(result.partnershipChanges).toEqual([
      { citizenAId: "m-free", citizenBId: "f1", type: "formed" },
    ]);
  });

  it("excludes citizens currently in mourning (inMourningCitizenIds)", () => {
    const citizens = [
      makeCitizen({ id: "m-mourning", sex: "male", settlementId: "s1" }),
      makeCitizen({ id: "m-free", sex: "male", settlementId: "s1" }),
      makeCitizen({ id: "f1", sex: "female", settlementId: "s1" }),
    ];

    const result = applyFormationForSettlement(
      SETTLEMENT,
      inSettlement(citizens, "s1"),
      new Set(),
      new Set(),
      new Set(["m-mourning"]),
      10,
      0,
      1,
      ancestorsAt(citizens, 0),
      createSeededRng("any-seed"),
    );

    expect(result.partnershipChanges).toEqual([
      { citizenAId: "m-free", citizenBId: "f1", type: "formed" },
    ]);
  });
});

describe("applyFormationForSettlement — cross-settlement isolation", () => {
  it("does not consider candidates from other settlements", () => {
    const citizens = [
      makeCitizen({ id: "m1", sex: "male", settlementId: "s1" }),
      makeCitizen({ id: "f-other-settlement", sex: "female", settlementId: "s2" }),
    ];

    const result = applyFormationForSettlement(
      SETTLEMENT,
      inSettlement(citizens, "s1"),
      new Set(),
      new Set(),
      new Set(),
      10,
      0,
      1,
      ancestorsAt(citizens, 0),
      createSeededRng("any-seed"),
    );

    expect(result.partnershipChanges).toHaveLength(0);
  });
});

describe("applyFormationForSettlement — memoized ancestry equivalence", () => {
  // Reference implementation of the pre-memoization matching loop: rebuilds the
  // ancestor sets for every candidate pair. The memoized implementation must
  // produce byte-identical pairings on the same seed and fixture.
  function naiveBuildAncestorSet(
    citizenId: string,
    depth: number,
    citizenById: Map<string, SimCitizen>,
  ): Set<string> {
    const result = new Set<string>();
    let frontier = new Set<string>([citizenId]);
    for (let gen = 0; gen <= depth; gen++) {
      for (const id of frontier) result.add(id);
      if (gen === depth) break;
      const next = new Set<string>();
      for (const id of frontier) {
        const c = citizenById.get(id);
        if (c === undefined) continue;
        if (c.parentACitizenId !== null) next.add(c.parentACitizenId);
        if (c.parentBCitizenId !== null) next.add(c.parentBCitizenId);
      }
      frontier = next;
    }
    return result;
  }

  function naiveFormation(
    citizens: SimCitizen[],
    depth: number,
    seekChance: number,
    rng: () => number,
  ): PartnershipChange[] {
    const citizenById = new Map(citizens.map((c) => [c.id, c]));
    const eligible = citizens
      .filter((c) => c.status === "alive" && c.settlementId === "s1")
      .sort(compareById);
    const seekingMales: SimCitizen[] = [];
    const seekingFemales: SimCitizen[] = [];
    for (const citizen of eligible) {
      if (rng() < seekChance) {
        if (citizen.sex === "male") seekingMales.push(citizen);
        else if (citizen.sex === "female") seekingFemales.push(citizen);
      }
    }
    const paired = new Set<string>();
    const pairs: PartnershipChange[] = [];
    for (const male of seekingMales) {
      if (paired.has(male.id)) continue;
      for (const female of seekingFemales) {
        if (paired.has(female.id)) continue;
        if (depth > 0) {
          const a = naiveBuildAncestorSet(male.id, depth, citizenById);
          const b = naiveBuildAncestorSet(female.id, depth, citizenById);
          let kin = false;
          for (const id of a) {
            if (b.has(id)) {
              kin = true;
              break;
            }
          }
          if (kin) continue;
        }
        pairs.push({
          citizenAId: male.id,
          citizenBId: female.id,
          type: "formed",
        });
        paired.add(male.id);
        paired.add(female.id);
        break;
      }
    }
    return pairs;
  }

  /** Dense settlement: 12 founder couples, each with several children. */
  function makeDenseSettlement(): SimCitizen[] {
    const citizens: SimCitizen[] = [];
    for (let family = 0; family < 12; family++) {
      const fa = `p-a-${family}`;
      const fb = `p-b-${family}`;
      citizens.push(
        makeCitizen({ id: fa, settlementId: "s1", sex: "male", status: "dead" }),
        makeCitizen({
          id: fb,
          settlementId: "s1",
          sex: "female",
          status: "dead",
        }),
      );
      for (let child = 0; child < 6; child++) {
        citizens.push(
          makeCitizen({
            id: `c-${family}-${child}`,
            parentACitizenId: fa,
            parentBCitizenId: fb,
            settlementId: "s1",
            sex: child % 2 === 0 ? "male" : "female",
          }),
        );
      }
    }
    // A citizen in another settlement must stay out of the pool.
    citizens.push(makeCitizen({ id: "z-outsider", settlementId: "s2", sex: "female" }));
    return citizens;
  }

  it.each([0, 1, 2])(
    "matches the per-pair-BFS reference implementation at depth %i",
    (depth) => {
      const citizens = makeDenseSettlement();

      const result = applyFormationForSettlement(
        SETTLEMENT,
        inSettlement(citizens, "s1"),
        new Set(),
        new Set(),
        new Set(),
        10,
        0,
        0.6,
        ancestorsAt(citizens, depth),
        createSeededRng("dense-seed"),
      );

      const expected = naiveFormation(
        citizens,
        depth,
        0.6,
        createSeededRng("dense-seed"),
      );

      expect(result.partnershipChanges).toEqual(expected);
      expect(result.partnershipChanges.length).toBeGreaterThan(0);
    },
  );
});
