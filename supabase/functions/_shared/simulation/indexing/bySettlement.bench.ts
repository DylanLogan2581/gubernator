// Micro-benchmark: per-settlement scans (O(settlements × citizens)) versus the
// grouped index (O(citizens)) on a ~100k-citizen fixture.
//
// Not part of the test suite — run with:
//   npx vitest bench supabase/functions/_shared/simulation/indexing/bySettlement.bench.ts

import { bench, describe } from "vitest";

import { groupCitizensBySettlement } from "./bySettlement.ts";

import type { SimCitizen } from "../simulationTypes.ts";

const CITIZEN_COUNT = 100_000;

function makeCitizens(settlementCount: number): SimCitizen[] {
  const citizens: SimCitizen[] = [];
  for (let i = 0; i < CITIZEN_COUNT; i++) {
    citizens.push({
      bornOnTurnNumber: i % 40,
      citizenType: "npc",
      cultureId: null,
      educationLevelId: null,
      givenName: `c${i}`,
      id: `c${i}`,
      namesetId: null,
      parentACitizenId: null,
      parentBCitizenId: null,
      religionId: null,
      roleNationId: null,
      roleSettlementId: null,
      roleType: "none",
      settlementId: `s${i % settlementCount}`,
      sex: i % 2 === 0 ? "male" : "female",
      status: "alive",
      surname: null,
    });
  }
  return citizens;
}

for (const settlementCount of [50, 200]) {
  const citizens = makeCitizens(settlementCount);
  const settlementIds = Array.from(
    { length: settlementCount },
    (_, i) => `s${i}`,
  );

  describe(`${settlementCount} settlements × ${CITIZEN_COUNT} citizens`, () => {
    bench("per-settlement filter (before)", () => {
      let total = 0;
      for (const sid of settlementIds) {
        total += citizens.filter(
          (c) => c.status === "alive" && c.settlementId === sid,
        ).length;
      }
      if (total < 0) throw new Error("unreachable");
    });

    bench("grouped index (after)", () => {
      let total = 0;
      const grouped = groupCitizensBySettlement(citizens);
      for (const sid of settlementIds) {
        total += (grouped.get(sid) ?? []).filter((c) => c.status === "alive").length;
      }
      if (total < 0) throw new Error("unreachable");
    });
  });
}
