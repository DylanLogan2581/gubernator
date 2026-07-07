import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

import type { BlueprintsPageParams } from "./buildingsQueries";

export const buildingsQueryKeys = {
  all: authStateQueryCacheKeys.buildingsAll,
  blueprintById: (blueprintId: string) =>
    [...buildingsQueryKeys.all, "blueprint-detail", blueprintId] as const,
  blueprintsByWorld: (worldId: string) =>
    [...buildingsQueryKeys.all, "blueprints-by-world", worldId] as const,
  // Nested under blueprintsByWorld so the existing softDelete/restore/update/
  // create invalidation (which invalidates blueprintsByWorld(worldId) as a
  // prefix) also refetches the paginated config-panel view without any
  // changes there.
  blueprintsPage: (worldId: string, params: BlueprintsPageParams) =>
    [...buildingsQueryKeys.blueprintsByWorld(worldId), "page", params] as const,
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
