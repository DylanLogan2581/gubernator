import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const buildingsQueryKeys = {
  all: authStateQueryCacheKeys.buildingsAll,
  blueprintById: (blueprintId: string) =>
    [...buildingsQueryKeys.all, "blueprint-detail", blueprintId] as const,
  blueprintsByWorld: (worldId: string) =>
    [...buildingsQueryKeys.all, "blueprints-by-world", worldId] as const,
  constructionProjectsBySettlement: (settlementId: string) =>
    [
      ...buildingsQueryKeys.all,
      "construction-projects-by-settlement",
      settlementId,
    ] as const,
  settlementBuildingById: (buildingId: string) =>
    [
      ...buildingsQueryKeys.all,
      "settlement-building-detail",
      buildingId,
    ] as const,
  settlementBuildingsBySettlement: (settlementId: string) =>
    [
      ...buildingsQueryKeys.all,
      "settlement-buildings-by-settlement",
      settlementId,
    ] as const,
  settlementBuildingsByNations: (nationIds: readonly string[]) =>
    [
      ...buildingsQueryKeys.all,
      "settlement-buildings-by-nations",
      ...nationIds,
    ] as const,
  settlementBuildingsByWorld: (worldId: string) =>
    [
      ...buildingsQueryKeys.all,
      "settlement-buildings-by-world",
      worldId,
    ] as const,
  settlementPopulationCap: (settlementId: string) =>
    [
      ...buildingsQueryKeys.all,
      "settlement-population-cap",
      settlementId,
    ] as const,
  tierById: (tierId: string) =>
    [...buildingsQueryKeys.all, "tier-detail", tierId] as const,
  tiersByBlueprint: (blueprintId: string) =>
    [...buildingsQueryKeys.all, "tiers-by-blueprint", blueprintId] as const,
} as const;
