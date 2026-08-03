import { describe, expect, it } from "vitest";

import { aggregateVitalStats, type VitalStatsEntry } from "./vitalStats";

function entry(overrides: Partial<VitalStatsEntry>): VitalStatsEntry {
  return {
    birthCount: 0,
    deathCount: 0,
    id: "a",
    name: "A",
    populationTotal: 0,
    turnNumber: 1,
    ...overrides,
  };
}

describe("aggregateVitalStats", () => {
  it("sums births and deaths and keeps the latest-turn population per entity", () => {
    const summaries = aggregateVitalStats([
      entry({
        turnNumber: 1,
        populationTotal: 100,
        birthCount: 5,
        deathCount: 2,
      }),
      entry({
        turnNumber: 3,
        populationTotal: 120,
        birthCount: 4,
        deathCount: 1,
      }),
      entry({
        turnNumber: 2,
        populationTotal: 110,
        birthCount: 3,
        deathCount: 6,
      }),
    ]);

    expect(summaries).toEqual([
      {
        id: "a",
        name: "A",
        latestPopulation: 120,
        totalBirths: 12,
        totalDeaths: 9,
      },
    ]);
  });

  it("produces one summary per distinct id", () => {
    const summaries = aggregateVitalStats([
      entry({ id: "a", name: "A", populationTotal: 10 }),
      entry({ id: "b", name: "B", populationTotal: 20 }),
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("returns an empty array for no entries", () => {
    expect(aggregateVitalStats([])).toEqual([]);
  });
});
