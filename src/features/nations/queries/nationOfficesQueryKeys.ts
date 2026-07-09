import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const nationOfficesQueryKeys = {
  all: authStateQueryCacheKeys.nationsAll,
  officeTypes: (worldId: string, nationId: string) =>
    [
      ...nationOfficesQueryKeys.all,
      "offices",
      "office-types",
      worldId,
      nationId,
    ] as const,
  officeTypesForSettlements: (worldId: string, nationId: string) =>
    [
      ...nationOfficesQueryKeys.all,
      "offices",
      "office-types",
      "settlement-scope",
      worldId,
      nationId,
    ] as const,
  officeTypesWorldDefaults: (worldId: string) =>
    [
      ...nationOfficesQueryKeys.all,
      "offices",
      "office-types",
      "world-defaults",
      worldId,
    ] as const,
  roster: (nationId: string) =>
    [...nationOfficesQueryKeys.all, "offices", "roster", nationId] as const,
  settlementRoster: (settlementId: string) =>
    [
      ...nationOfficesQueryKeys.all,
      "offices",
      "settlement-roster",
      settlementId,
    ] as const,
} as const;
