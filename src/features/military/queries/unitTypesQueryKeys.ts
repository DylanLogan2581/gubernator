import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const unitTypesQueryKeys = {
  all: authStateQueryCacheKeys.unitTypesAll,
  byWorld: (worldId: string) =>
    [...unitTypesQueryKeys.all, "by-world", worldId] as const,
} as const;
