import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const authQueryKeys = {
  all: authStateQueryCacheKeys.authAll,
  availableUsers: () =>
    [...authStateQueryCacheKeys.authAll, "available-users"] as const,
  currentAppUser: authStateQueryCacheKeys.currentAppUser,
  currentSession: authStateQueryCacheKeys.currentSession,
} as const;
