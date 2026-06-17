import type { EventScopeType } from "../types/eventTypes";

export type EffectImpactCategory =
  | "settlements"
  | "buildings"
  | "deposits"
  | "populations";

/** Subset of effect fields needed to resolve impact counts. */
export type EffectImpactInput = {
  readonly effectType: string;
  readonly settlementBuildingId?: string | null;
  readonly settlementBuildingIds?: readonly string[];
  readonly depositInstanceId?: string | null;
  readonly depositInstanceIds?: readonly string[];
  readonly managedPopulationInstanceId?: string | null;
  readonly managedPopulationMode?: "all" | "type" | "instance";
};

export type EffectImpact = {
  readonly category: EffectImpactCategory;
  readonly count: number;
};

type SettlementRef = {
  readonly id: string;
  readonly nationId: string;
};

/**
 * Count settlements that fall within the given scope.
 *
 * - world  → all settlements
 * - settlement → selectedIds.length (the explicitly chosen settlements)
 * - nation → settlements whose nationId is in selectedIds
 */
export function resolveSettlementCount(
  scopeType: EventScopeType,
  selectedIds: readonly string[],
  settlements: readonly SettlementRef[],
): number {
  if (scopeType === "world") return settlements.length;
  if (scopeType === "settlement") return selectedIds.length;
  if (scopeType === "nation") {
    const nationSet = new Set(selectedIds);
    return settlements.filter((s) => nationSet.has(s.nationId)).length;
  }
  return 0;
}

/**
 * Compute the resolved target count for a single effect.
 *
 * Returns null for unknown effect types (caller can skip those).
 * Returns { category, count } where count === 0 means the effect will no-op.
 */
export function computeEffectImpact(
  effect: EffectImpactInput,
  scopeType: EventScopeType,
  selectedIds: readonly string[],
  settlements: readonly SettlementRef[],
): EffectImpact | null {
  const scopeCount = resolveSettlementCount(
    scopeType,
    selectedIds,
    settlements,
  );

  switch (effect.effectType) {
    case "population_boost":
    case "population_loss":
    case "resource_grant":
    case "resource_drain":
    case "modify_resource":
    case "consumption_multiplier":
    case "production_multiplier":
    case "upkeep_multiplier":
    case "deposit_discovered":
      return { category: "settlements", count: scopeCount };

    case "building_destroyed": {
      const ids = effect.settlementBuildingIds;
      if (ids !== undefined && ids.length > 0) {
        return { category: "buildings", count: ids.length };
      }
      return {
        category: "buildings",
        count:
          effect.settlementBuildingId !== null &&
          effect.settlementBuildingId !== undefined
            ? 1
            : 0,
      };
    }

    case "deposit_destroyed": {
      const ids = effect.depositInstanceIds;
      if (ids !== undefined && ids.length > 0) {
        return { category: "deposits", count: ids.length };
      }
      return {
        category: "deposits",
        count:
          effect.depositInstanceId !== null &&
          effect.depositInstanceId !== undefined
            ? 1
            : 0,
      };
    }

    case "managed_population_change": {
      // "all" or "type" modes affect every matching population in scope settlements
      if (
        effect.managedPopulationMode === "all" ||
        effect.managedPopulationMode === "type"
      ) {
        return { category: "populations", count: scopeCount };
      }
      // instance mode or unset: single explicit instance (or 0 if none selected)
      return {
        category: "populations",
        count:
          effect.managedPopulationInstanceId !== null &&
          effect.managedPopulationInstanceId !== undefined
            ? 1
            : 0,
      };
    }

    default:
      return null;
  }
}
