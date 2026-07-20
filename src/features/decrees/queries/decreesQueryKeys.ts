import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

// Nested under nationsAll (not a dedicated top-level key), matching
// lawDocumentsQueryKeys -- decrees are the same kind of nation/settlement-
// owned government log.
export const decreesQueryKeys = {
  all: authStateQueryCacheKeys.nationsAll,
  nationList: (nationId: string) =>
    [...decreesQueryKeys.all, "decrees", "nation", nationId] as const,
  nationListPage: (nationId: string, page: number) =>
    [...decreesQueryKeys.nationList(nationId), page] as const,
  settlementList: (settlementId: string) =>
    [...decreesQueryKeys.all, "decrees", "settlement", settlementId] as const,
  settlementListPage: (settlementId: string, page: number) =>
    [...decreesQueryKeys.settlementList(settlementId), page] as const,
} as const;
