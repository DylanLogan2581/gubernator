import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const nationReadinessQueryKeys = {
  all: authStateQueryCacheKeys.nationsAll,
  list: (worldId: string) =>
    [...nationReadinessQueryKeys.all, "readiness", "list", worldId] as const,
} as const;
