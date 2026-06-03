import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const tradeRoutesQueryKeys = {
  all: authStateQueryCacheKeys.tradeAll,
  forSettlement: (settlementId: string) =>
    [...tradeRoutesQueryKeys.all, "for-settlement", settlementId] as const,
} as const;
