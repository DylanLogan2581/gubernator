import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

// Nested under nationsAll (not a dedicated top-level key), matching
// governmentBodiesQueryKeys -- law documents are the same kind of
// nation/settlement-owned government config.
export const lawDocumentsQueryKeys = {
  all: authStateQueryCacheKeys.nationsAll,
  articles: (documentId: string) =>
    [
      ...lawDocumentsQueryKeys.all,
      "law-documents",
      "articles",
      documentId,
    ] as const,
  nationList: (nationId: string) =>
    [
      ...lawDocumentsQueryKeys.all,
      "law-documents",
      "nation",
      nationId,
    ] as const,
  settlementList: (settlementId: string) =>
    [
      ...lawDocumentsQueryKeys.all,
      "law-documents",
      "settlement",
      settlementId,
    ] as const,
  versions: (documentId: string) =>
    [
      ...lawDocumentsQueryKeys.all,
      "law-documents",
      "versions",
      documentId,
    ] as const,
} as const;
