export const snapshotAggregateQueryKeys = {
  all: ["snapshot-aggregates"] as const,
  nationPopulation: (nationId: string, fromTurn: number, toTurn: number) =>
    [
      ...snapshotAggregateQueryKeys.all,
      "nation-population",
      nationId,
      fromTurn,
      toTurn,
    ] as const,
  nationResources: (nationId: string, fromTurn: number, toTurn: number) =>
    [
      ...snapshotAggregateQueryKeys.all,
      "nation-resources",
      nationId,
      fromTurn,
      toTurn,
    ] as const,
  nationSettlements: (nationId: string, fromTurn: number, toTurn: number) =>
    [
      ...snapshotAggregateQueryKeys.all,
      "nation-settlements",
      nationId,
      fromTurn,
      toTurn,
    ] as const,
  worldNationsPopulation: (worldId: string, fromTurn: number, toTurn: number) =>
    [
      ...snapshotAggregateQueryKeys.all,
      "world-nations-population",
      worldId,
      fromTurn,
      toTurn,
    ] as const,
  worldPopulation: (worldId: string, fromTurn: number, toTurn: number) =>
    [
      ...snapshotAggregateQueryKeys.all,
      "world-population",
      worldId,
      fromTurn,
      toTurn,
    ] as const,
  worldResources: (worldId: string, fromTurn: number, toTurn: number) =>
    [
      ...snapshotAggregateQueryKeys.all,
      "world-resources",
      worldId,
      fromTurn,
      toTurn,
    ] as const,
} as const;
