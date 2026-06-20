import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const settlementsQueryKeys = {
  all: authStateQueryCacheKeys.settlementsAll,
  byWorld: (worldId: string) =>
    [...settlementsQueryKeys.all, "by-world", worldId] as const,
  detail: (settlementId: string) =>
    [...settlementsQueryKeys.all, "detail", settlementId] as const,
  populationCap: (settlementId: string) =>
    [...settlementsQueryKeys.all, "population-cap", settlementId] as const,
} as const;
