// Resource snapshot builder — builds one ResourceSnapshot per (settlement × resource)
// pair that appears in the original stockpiles.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  ResourceSnapshot,
  SimulationContext,
  StockpileDelta,
} from "../simulationTypes.ts";

export type { ResourceSnapshot } from "../simulationTypes.ts";

export type BuildResourceSnapshotsParams = {
  // Positive deltas from production phases (standard jobs, deposits, passive effects, etc.)
  readonly consumptionDeltas: readonly StockpileDelta[];
  // Post-clamp quantities keyed by "settlementId:resourceId"
  readonly pendingStockpiles: ReadonlyMap<string, number>;
  // Positive deltas from production phases (standard jobs, deposits, passive effects, etc.)
  readonly productionDeltas: readonly StockpileDelta[];
  // All deltas from phaseTradeRoutes (positive = trade in, negative = trade out)
  readonly tradeRouteDeltas: readonly StockpileDelta[];
};

export function buildResourceSnapshots(
  context: SimulationContext,
  params: BuildResourceSnapshotsParams,
): readonly ResourceSnapshot[] {
  const { stockpiles, turnNumber } = context.input;
  const {
    consumptionDeltas,
    pendingStockpiles,
    productionDeltas,
    tradeRouteDeltas,
  } = params;

  // Sum deltas by key for each category
  const producedByKey = new Map<string, number>();
  for (const d of productionDeltas) {
    const key = `${d.settlementId}:${d.resourceId}`;
    producedByKey.set(
      key,
      (producedByKey.get(key) ?? 0) + Math.max(0, d.delta),
    );
  }

  const consumedByKey = new Map<string, number>();
  for (const d of consumptionDeltas) {
    const key = `${d.settlementId}:${d.resourceId}`;
    // Store as positive (absolute value of negative delta)
    consumedByKey.set(
      key,
      (consumedByKey.get(key) ?? 0) + Math.abs(Math.min(0, d.delta)),
    );
  }

  const tradeInByKey = new Map<string, number>();
  const tradeOutByKey = new Map<string, number>();
  for (const d of tradeRouteDeltas) {
    const key = `${d.settlementId}:${d.resourceId}`;
    if (d.delta > 0) {
      tradeInByKey.set(key, (tradeInByKey.get(key) ?? 0) + d.delta);
    } else if (d.delta < 0) {
      tradeOutByKey.set(key, (tradeOutByKey.get(key) ?? 0) + Math.abs(d.delta));
    }
  }

  const snapshots: ResourceSnapshot[] = [];

  for (const sp of stockpiles) {
    const key = `${sp.settlementId}:${sp.resourceId}`;
    const quantityBefore = sp.quantity;
    const quantityAfter = pendingStockpiles.get(key) ?? sp.quantity;

    snapshots.push({
      consumed: consumedByKey.get(key) ?? 0,
      produced: producedByKey.get(key) ?? 0,
      quantityAfter,
      quantityBefore,
      resourceId: sp.resourceId,
      settlementId: sp.settlementId,
      tradeIn: tradeInByKey.get(key) ?? 0,
      tradeOut: tradeOutByKey.get(key) ?? 0,
      turnNumber,
    });
  }

  return snapshots;
}
