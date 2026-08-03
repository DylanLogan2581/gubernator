import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const educationLevelsQueryKeys = {
  all: authStateQueryCacheKeys.educationLevelsAll,
  byWorld: (worldId: string) =>
    [...educationLevelsQueryKeys.all, "by-world", worldId] as const,
} as const;
