export const settlementSnapshotQueryKeys = {
  all: ["settlement-snapshots"] as const,
  population: (settlementId: string, fromTurn: number, toTurn: number) =>
    [
      ...settlementSnapshotQueryKeys.all,
      "population",
      settlementId,
      fromTurn,
      toTurn,
    ] as const,
  resources: (settlementId: string, fromTurn: number, toTurn: number) =>
    [
      ...settlementSnapshotQueryKeys.all,
      "resources",
      settlementId,
      fromTurn,
      toTurn,
    ] as const,
} as const;
