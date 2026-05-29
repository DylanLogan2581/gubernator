import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const settlementsQueryKeys = {
  all: authStateQueryCacheKeys.settlementsAll,
  detail: (settlementId: string) =>
    [...settlementsQueryKeys.all, "detail", settlementId] as const,
} as const;
