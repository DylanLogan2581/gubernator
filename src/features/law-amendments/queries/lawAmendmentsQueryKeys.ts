import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

// Nested under nationsAll (not a dedicated top-level key), matching
// lawDocumentsQueryKeys -- amendments are document-scoped government config.
export const lawAmendmentsQueryKeys = {
  all: authStateQueryCacheKeys.nationsAll,
  awaitingMyVote: (
    scope: {
      readonly nationId: string | null;
      readonly settlementId: string | null;
    },
    activeCharacterId: string,
  ) =>
    [
      ...lawAmendmentsQueryKeys.all,
      "law-amendments",
      "awaiting-my-vote",
      scope.nationId,
      scope.settlementId,
      activeCharacterId,
    ] as const,
  forDocument: (documentId: string) =>
    [
      ...lawAmendmentsQueryKeys.all,
      "law-amendments",
      "document",
      documentId,
    ] as const,
  votes: (amendmentId: string) =>
    [
      ...lawAmendmentsQueryKeys.all,
      "law-amendments",
      "votes",
      amendmentId,
    ] as const,
} as const;
