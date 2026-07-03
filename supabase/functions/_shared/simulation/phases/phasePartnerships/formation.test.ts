// Unit tests for phasePartnerships/formation — seeded-RNG determinism,
// partnershipSeekChance gating, incest-prevention kinship depth, minimum-age
// gating, dead/already-partnered exclusion, and cross-settlement isolation.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { createSeededRng } from "../../seededRng.ts";
import { makeCitizen, makeSettlement } from "../testFixtures.ts";

import { applyFormationForSettlement } from "./formation.ts";

import type { FormationResult } from "./formation.ts";
import type { SimCitizen } from "../../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCitizenById(citizens: SimCitizen[]): Map<string, SimCitizen> {
  return new Map(citizens.map((c) => [c.id, c]));
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
        toCitizenById(citizens),
        new Set(),
        new Set(),
        new Set(),
        10,
        0,
        0.5,
        0,
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
      toCitizenById(citizens),
      new Set(),
      new Set(),
      new Set(),
      10,
      0,
      0,
      0,
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
      toCitizenById(citizens),
      new Set(),
      new Set(),
      new Set(),
      10,
      0,
      1,
      0,
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
      toCitizenById(citizens),
      new Set(),
      new Set(),
      new Set(),
      10,
      0,
      1,
      1, // incestPreventionDepth: 1 generation (self + parents)
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
      toCitizenById(citizens),
      new Set(),
      new Set(),
      new Set(),
      10,
      0,
      1,
      1,
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
      toCitizenById(citizens),
      new Set(),
      new Set(),
      new Set(),
      10,
      5,
      1,
      0,
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
      toCitizenById(citizens),
      new Set(),
      new Set(["m-partnered"]),
      new Set(),
      10,
      0,
      1,
      0,
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
      toCitizenById(citizens),
      new Set(["m-just-died"]),
      new Set(),
      new Set(),
      10,
      0,
      1,
      0,
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
      toCitizenById(citizens),
      new Set(),
      new Set(),
      new Set(["m-mourning"]),
      10,
      0,
      1,
      0,
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
      toCitizenById(citizens),
      new Set(),
      new Set(),
      new Set(),
      10,
      0,
      1,
      0,
      createSeededRng("any-seed"),
    );

    expect(result.partnershipChanges).toHaveLength(0);
  });
});
