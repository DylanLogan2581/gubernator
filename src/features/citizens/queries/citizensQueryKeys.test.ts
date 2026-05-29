import { describe, expect, it } from "vitest";

import { citizensQueryKeys } from "./citizensQueryKeys";

describe("citizensQueryKeys", () => {
  it("centralizes the citizens query key root", () => {
    expect(citizensQueryKeys.all).toEqual(["citizens"]);
  });

  it("creates stable detail keys scoped by citizen id", () => {
    expect(citizensQueryKeys.detail("c-1")).toEqual([
      "citizens",
      "detail",
      "c-1",
    ]);
    expect(citizensQueryKeys.detail("c-1")).toEqual(
      citizensQueryKeys.detail("c-1"),
    );
    expect(citizensQueryKeys.detail("c-1")).not.toEqual(
      citizensQueryKeys.detail("c-2"),
    );
  });

  it("creates stable list keys scoped by settlement id", () => {
    expect(citizensQueryKeys.settlementList("settlement-1")).toEqual([
      "citizens",
      "settlement-list",
      "settlement-1",
    ]);
    expect(citizensQueryKeys.assignmentsInSettlement("settlement-1")).toEqual([
      "citizens",
      "assignments-in-settlement",
      "settlement-1",
    ]);
  });

  it("creates stable aggregate keys scoped by settlement and nation", () => {
    expect(citizensQueryKeys.settlementAggregateStats("settlement-1")).toEqual([
      "citizens",
      "settlement-aggregate-stats",
      "settlement-1",
    ]);
    expect(citizensQueryKeys.nationAggregateStats("nation-1")).toEqual([
      "citizens",
      "nation-aggregate-stats",
      "nation-1",
    ]);
  });

  it("creates stable partnership keys scoped by citizen id", () => {
    expect(citizensQueryKeys.partnershipsForCitizen("c-1")).toEqual([
      "citizens",
      "partnerships-for-citizen",
      "c-1",
    ]);
    expect(citizensQueryKeys.activePartnershipForCitizen("c-1")).toEqual([
      "citizens",
      "active-partnership-for-citizen",
      "c-1",
    ]);
  });

  it("creates stable assignment and roster keys", () => {
    expect(citizensQueryKeys.currentAssignmentForCitizen("c-1")).toEqual([
      "citizens",
      "current-assignment-for-citizen",
      "c-1",
    ]);
    expect(citizensQueryKeys.playerCharactersInNation("nation-1")).toEqual([
      "citizens",
      "player-characters-in-nation",
      "nation-1",
    ]);
    expect(citizensQueryKeys.unpairedAliveInWorld("world-1")).toEqual([
      "citizens",
      "unpaired-alive-in-world",
      "world-1",
    ]);
  });
});
