// Unit tests for phasePartnerships/backfill — bornOnTurnNumber backfill for
// legacy citizens missing that field.
//
// Cross-runtime module: Deno-compatible, no browser APIs.
// Pure function of its arguments — no rng involved, so no determinism test
// is needed here (see fertility.test.ts / childNameset.test.ts for that).

import { describe, expect, it } from "vitest";

import { makeCitizen } from "../testFixtures.ts";

import { applyBornOnTurnNumberBackfill } from "./backfill.ts";

import type { SimCitizen } from "../../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("applyBornOnTurnNumberBackfill", () => {
  it("patches only citizens whose bornOnTurnNumber is null", () => {
    const citizens: SimCitizen[] = [
      makeCitizen({ bornOnTurnNumber: null, id: "c1", settlementId: "s1" }),
      makeCitizen({ bornOnTurnNumber: 5, id: "c2", settlementId: "s1" }),
    ];

    const { citizenPatches } = applyBornOnTurnNumberBackfill(citizens, 20, 3);

    expect(citizenPatches).toHaveLength(1);
    expect(citizenPatches[0]?.citizenId).toBe("c1");
  });

  it("patches to turnNumber - minimumPartnershipAgeTurns", () => {
    const citizens: SimCitizen[] = [
      makeCitizen({ bornOnTurnNumber: null, id: "c1", settlementId: "s1" }),
    ];

    const { citizenPatches } = applyBornOnTurnNumberBackfill(citizens, 20, 3);

    expect(citizenPatches[0]?.bornOnTurnNumber).toBe(17);
  });

  it("leaves already-set citizens untouched in the returned map", () => {
    const already = makeCitizen({ bornOnTurnNumber: 5, id: "c2", settlementId: "s1" });
    const citizens: SimCitizen[] = [already];

    const { citizenById } = applyBornOnTurnNumberBackfill(citizens, 20, 3);

    expect(citizenById.get("c2")).toBe(already);
    expect(citizenById.get("c2")?.bornOnTurnNumber).toBe(5);
  });

  it("updates citizenById with the backfilled value for patched citizens", () => {
    const citizens: SimCitizen[] = [
      makeCitizen({ bornOnTurnNumber: null, id: "c1", settlementId: "s1" }),
    ];

    const { citizenById } = applyBornOnTurnNumberBackfill(citizens, 20, 3);

    expect(citizenById.get("c1")?.bornOnTurnNumber).toBe(17);
  });

  it("returns citizenPatches in the exact { bornOnTurnNumber, citizenId } shape", () => {
    const citizens: SimCitizen[] = [
      makeCitizen({ bornOnTurnNumber: null, id: "c1", settlementId: "s1" }),
    ];

    const { citizenPatches } = applyBornOnTurnNumberBackfill(citizens, 10, 2);

    expect(citizenPatches).toStrictEqual([{ bornOnTurnNumber: 8, citizenId: "c1" }]);
  });

  it("produces one patch per null-bornOnTurnNumber citizen, in citizen order", () => {
    const citizens: SimCitizen[] = [
      makeCitizen({ bornOnTurnNumber: null, id: "c1", settlementId: "s1" }),
      makeCitizen({ bornOnTurnNumber: 1, id: "c2", settlementId: "s1" }),
      makeCitizen({ bornOnTurnNumber: null, id: "c3", settlementId: "s1" }),
    ];

    const { citizenPatches } = applyBornOnTurnNumberBackfill(citizens, 10, 0);

    expect(citizenPatches).toStrictEqual([
      { bornOnTurnNumber: 10, citizenId: "c1" },
      { bornOnTurnNumber: 10, citizenId: "c3" },
    ]);
  });

  it("returns empty citizenPatches and an empty map for an empty citizens list", () => {
    const { citizenById, citizenPatches } = applyBornOnTurnNumberBackfill([], 10, 0);

    expect(citizenPatches).toStrictEqual([]);
    expect(citizenById.size).toBe(0);
  });

  it("returns no patches when every citizen already has a bornOnTurnNumber", () => {
    const citizens: SimCitizen[] = [
      makeCitizen({ bornOnTurnNumber: 1, id: "c1", settlementId: "s1" }),
      makeCitizen({ bornOnTurnNumber: 2, id: "c2", settlementId: "s1" }),
    ];

    const { citizenPatches } = applyBornOnTurnNumberBackfill(citizens, 10, 0);

    expect(citizenPatches).toStrictEqual([]);
  });
});
