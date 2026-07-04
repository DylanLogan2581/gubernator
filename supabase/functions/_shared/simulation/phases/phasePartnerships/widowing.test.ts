// Unit tests for phasePartnerships/widowing — mourning-period start on
// partner death, priorDeadIds double-processing guard, and untouched
// partnerships.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { makeCitizen } from "../testFixtures.ts";

import { applyWidowing } from "./widowing.ts";

import type { CitizenDeath, SimCitizen, SimPartnership } from "../../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCitizenById(citizens: SimCitizen[]): Map<string, SimCitizen> {
  return new Map(citizens.map((c) => [c.id, c]));
}

function makePartnership(
  overrides: Partial<SimPartnership> & { citizenAId: string; citizenBId: string; id: string },
): SimPartnership {
  return {
    endedOnTurnNumber: null,
    formedOnTurnNumber: 1,
    status: "active",
    ...overrides,
  };
}

function makeDeath(citizenId: string): CitizenDeath {
  return { category: "unknown", citizenId, detail: null };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("applyWidowing — partner death starts mourning for the survivor", () => {
  it("emits status_changed, a partnership.widowed log, and a notification for the surviving partner", () => {
    const citizens = [
      makeCitizen({ id: "a", settlementId: "s1" }),
      makeCitizen({ id: "b", settlementId: "s1" }),
    ];
    const partnership = makePartnership({ citizenAId: "a", citizenBId: "b", id: "p1" });

    const result = applyWidowing(
      [partnership],
      [makeDeath("a")],
      toCitizenById(citizens),
      5,
      10,
    );

    expect(result.partnershipChanges).toEqual([
      {
        partnershipId: "p1",
        reason: "partner_died",
        toStatus: "widowed",
        type: "status_changed",
      },
    ]);
    expect(result.logs).toEqual([
      {
        category: "partnership.widowed",
        payload: { partnershipId: "p1", survivingCitizenId: "b" },
        phase: "partnerships",
        settlementId: "s1",
      },
    ]);
    expect(result.notifications).toEqual([
      {
        messageText: "A citizen lost their partner this turn.",
        notificationType: "partnership.widowed",
        scope: "settlement",
        settlementId: "s1",
      },
    ]);
    expect(result.inMourningCitizenIds).toEqual(new Set(["b"]));
    expect(result.newlyWidowedPartnershipIds).toEqual(new Set(["p1"]));
    expect(result.priorDeadIds).toEqual(new Set(["a"]));
    // The newly widowed partnership is excluded from "still actively paired".
    expect(result.pairedCitizenIds.has("a")).toBe(false);
    expect(result.pairedCitizenIds.has("b")).toBe(false);
  });

  it("keeps a previously widowed partnership's survivors in mourning while within mourningPeriodTurns", () => {
    const citizens = [
      makeCitizen({ id: "g", settlementId: "s1" }),
      makeCitizen({ id: "h", settlementId: "s1" }),
    ];
    // Already widowed on turn 8; turnNumber is 10 and mourningPeriodTurns is
    // 5, so 10 - 8 = 2 <= 5 keeps both survivors in mourning.
    const partnership = makePartnership({
      citizenAId: "g",
      citizenBId: "h",
      endedOnTurnNumber: 8,
      id: "p-already-widowed",
      status: "widowed",
    });

    const result = applyWidowing([partnership], [], toCitizenById(citizens), 5, 10);

    expect(result.inMourningCitizenIds).toEqual(new Set(["g", "h"]));
    // No new death occurred this turn, so no new partnershipChanges/logs.
    expect(result.partnershipChanges).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
  });

  it("drops a previously widowed partnership's survivors out of mourning once mourningPeriodTurns has elapsed", () => {
    const citizens = [
      makeCitizen({ id: "g2", settlementId: "s1" }),
      makeCitizen({ id: "h2", settlementId: "s1" }),
    ];
    // Widowed on turn 1; turnNumber is 10 and mourningPeriodTurns is 5, so
    // 10 - 1 = 9 > 5 — mourning has ended.
    const partnership = makePartnership({
      citizenAId: "g2",
      citizenBId: "h2",
      endedOnTurnNumber: 1,
      id: "p-mourning-over",
      status: "widowed",
    });

    const result = applyWidowing([partnership], [], toCitizenById(citizens), 5, 10);

    expect(result.inMourningCitizenIds.has("g2")).toBe(false);
    expect(result.inMourningCitizenIds.has("h2")).toBe(false);
  });
});

describe("applyWidowing — survivor already in priorDeadIds is not double-processed", () => {
  it("logs the death but does not add a dead survivor to mourning or emit a notification", () => {
    const citizens = [
      makeCitizen({ id: "c", settlementId: "s1" }),
      makeCitizen({ id: "d", settlementId: "s1" }),
    ];
    const partnership = makePartnership({ citizenAId: "c", citizenBId: "d", id: "p2" });

    // Both partners died the same turn.
    const result = applyWidowing(
      [partnership],
      [makeDeath("c"), makeDeath("d")],
      toCitizenById(citizens),
      5,
      10,
    );

    expect(result.partnershipChanges).toEqual([
      {
        partnershipId: "p2",
        reason: "partner_died",
        toStatus: "widowed",
        type: "status_changed",
      },
    ]);
    // Log is still emitted (recording the death), naming "d" as the
    // nominal survivor per the aDied-first branch ordering.
    expect(result.logs).toEqual([
      {
        category: "partnership.widowed",
        payload: { partnershipId: "p2", survivingCitizenId: "d" },
        phase: "partnerships",
        settlementId: "s1",
      },
    ]);
    // No notification and no mourning entry, because the "survivor" is
    // also dead — not double-processed as a live widow.
    expect(result.notifications).toHaveLength(0);
    expect(result.inMourningCitizenIds.has("d")).toBe(false);
    expect(result.inMourningCitizenIds.has("c")).toBe(false);
  });
});

describe("applyWidowing — untouched partnerships", () => {
  it("leaves a partnership with neither partner dead unchanged and still actively paired", () => {
    const citizens = [
      makeCitizen({ id: "e", settlementId: "s1" }),
      makeCitizen({ id: "f", settlementId: "s1" }),
    ];
    const partnership = makePartnership({ citizenAId: "e", citizenBId: "f", id: "p3" });

    const result = applyWidowing([partnership], [], toCitizenById(citizens), 5, 10);

    expect(result.partnershipChanges).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.newlyWidowedPartnershipIds.size).toBe(0);
    expect(result.pairedCitizenIds).toEqual(new Set(["e", "f"]));
    expect(result.inMourningCitizenIds.size).toBe(0);
  });

  it("ignores a non-active partnership even if a listed partner died this turn", () => {
    const citizens = [
      makeCitizen({ id: "i", settlementId: "s1" }),
      makeCitizen({ id: "j", settlementId: "s1" }),
    ];
    const partnership = makePartnership({
      citizenAId: "i",
      citizenBId: "j",
      id: "p-dissolved",
      status: "dissolved",
    });

    const result = applyWidowing(
      [partnership],
      [makeDeath("i")],
      toCitizenById(citizens),
      5,
      10,
    );

    expect(result.partnershipChanges).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.pairedCitizenIds.has("j")).toBe(false);
  });
});
