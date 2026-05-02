import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const settlementReadinessQueryKeys = {
  all: authStateQueryCacheKeys.settlementsAll,
  list: (worldId: string) =>
    [
      ...settlementReadinessQueryKeys.all,
      "readiness",
      "list",
      worldId,
    ] as const,
  summary: (worldId: string) =>
    [
      ...settlementReadinessQueryKeys.all,
      "readiness",
      "summary",
      worldId,
    ] as const,
} as const;
