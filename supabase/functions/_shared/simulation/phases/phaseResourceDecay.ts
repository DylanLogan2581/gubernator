// Phase: resource decay — applies configured growth/decay to stockpiles
// near the end of turn transition, after consumption and stockpile clamp,
// so resources are usable before growing or decaying.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { clampToRange } from "../decimalMath.ts";

import type { SimulationLogEntry, StockpileDelta } from "../simulationTypes.ts";

export type ResourceChangeMode = "percent" | "flat";

export type PhaseResourceDecayOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly stockpileDeltas: readonly StockpileDelta[];
};

/**
 * Applies each resource's configured per-turn change to all pending
 * stockpiles, then clamps the result to [0, effective storage cap].
 *
 * @param pendingStockpiles - Mutable map of accumulated quantities keyed by
 *   "settlementId:resourceId". Updated in place with post-change values.
 * @param resourcesByWorldId - Resources indexed by resourceId for quick
 *   lookup of change mode/amount.
 * @param effectiveStorageCaps - Effective storage caps (base cap + active
 *   resource_storage_increase effects) keyed by "settlementId:resourceId",
 *   used to clamp growth. A missing entry skips clamping for that key.
 * @param stockpileKeyIndex - Structured (settlementId, resourceId) pairs indexed
 *   by "settlementId:resourceId" for reading structured fields.
 */
export function phaseResourceDecay(
  pendingStockpiles: Map<string, number>,
  resourcesByWorldId: ReadonlyMap<
    string,
    { readonly changeMode: ResourceChangeMode; readonly changeAmount: number }
  >,
  effectiveStorageCaps: ReadonlyMap<string, number>,
  stockpileKeyIndex: ReadonlyMap<
    string,
    { readonly settlementId: string; readonly resourceId: string }
  >,
): PhaseResourceDecayOutput {
  const logs: SimulationLogEntry[] = [];
  const stockpileDeltas: StockpileDelta[] = [];

  for (const [key, pre] of pendingStockpiles) {
    const meta = stockpileKeyIndex.get(key);
    if (meta === undefined) continue;

    const resource = resourcesByWorldId.get(meta.resourceId);
    if (resource === undefined || resource.changeAmount === 0) continue;

    const { settlementId, resourceId } = meta;
    const { changeMode, changeAmount } = resource;

    // Percent mode floors the magnitude of the change toward zero (matching
    // the original decay-only arithmetic); flat mode applies the configured
    // quantity directly.
    const rawDelta = changeMode === "percent"
      ? Math.sign(changeAmount) * Math.floor((pre * Math.abs(changeAmount)) / 100)
      : changeAmount;
    if (rawDelta === 0) continue;

    const cap = effectiveStorageCaps.get(key);
    const uncappedPost = pre + rawDelta;
    const post = cap === undefined ? uncappedPost : clampToRange(uncappedPost, 0, cap);
    const delta = post - pre;
    if (delta === 0) continue;

    logs.push({
      category: "stockpile.changed",
      payload: {
        changeAmount,
        changeMode,
        delta,
        post,
        pre,
        resourceId,
        settlementId,
      },
      phase: "resourceDecay",
    });

    stockpileDeltas.push({ delta, resourceId, settlementId });
    pendingStockpiles.set(key, post);
  }

  return { logs, stockpileDeltas };
}
