// Phase: resource decay — applies configured decay rates to stockpiles
// near the end of turn transition, after consumption and stockpile clamp,
// so resources are usable before decaying.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type { SimulationLogEntry, StockpileDelta } from "../simulationTypes.ts";

export type PhaseResourceDecayOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly stockpileDeltas: readonly StockpileDelta[];
};

/**
 * Applies resource decay rates to all pending stockpiles.
 *
 * @param context - Simulation context with input state containing resources
 * @param pendingStockpiles - Mutable map of accumulated quantities keyed by
 *   "settlementId:resourceId". Updated in place with post-decay values.
 * @param resourcesByWorldId - Resources indexed by resourceId for quick lookup
 *   of decay rates.
 * @param stockpileKeyIndex - Structured (settlementId, resourceId) pairs indexed
 *   by "settlementId:resourceId" for reading structured fields.
 */
export function phaseResourceDecay(
  pendingStockpiles: Map<string, number>,
  resourcesByWorldId: ReadonlyMap<string, { readonly decayRate: number }>,
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
    if (resource === undefined || resource.decayRate === 0) continue;

    const { settlementId, resourceId } = meta;

    // Calculate decay amount: floor(stockpile * decay_rate / 100)
    // Ensures non-negative pre-decay values produce non-negative deltas
    const decayAmount = Math.floor((pre * resource.decayRate) / 100);
    if (decayAmount === 0) continue;

    const delta = -decayAmount;
    const post = pre + delta;

    logs.push({
      category: "stockpile.decayed",
      payload: {
        decayRate: resource.decayRate,
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
