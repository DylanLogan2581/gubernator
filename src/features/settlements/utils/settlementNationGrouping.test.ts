import { describe, expect, it } from "vitest";

import { groupSettlementsByNation } from "./settlementNationGrouping";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";

function createItem(
  overrides: Partial<SettlementReadinessListItem> = {},
): SettlementReadinessListItem {
  return {
    autoReadyEnabled: false,
    id: "s1",
    isReadyCurrentTurn: false,
    isReadyForCurrentTurn: false,
    lastReadyAt: null,
    name: "Settlement",
    nationId: "nation-1",
    nationName: "Nation A",
    readySetAt: null,
    ...overrides,
  };
}

describe("groupSettlementsByNation", () => {
  it("returns empty array for 0 settlements", () => {
    expect(groupSettlementsByNation([])).toEqual([]);
  });

  it("groups settlements by nation for a multi-nation world", () => {
    const items = [
      createItem({ id: "s1", nationId: "n1", nationName: "Alpha" }),
      createItem({ id: "s2", nationId: "n2", nationName: "Beta" }),
      createItem({ id: "s3", nationId: "n1", nationName: "Alpha" }),
    ];

    const groups = groupSettlementsByNation(items);

    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.nationId === "n1")?.items).toHaveLength(2);
    expect(groups.find((g) => g.nationId === "n2")?.items).toHaveLength(1);
  });

  it("preserves nation names on each group", () => {
    const items = [
      createItem({ id: "s1", nationId: "n1", nationName: "Alpha" }),
      createItem({ id: "s2", nationId: "n2", nationName: "Beta" }),
    ];

    const groups = groupSettlementsByNation(items);

    const nationNames = groups.map((g) => g.nationName);
    expect(nationNames).toContain("Alpha");
    expect(nationNames).toContain("Beta");
  });

  it("sorts nations alphabetically by name", () => {
    const items = [
      createItem({ id: "s1", nationId: "n2", nationName: "Zebra" }),
      createItem({ id: "s2", nationId: "n1", nationName: "Alpha" }),
    ];

    const groups = groupSettlementsByNation(items);

    expect(groups[0].nationId).toBe("n1");
    expect(groups[0].nationName).toBe("Alpha");
    expect(groups[1].nationId).toBe("n2");
    expect(groups[1].nationName).toBe("Zebra");
  });

  it("sorts nation names case-insensitively", () => {
    const items = [
      createItem({ id: "s1", nationId: "n1", nationName: "zebra" }),
      createItem({ id: "s2", nationId: "n2", nationName: "Alpha" }),
    ];

    const groups = groupSettlementsByNation(items);

    expect(groups[0].nationName).toBe("Alpha");
    expect(groups[1].nationName).toBe("zebra");
  });

  it("does not reorder nations when readiness changes", () => {
    const baseItems = [
      createItem({
        id: "s1",
        isReadyCurrentTurn: false,
        nationId: "n1",
        nationName: "Beta",
      }),
      createItem({
        id: "s2",
        isReadyCurrentTurn: false,
        nationId: "n2",
        nationName: "Alpha",
      }),
    ];

    const groupsBefore = groupSettlementsByNation(baseItems);

    const updatedItems = [
      createItem({
        id: "s1",
        isReadyCurrentTurn: true,
        nationId: "n1",
        nationName: "Beta",
      }),
      createItem({
        id: "s2",
        isReadyCurrentTurn: false,
        nationId: "n2",
        nationName: "Alpha",
      }),
    ];

    const groupsAfter = groupSettlementsByNation(updatedItems);

    expect(groupsBefore[0].nationId).toBe("n2");
    expect(groupsBefore[1].nationId).toBe("n1");
    expect(groupsAfter[0].nationId).toBe("n2");
    expect(groupsAfter[1].nationId).toBe("n1");
  });

  it("computes 100% ready count and percentage for an all-ready nation", () => {
    const items = [
      createItem({
        autoReadyEnabled: true,
        id: "s1",
        isReadyCurrentTurn: false,
        nationId: "n1",
        nationName: "Alpha",
      }),
      createItem({
        autoReadyEnabled: false,
        id: "s2",
        isReadyCurrentTurn: true,
        nationId: "n1",
        nationName: "Alpha",
      }),
    ];

    const groups = groupSettlementsByNation(items);

    expect(groups).toHaveLength(1);
    expect(groups[0].readyCount).toBe(2);
    expect(groups[0].totalCount).toBe(2);
    expect(groups[0].readyPercentage).toBe(100);
  });

  it("computes 0% ready count and percentage for a none-ready nation", () => {
    const items = [
      createItem({ id: "s1", nationId: "n1", nationName: "Alpha" }),
      createItem({ id: "s2", nationId: "n1", nationName: "Alpha" }),
    ];

    const groups = groupSettlementsByNation(items);

    expect(groups).toHaveLength(1);
    expect(groups[0].readyCount).toBe(0);
    expect(groups[0].totalCount).toBe(2);
    expect(groups[0].readyPercentage).toBe(0);
  });

  it("counts only items from each nation toward that nation's totals", () => {
    const items = [
      createItem({
        autoReadyEnabled: false,
        id: "s1",
        isReadyCurrentTurn: true,
        nationId: "n1",
        nationName: "Alpha",
      }),
      createItem({ id: "s2", nationId: "n1", nationName: "Alpha" }),
      createItem({ id: "s3", nationId: "n2", nationName: "Beta" }),
    ];

    const groups = groupSettlementsByNation(items);

    const alpha = groups.find((g) => g.nationId === "n1");
    const beta = groups.find((g) => g.nationId === "n2");

    expect(alpha?.readyCount).toBe(1);
    expect(alpha?.totalCount).toBe(2);
    expect(beta?.readyCount).toBe(0);
    expect(beta?.totalCount).toBe(1);
  });
});
