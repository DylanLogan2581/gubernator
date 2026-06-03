// Phase: stockpile clamp — final pass that clamps every pending stockpile
// quantity to [0, effectiveStorageCap] after all prior phases.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { clampToRange } from "../decimalMath.ts";

import type {
  SimulationContext,
  SimulationLogEntry,
  StockpileDelta,
} from "../simulationTypes.ts";

export type PhaseStockpileClampOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly stockpileDeltas: readonly StockpileDelta[];
};

/**
 * Clamps every pending stockpile quantity to [0, effectiveStorageCap].
 *
 * @param pendingStockpiles - Mutable map of accumulated quantities keyed by
 *   "settlementId:resourceId". Updated in place with post-clamp values so the
 *   snapshot writer reads the correct final state.
 * @param effectiveStorageCaps - Pre-computed effective caps keyed by
 *   "settlementId:resourceId" (supplied by the loader). Falls back to the base
 *   cap from context.input.stockpiles when a key is absent.
 */
export function phaseStockpileClamp(
  context: SimulationContext,
  pendingStockpiles: Map<string, number>,
  effectiveStorageCaps: ReadonlyMap<string, number>,
): PhaseStockpileClampOutput {
  const { stockpiles } = context.input;

  const baseCaps = new Map<string, number>();
  for (const sp of stockpiles) {
    baseCaps.set(`${sp.settlementId}:${sp.resourceId}`, sp.cap);
  }

  const logs: SimulationLogEntry[] = [];
  const stockpileDeltas: StockpileDelta[] = [];

  for (const [key, pre] of pendingStockpiles) {
    const effectiveCap = effectiveStorageCaps.get(key) ?? baseCaps.get(key);

    if (effectiveCap === undefined) continue;

    const post = clampToRange(pre, 0, effectiveCap);

    if (post === pre) continue;

    const delta = post - pre;
    const colonIndex = key.indexOf(":");
    const settlementId = key.slice(0, colonIndex);
    const resourceId = key.slice(colonIndex + 1);
    const reason: string = pre < 0 ? "negative" : "over_cap";

    logs.push({
      category: "stockpile.clamped",
      payload: {
        delta,
        effectiveCap,
        post,
        pre,
        reason,
        resourceId,
        settlementId,
      },
      phase: "stockpileClamp",
    });

    stockpileDeltas.push({ delta, resourceId, settlementId });

    pendingStockpiles.set(key, post);
  }

  return { logs, stockpileDeltas };
}
