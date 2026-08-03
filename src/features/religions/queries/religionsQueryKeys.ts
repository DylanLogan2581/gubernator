import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const religionsQueryKeys = {
  all: authStateQueryCacheKeys.religionsAll,
  byWorld: (worldId: string) =>
    [...religionsQueryKeys.all, "by-world", worldId] as const,
  detail: (religionId: string) =>
    [...religionsQueryKeys.all, "detail", religionId] as const,
  usage: (religionId: string) =>
    [...religionsQueryKeys.all, "usage", religionId] as const,
} as const;
