import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const citizensQueryKeys = {
  all: authStateQueryCacheKeys.citizensAll,
  detail: (citizenId: string) =>
    [...citizensQueryKeys.all, "detail", citizenId] as const,
  activePartnershipForCitizen: (citizenId: string) =>
    [
      ...citizensQueryKeys.all,
      "active-partnership-for-citizen",
      citizenId,
    ] as const,
  nationAggregateStats: (nationId: string) =>
    [...citizensQueryKeys.all, "nation-aggregate-stats", nationId] as const,
  partnershipsForCitizen: (citizenId: string) =>
    [...citizensQueryKeys.all, "partnerships-for-citizen", citizenId] as const,
  settlementAggregateStats: (settlementId: string) =>
    [
      ...citizensQueryKeys.all,
      "settlement-aggregate-stats",
      settlementId,
    ] as const,
  settlementList: (settlementId: string) =>
    [...citizensQueryKeys.all, "settlement-list", settlementId] as const,
} as const;
