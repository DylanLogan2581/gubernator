import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const nationsQueryKeys = {
  all: authStateQueryCacheKeys.nationsAll,
  detail: (nationId: string) =>
    [...nationsQueryKeys.all, "detail", nationId] as const,
  list: (worldId: string) =>
    [...nationsQueryKeys.all, "list", worldId] as const,
  relationshipPair: (fromNationId: string, toNationId: string) =>
    [
      ...nationsQueryKeys.all,
      "relationship-pair",
      fromNationId,
      toNationId,
    ] as const,
  relationshipsFromNation: (nationId: string) =>
    [...nationsQueryKeys.all, "relationships-from-nation", nationId] as const,
  relationshipsToNation: (nationId: string) =>
    [...nationsQueryKeys.all, "relationships-to-nation", nationId] as const,
  settlements: (nationId: string) =>
    [...nationsQueryKeys.all, "settlements", nationId] as const,
} as const;
