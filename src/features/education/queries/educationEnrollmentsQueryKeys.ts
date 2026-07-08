import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const educationEnrollmentsQueryKeys = {
  all: authStateQueryCacheKeys.educationEnrollmentsAll,
  bySchool: (settlementBuildingId: string) =>
    [
      ...educationEnrollmentsQueryKeys.all,
      "by-school",
      settlementBuildingId,
    ] as const,
  bySettlement: (settlementId: string) =>
    [
      ...educationEnrollmentsQueryKeys.all,
      "by-settlement",
      settlementId,
    ] as const,
  summaryBySettlement: (settlementId: string) =>
    [...educationEnrollmentsQueryKeys.all, "summary", settlementId] as const,
} as const;
