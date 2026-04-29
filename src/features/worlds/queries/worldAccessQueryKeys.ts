import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const worldAccessQueryKeys = {
  all: authStateQueryCacheKeys.worldAccessAll,
  currentUserAdminWorldIds: (userId: string) =>
    [
      ...worldAccessQueryKeys.all,
      "current-user-admin-world-ids",
      userId,
    ] as const,
} as const;
