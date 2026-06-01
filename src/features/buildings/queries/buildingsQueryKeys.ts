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
  tierById: (tierId: string) =>
    [...buildingsQueryKeys.all, "tier-detail", tierId] as const,
  tiersByBlueprint: (blueprintId: string) =>
    [...buildingsQueryKeys.all, "tiers-by-blueprint", blueprintId] as const,
} as const;
