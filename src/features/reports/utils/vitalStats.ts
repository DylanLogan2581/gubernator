// Aggregation for the births/deaths/population comparison tables shared by the
// world and nation report sections: collapse per-turn snapshot rows into one
// summary per entity.

export type VitalStatsSummary = {
  readonly id: string;
  readonly name: string;
  readonly latestPopulation: number;
  readonly totalBirths: number;
  readonly totalDeaths: number;
};

/** One per-turn snapshot for an entity, before aggregation. */
export type VitalStatsEntry = {
  readonly id: string;
  readonly name: string;
  readonly turnNumber: number;
  readonly populationTotal: number;
  readonly birthCount: number;
  readonly deathCount: number;
};

/**
 * Collapse per-turn snapshot entries into one summary per entity: births and
 * deaths sum across the range, population is taken from the latest turn seen.
 */
export function aggregateVitalStats(
  entries: readonly VitalStatsEntry[],
): VitalStatsSummary[] {
  const byId = new Map<
    string,
    {
      name: string;
      latestTurn: number;
      latestPop: number;
      births: number;
      deaths: number;
    }
  >();

  for (const entry of entries) {
    const existing = byId.get(entry.id);
    if (existing === undefined) {
      byId.set(entry.id, {
        births: entry.birthCount,
        deaths: entry.deathCount,
        latestPop: entry.populationTotal,
        latestTurn: entry.turnNumber,
        name: entry.name,
      });
    } else {
      existing.births += entry.birthCount;
      existing.deaths += entry.deathCount;
      if (entry.turnNumber > existing.latestTurn) {
        existing.latestTurn = entry.turnNumber;
        existing.latestPop = entry.populationTotal;
      }
    }
  }

  return Array.from(byId.entries()).map(([id, s]) => ({
    id,
    latestPopulation: s.latestPop,
    name: s.name,
    totalBirths: s.births,
    totalDeaths: s.deaths,
  }));
}
