import type { EventDurationType, EventScopeType } from "../types/eventTypes";

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
  readonly depositDestroyedMode?: "instance" | "type";
  readonly matchingDepositCount?: number;
  readonly managedPopulationInstanceId?: string | null;
  readonly managedPopulationMode?: "all" | "type" | "instance";
  readonly buildingBlueprintMode?: "all" | "select" | "instance";
  readonly buildingInstanceIds?: readonly string[];
};

export type EffectImpact = {
  readonly category: EffectImpactCategory;
  readonly count: number;
};

export type SettlementRef = {
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
    case "deposit_discovered":
      return { category: "settlements", count: scopeCount };

    case "upkeep_multiplier": {
      if (effect.buildingBlueprintMode === "instance") {
        return {
          category: "buildings",
          count: effect.buildingInstanceIds?.length ?? 0,
        };
      }
      return { category: "settlements", count: scopeCount };
    }

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
      if (effect.depositDestroyedMode === "type") {
        // Real-time count of currently matching deposits in scope, supplied
        // by the caller (resolved from live deposit data, not scope size).
        return {
          category: "deposits",
          count: effect.matchingDepositCount ?? 0,
        };
      }
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

// Effects that fire exactly once, on the event's first in-effect turn — the
// engine marks their targets destroyed/removed, so re-applying them on later
// turns of a sustained event is a no-op (nothing left to destroy).
const ONE_TIME_EFFECT_TYPES = new Set<string>([
  "building_destroyed",
  "deposit_destroyed",
  "deposit_discovered",
]);

// Effects whose value is a rate rather than an absolute amount, so it must
// never be summed across turns (a sustained event re-applies the full rate
// every turn — it does not compound).
const RATE_EFFECT_TYPES = new Set<string>([
  "consumption_multiplier",
  "production_multiplier",
  "upkeep_multiplier",
]);

export type ForecastEffectKind =
  | "one_time"
  | "repeating_flat"
  | "repeating_rate";

/** Subset of effect fields needed to classify and size a forecast row. */
export type ForecastEffectInput = EffectImpactInput & {
  readonly isPercent: boolean;
  readonly amountValue: number | null;
};

export type ForecastEffectTurnEntry = {
  readonly effectIndex: number;
  readonly kind: ForecastEffectKind;
  /** False only for a one-time effect on a turn after its single firing. */
  readonly appliesThisTurn: boolean;
  /** amountValue × resolved target count for this turn; null for rate/one-time effects. */
  readonly perTurnAmount: number | null;
  readonly targetCount: number | null;
};

export type ForecastTurnRow = {
  readonly turnNumber: number;
  readonly turnOffset: number;
  readonly entries: readonly ForecastEffectTurnEntry[];
};

export type ForecastEffectTotal = {
  readonly effectIndex: number;
  readonly kind: ForecastEffectKind;
  readonly targetCount: number | null;
  /** Sum across all turns for flat effects; the one-time count for one_time; null for rates. */
  readonly grandTotal: number | null;
};

export type ForecastTimeline = {
  readonly turns: readonly ForecastTurnRow[];
  readonly totals: readonly ForecastEffectTotal[];
};

/**
 * Computes a per-turn forecast for an event's effects: which turns each
 * effect fires on, its resolved per-turn amount, and grand totals.
 *
 * Flat (non-percent, non-multiplier) effects re-apply their full amount every
 * turn of a sustained event (decided semantics: "sustained events re-apply
 * the full effect EVERY turn"), so their grand total is perTurnAmount × turns.
 * Rate effects (multipliers, or any effect flagged isPercent) are shown as a
 * per-turn rate only — this function never simulates compounding absolutes.
 * One-time effects (destroy/discover) only ever apply on the first turn.
 */
export function computeForecastTimeline(
  effects: readonly ForecastEffectInput[],
  scopeType: EventScopeType,
  selectedIds: readonly string[],
  settlements: readonly SettlementRef[],
  durationType: EventDurationType,
  durationTransitions: number | null,
  activationTurn: number,
): ForecastTimeline {
  const turnsCount =
    durationType === "sustained" ? Math.max(1, durationTransitions ?? 1) : 1;

  const effectMeta = effects.map((effect, effectIndex) => {
    const impact = computeEffectImpact(
      effect,
      scopeType,
      selectedIds,
      settlements,
    );
    const targetCount = impact?.count ?? null;
    const isOneTime = ONE_TIME_EFFECT_TYPES.has(effect.effectType);
    const isRate = RATE_EFFECT_TYPES.has(effect.effectType) || effect.isPercent;
    const kind: ForecastEffectKind = isOneTime
      ? "one_time"
      : isRate
        ? "repeating_rate"
        : "repeating_flat";
    const perTurnAmount =
      kind === "repeating_flat" &&
      effect.amountValue !== null &&
      targetCount !== null
        ? effect.amountValue * targetCount
        : null;

    return { effectIndex, kind, targetCount, perTurnAmount };
  });

  const turns: ForecastTurnRow[] = [];
  for (let turnOffset = 0; turnOffset < turnsCount; turnOffset++) {
    const entries: ForecastEffectTurnEntry[] = effectMeta.map((meta) => ({
      effectIndex: meta.effectIndex,
      kind: meta.kind,
      appliesThisTurn: meta.kind === "one_time" ? turnOffset === 0 : true,
      perTurnAmount: meta.kind === "one_time" ? null : meta.perTurnAmount,
      targetCount: meta.targetCount,
    }));
    turns.push({
      turnNumber: activationTurn + turnOffset + 1,
      turnOffset,
      entries,
    });
  }

  const totals: ForecastEffectTotal[] = effectMeta.map((meta) => ({
    effectIndex: meta.effectIndex,
    kind: meta.kind,
    targetCount: meta.targetCount,
    grandTotal:
      meta.kind === "repeating_flat" && meta.perTurnAmount !== null
        ? meta.perTurnAmount * turnsCount
        : meta.kind === "one_time"
          ? meta.targetCount
          : null,
  }));

  return { turns, totals };
}
