import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const citizensQueryKeys = {
  all: authStateQueryCacheKeys.citizensAll,
  adminDetails: (citizenId: string) =>
    [...citizensQueryKeys.all, "admin-details", citizenId] as const,
  detail: (citizenId: string) =>
    [...citizensQueryKeys.all, "detail", citizenId] as const,
  activePartnershipForCitizen: (citizenId: string) =>
    [
      ...citizensQueryKeys.all,
      "active-partnership-for-citizen",
      citizenId,
    ] as const,
  assignmentsInSettlement: (settlementId: string) =>
    [
      ...citizensQueryKeys.all,
      "assignments-in-settlement",
      settlementId,
    ] as const,
  currentAssignmentForCitizen: (citizenId: string) =>
    [
      ...citizensQueryKeys.all,
      "current-assignment-for-citizen",
      citizenId,
    ] as const,
  nationAggregateStats: (nationId: string) =>
    [...citizensQueryKeys.all, "nation-aggregate-stats", nationId] as const,
  partnershipsForCitizen: (citizenId: string) =>
    [...citizensQueryKeys.all, "partnerships-for-citizen", citizenId] as const,
  playerCharactersInNation: (nationId: string) =>
    [
      ...citizensQueryKeys.all,
      "player-characters-in-nation",
      nationId,
    ] as const,
  settlementAggregateStats: (settlementId: string) =>
    [
      ...citizensQueryKeys.all,
      "settlement-aggregate-stats",
      settlementId,
    ] as const,
  settlementConstructionProjectCounts: (settlementId: string) =>
    [
      ...citizensQueryKeys.all,
      "settlement-construction-project-counts",
      settlementId,
    ] as const,
  settlementJobCounts: (settlementId: string) =>
    [...citizensQueryKeys.all, "settlement-job-counts", settlementId] as const,
  settlementList: (settlementId: string) =>
    [...citizensQueryKeys.all, "settlement-list", settlementId] as const,
  settlementTargetAssignments: (settlementId: string) =>
    [
      ...citizensQueryKeys.all,
      "settlement-target-assignments",
      settlementId,
    ] as const,
  unpairedAliveInWorld: (worldId: string) =>
    [...citizensQueryKeys.all, "unpaired-alive-in-world", worldId] as const,
} as const;
