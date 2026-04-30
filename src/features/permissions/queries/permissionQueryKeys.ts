import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const permissionQueryKeys = {
  all: authStateQueryCacheKeys.permissionsAll,
  currentAccessContext: () =>
    [...permissionQueryKeys.all, "current-access-context"] as const,
} as const;
