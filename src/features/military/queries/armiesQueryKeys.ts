import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const armiesQueryKeys = {
  all: authStateQueryCacheKeys.armiesAll,
  bySettlement: (settlementId: string) =>
    [...armiesQueryKeys.all, "by-settlement", settlementId] as const,
  byNation: (nationId: string) =>
    [...armiesQueryKeys.all, "by-nation", nationId] as const,
  groupsByArmy: (armyId: string) =>
    [...armiesQueryKeys.all, "groups-by-army", armyId] as const,
  latestSnapshotsByArmyIds: (armyIds: readonly string[]) =>
    [
      ...armiesQueryKeys.all,
      "latest-snapshots-by-army-ids",
      [...armyIds].sort().join(","),
    ] as const,
  snapshotHistoryByArmyIds: (armyIds: readonly string[]) =>
    [
      ...armiesQueryKeys.all,
      "snapshot-history-by-army-ids",
      [...armyIds].sort().join(","),
    ] as const,
  soldierCitizenIdsByWorld: (worldId: string) =>
    [...armiesQueryKeys.all, "soldier-citizen-ids-by-world", worldId] as const,
  soldierCountsByArmyIds: (armyIds: readonly string[]) =>
    [
      ...armiesQueryKeys.all,
      "soldier-counts-by-army-ids",
      [...armyIds].sort().join(","),
    ] as const,
  soldiersByUnit: (unitId: string) =>
    [...armiesQueryKeys.all, "soldiers-by-unit", unitId] as const,
  unitSoldierCountsByArmyIds: (armyIds: readonly string[]) =>
    [
      ...armiesQueryKeys.all,
      "unit-soldier-counts-by-army-ids",
      [...armyIds].sort().join(","),
    ] as const,
  unitsByArmy: (armyId: string) =>
    [...armiesQueryKeys.all, "units-by-army", armyId] as const,
} as const;
