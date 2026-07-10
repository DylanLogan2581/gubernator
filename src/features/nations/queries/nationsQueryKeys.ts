import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const nationsQueryKeys = {
  all: authStateQueryCacheKeys.nationsAll,
  currency: (nationId: string) =>
    [...nationsQueryKeys.all, "currency", nationId] as const,
  currencyLedgerPage: (currencyId: string, page: number) =>
    [
      ...nationsQueryKeys.all,
      "currency-ledger-page",
      currencyId,
      page,
    ] as const,
  currencySnapshots: (currencyId: string) =>
    [...nationsQueryKeys.all, "currency-snapshots", currencyId] as const,
  currencyTreasury: (nationId: string) =>
    [...nationsQueryKeys.all, "currency-treasury", nationId] as const,
  detail: (nationId: string) =>
    [...nationsQueryKeys.all, "detail", nationId] as const,
  discoveries: (worldId: string) =>
    [...nationsQueryKeys.all, "discoveries", worldId] as const,
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
  treaties: (nationId: string) =>
    [...nationsQueryKeys.all, "treaties", nationId] as const,
  treasuryActiveProjects: (nationId: string) =>
    [...nationsQueryKeys.all, "treasury-active-projects", nationId] as const,
  treasuryActiveSubsidies: (nationId: string) =>
    [...nationsQueryKeys.all, "treasury-active-subsidies", nationId] as const,
  treasuryLatestSnapshot: (nationId: string) =>
    [...nationsQueryKeys.all, "treasury-latest-snapshot", nationId] as const,
  treasuryStockpile: (nationId: string) =>
    [...nationsQueryKeys.all, "treasury-stockpile", nationId] as const,
} as const;
