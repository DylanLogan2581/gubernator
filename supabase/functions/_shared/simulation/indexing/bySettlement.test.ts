import { describe, expect, it } from "vitest";

import {
  groupBySettlementId,
  groupCitizensBySettlement,
  groupPartnershipsBySettlement,
  indexCitizensById,
} from "./bySettlement.ts";

import type { SimCitizen, SimPartnership } from "../simulationTypes.ts";

function citizen(
  id: string,
  settlementId: string | null,
  overrides: Partial<SimCitizen> = {},
): SimCitizen {
  return {
    bornOnTurnNumber: 0,
    citizenType: "npc",
    cultureId: null,
    educationLevelId: null,
    givenName: id,
    id,
    namesetId: null,
    parentACitizenId: null,
    parentBCitizenId: null,
    religionId: null,
    roleNationId: null,
    roleSettlementId: null,
    roleType: "none",
    settlementId,
    sex: "male",
    status: "alive",
    surname: null,
    ...overrides,
  };
}

function partnership(
  id: string,
  citizenAId: string,
  citizenBId: string,
): SimPartnership {
  return {
    citizenAId,
    citizenBId,
    endedOnTurnNumber: null,
    formedOnTurnNumber: 0,
    id,
    status: "active",
  };
}

describe("groupBySettlementId", () => {
  it("preserves input order within each group", () => {
    const items = [
      { id: "a", settlementId: "s1" },
      { id: "b", settlementId: "s2" },
      { id: "c", settlementId: "s1" },
      { id: "d", settlementId: "s1" },
    ];

    const grouped = groupBySettlementId(items, (i) => i.settlementId);

    expect(grouped.get("s1")?.map((i) => i.id)).toEqual(["a", "c", "d"]);
    expect(grouped.get("s2")?.map((i) => i.id)).toEqual(["b"]);
  });

  it("omits items with a null or undefined settlement id", () => {
    const items = [
      { id: "a", settlementId: null },
      { id: "b", settlementId: undefined },
      { id: "c", settlementId: "s1" },
    ];

    const grouped = groupBySettlementId(items, (i) => i.settlementId);

    expect([...grouped.keys()]).toEqual(["s1"]);
    expect(grouped.get("s1")?.map((i) => i.id)).toEqual(["c"]);
  });

  it("returns an empty map for empty input", () => {
    expect(groupBySettlementId([], () => "s1").size).toBe(0);
  });
});

describe("groupCitizensBySettlement", () => {
  it("groups by home settlement in input order", () => {
    const citizens = [
      citizen("c1", "s1"),
      citizen("c2", "s2"),
      citizen("c3", "s1"),
      citizen("c4", null),
    ];

    const grouped = groupCitizensBySettlement(citizens);

    expect(grouped.get("s1")?.map((c) => c.id)).toEqual(["c1", "c3"]);
    expect(grouped.get("s2")?.map((c) => c.id)).toEqual(["c2"]);
    expect(grouped.has("null")).toBe(false);
  });

  it("supports an effective-settlement accessor", () => {
    const citizens = [citizen("c1", "s1"), citizen("c2", "s1")];
    const effective = new Map([["c1", "s9"]]);

    const grouped = groupCitizensBySettlement(
      citizens,
      (c) => effective.get(c.id) ?? c.settlementId,
    );

    expect(grouped.get("s9")?.map((c) => c.id)).toEqual(["c1"]);
    expect(grouped.get("s1")?.map((c) => c.id)).toEqual(["c2"]);
  });

  it("keeps dead citizens in their group (callers filter by status)", () => {
    const citizens = [
      citizen("c1", "s1", { status: "dead" }),
      citizen("c2", "s1"),
    ];

    expect(groupCitizensBySettlement(citizens).get("s1")?.map((c) => c.id)).toEqual([
      "c1",
      "c2",
    ]);
  });
});

describe("groupPartnershipsBySettlement", () => {
  it("groups by citizen A's settlement in input order", () => {
    const citizens = [
      citizen("c1", "s1"),
      citizen("c2", "s1"),
      citizen("c3", "s2"),
      citizen("c4", "s2"),
    ];
    const citizenById = indexCitizensById(citizens);
    const partnerships = [
      partnership("p1", "c1", "c2"),
      partnership("p2", "c3", "c4"),
      partnership("p3", "c2", "c1"),
    ];

    const grouped = groupPartnershipsBySettlement(partnerships, citizenById);

    expect(grouped.get("s1")?.map((p) => p.id)).toEqual(["p1", "p3"]);
    expect(grouped.get("s2")?.map((p) => p.id)).toEqual(["p2"]);
  });

  it("omits partnerships whose citizen A is unknown or settlement-less", () => {
    const citizenById = indexCitizensById([citizen("c1", null)]);
    const partnerships = [
      partnership("p1", "c1", "c2"),
      partnership("p2", "missing", "c1"),
    ];

    expect(groupPartnershipsBySettlement(partnerships, citizenById).size).toBe(0);
  });
});

describe("indexCitizensById", () => {
  it("indexes by id and keeps the first entry for duplicates", () => {
    const first = citizen("c1", "s1");
    const duplicate = citizen("c1", "s2");

    const byId = indexCitizensById([first, duplicate, citizen("c2", "s1")]);

    expect(byId.get("c1")).toBe(first);
    expect(byId.get("c2")?.settlementId).toBe("s1");
    expect(byId.size).toBe(2);
  });
});
