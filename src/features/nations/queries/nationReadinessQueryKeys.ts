import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const nationReadinessQueryKeys = {
  all: authStateQueryCacheKeys.nationsAll,
  list: (worldId: string) =>
    [...nationReadinessQueryKeys.all, "readiness", "list", worldId] as const,
  voters: (nationId: string, turnNumber: number) =>
    [
      ...nationReadinessQueryKeys.all,
      "readiness",
      "voters",
      nationId,
      turnNumber,
    ] as const,
} as const;
