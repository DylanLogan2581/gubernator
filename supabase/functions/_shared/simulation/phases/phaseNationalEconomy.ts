// Phase: national economy — collects tax in kind from settlement production
// for the settlement's nation, crediting the nation's stockpile and debiting
// the settlement's. Runs after trade routes so later consumption phases see
// post-tax stockpiles. Deterministic decimal math, no RNG.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { GOVERNMENT_TAX_EFFICIENCY } from "../../government/index.ts";
import { floorToDatabaseScale } from "../decimalMath.ts";

import type {
  NationStockpileDelta,
  NationTurnSnapshot,
  SimulationContext,
  SimulationLogEntry,
  StockpileDelta,
} from "../simulationTypes.ts";

export type PhaseNationalEconomyOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly nationStockpileDeltas: readonly NationStockpileDelta[];
  readonly nationTurnSnapshots: readonly NationTurnSnapshot[];
  readonly stockpileDeltas: readonly StockpileDelta[];
};

type ProductionEntry = {
  readonly amount: number;
  readonly resourceId: string;
  readonly settlementId: string;
};

/**
 * Taxes settlement production for the settlement's nation, in kind.
 *
 * @param context - Simulation context; reads settlements/nations and the
 *   running pendingStockpiles map (post-trade-route quantities) to cap tax
 *   at what is actually available.
 * @param productionDeltas - Gross production deltas this transition (jobs +
 *   deposits outputs only; negative entries are ignored defensively).
 */
export function phaseNationalEconomy(
  context: SimulationContext,
  productionDeltas: readonly StockpileDelta[],
): PhaseNationalEconomyOutput {
  const { nations, settlements } = context.input;
  const { pendingStockpiles } = context.shared;

  const nationById = new Map(nations.map((n) => [n.id, n]));
  const settlementById = new Map(settlements.map((s) => [s.id, s]));

  // Sum gross production per (settlementId, resourceId) — multiple production
  // phases (jobs, deposits) may contribute to the same resource.
  const productionByKey = new Map<string, ProductionEntry>();
  for (const d of productionDeltas) {
    if (d.delta <= 0) continue;
    const key = `${d.settlementId}:${d.resourceId}`;
    const existing = productionByKey.get(key);
    productionByKey.set(key, {
      amount: (existing?.amount ?? 0) + d.delta,
      resourceId: d.resourceId,
      settlementId: d.settlementId,
    });
  }

  const logs: SimulationLogEntry[] = [];
  const stockpileDeltas: StockpileDelta[] = [];
  const nationCredits = new Map<string, NationStockpileDelta>();
  const nationTotalsByResource = new Map<string, Map<string, number>>();
  const nationBreakdown = new Map<
    string,
    Array<{ readonly amount: number; readonly resourceId: string; readonly settlementId: string }>
  >();

  for (const { amount: production, resourceId, settlementId } of productionByKey.values()) {
    const settlement = settlementById.get(settlementId);
    if (settlement?.nationId === undefined) continue;
    const nation = nationById.get(settlement.nationId);
    if (nation === undefined || nation.taxRate <= 0) continue;

    const efficiency = GOVERNMENT_TAX_EFFICIENCY[nation.governmentType];
    const computedTax = floorToDatabaseScale(production * nation.taxRate * efficiency);
    if (computedTax <= 0) continue;

    const stockpileKey = `${settlementId}:${resourceId}`;
    const available = Math.max(0, pendingStockpiles.get(stockpileKey) ?? 0);
    const taxAmount = Math.min(computedTax, available);
    if (taxAmount <= 0) continue;

    stockpileDeltas.push({ delta: -taxAmount, resourceId, settlementId });

    const nationResourceKey = `${nation.id}:${resourceId}`;
    const existingCredit = nationCredits.get(nationResourceKey);
    nationCredits.set(nationResourceKey, {
      delta: (existingCredit?.delta ?? 0) + taxAmount,
      nationId: nation.id,
      resourceId,
    });

    let totalsByResource = nationTotalsByResource.get(nation.id);
    if (totalsByResource === undefined) {
      totalsByResource = new Map();
      nationTotalsByResource.set(nation.id, totalsByResource);
    }
    totalsByResource.set(resourceId, (totalsByResource.get(resourceId) ?? 0) + taxAmount);

    let breakdown = nationBreakdown.get(nation.id);
    if (breakdown === undefined) {
      breakdown = [];
      nationBreakdown.set(nation.id, breakdown);
    }
    breakdown.push({ amount: taxAmount, resourceId, settlementId });
  }

  const nationTurnSnapshots: NationTurnSnapshot[] = [];
  for (const [nationId, totalsByResource] of nationTotalsByResource) {
    const taxCollectedByResource: Record<string, number> = {};
    for (const [resourceId, amount] of totalsByResource) {
      taxCollectedByResource[resourceId] = amount;
    }
    nationTurnSnapshots.push({ nationId, taxCollectedByResource });

    logs.push({
      category: "economy",
      nationId,
      payload: {
        bySettlement: nationBreakdown.get(nationId) ?? [],
        totalsByResource: taxCollectedByResource,
      },
      phase: "nationalEconomy",
    });
  }

  return {
    logs,
    nationStockpileDeltas: [...nationCredits.values()],
    nationTurnSnapshots,
    stockpileDeltas,
  };
}
