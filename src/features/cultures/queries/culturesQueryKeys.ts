import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const culturesQueryKeys = {
  all: authStateQueryCacheKeys.culturesAll,
  byWorld: (worldId: string) =>
    [...culturesQueryKeys.all, "by-world", worldId] as const,
  detail: (cultureId: string) =>
    [...culturesQueryKeys.all, "detail", cultureId] as const,
  usage: (cultureId: string) =>
    [...culturesQueryKeys.all, "usage", cultureId] as const,
} as const;
