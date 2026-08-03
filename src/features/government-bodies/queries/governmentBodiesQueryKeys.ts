import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

// Nested under nationsAll (not a dedicated top-level key), matching
// office_types' nationOfficesQueryKeys -- government_bodies is the same kind
// of nation/settlement-owned government config.
export const governmentBodiesQueryKeys = {
  all: authStateQueryCacheKeys.nationsAll,
  nationList: (nationId: string) =>
    [
      ...governmentBodiesQueryKeys.all,
      "government-bodies",
      "nation",
      nationId,
    ] as const,
  nationResolverContext: (nationId: string) =>
    [
      ...governmentBodiesQueryKeys.all,
      "government-bodies",
      "nation-resolver-context",
      nationId,
    ] as const,
  settlementList: (settlementId: string) =>
    [
      ...governmentBodiesQueryKeys.all,
      "government-bodies",
      "settlement",
      settlementId,
    ] as const,
  settlementResolverContext: (settlementId: string) =>
    [
      ...governmentBodiesQueryKeys.all,
      "government-bodies",
      "settlement-resolver-context",
      settlementId,
    ] as const,
} as const;
