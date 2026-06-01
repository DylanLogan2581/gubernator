import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const depositsQueryKeys = {
  all: authStateQueryCacheKeys.depositsAll,
  activeByWorld: (worldId: string) =>
    [...depositsQueryKeys.all, "active-by-world", worldId] as const,
  byWorld: (worldId: string) =>
    [...depositsQueryKeys.all, "by-world", worldId] as const,
  detail: (depositTypeId: string) =>
    [...depositsQueryKeys.all, "detail", depositTypeId] as const,
} as const;
