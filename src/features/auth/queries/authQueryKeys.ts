import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const authQueryKeys = {
  all: authStateQueryCacheKeys.authAll,
  currentAppUser: authStateQueryCacheKeys.currentAppUser,
  currentSession: authStateQueryCacheKeys.currentSession,
} as const;
