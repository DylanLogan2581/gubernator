// Phase: national economy — collects tax in kind from settlement production
// for the settlement's nation, crediting the nation's stockpile and debiting
// the settlement's. Runs after trade routes so later consumption phases see
// post-tax stockpiles. Deterministic decimal math, no RNG.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import {
  computeNextFiatConfidence,
  computeResourceBackedConfidence,
  isFiatConfidenceCollapsing,
  isResourceBackedInDefault,
} from "../../economy/index.ts";
import { GOVERNMENT_TAX_EFFICIENCY } from "../../government/index.ts";
import { floorToDatabaseScale } from "../decimalMath.ts";
import { compareById } from "../sortUtils.ts";

import type {
  NationCurrencySnapshot,
  NationCurrencyUpdate,
  NationStockpileDelta,
  NationTurnSnapshot,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
  StockpileDelta,
} from "../simulationTypes.ts";

export type PhaseNationalEconomyOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly nationCurrencySnapshots: readonly NationCurrencySnapshot[];
  readonly nationCurrencyUpdates: readonly NationCurrencyUpdate[];
  readonly nationStockpileDeltas: readonly NationStockpileDelta[];
  readonly nationTurnSnapshots: readonly NationTurnSnapshot[];
  readonly notifications: readonly SimulationNotification[];
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
    nationTurnSnapshots.push({
      nationId,
      taxCollectedByResource,
      tributePaidByResource: {},
      tributeReceivedByResource: {},
    });

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

  // #1094: currency step — fiat confidence drift from this turn's mint/burn
  // ledger activity, and resource-backed default checks. Ordered by currency
  // id for determinism; independent of the tax-collection logic above.
  const notifications: SimulationNotification[] = [];
  const nationCurrencySnapshots: NationCurrencySnapshot[] = [];
  const nationCurrencyUpdates: NationCurrencyUpdate[] = [];

  const ledgerTotalsByCurrency = new Map<string, { burned: number; minted: number }>();
  for (const entry of context.input.nationCurrencyLedgerEntries) {
    if (entry.action !== "mint" && entry.action !== "burn") continue;
    const totals = ledgerTotalsByCurrency.get(entry.currencyId) ?? { burned: 0, minted: 0 };
    if (entry.action === "mint") {
      totals.minted += entry.amount ?? 0;
    } else {
      totals.burned += entry.amount ?? 0;
    }
    ledgerTotalsByCurrency.set(entry.currencyId, totals);
  }

  const sortedCurrencies = [...context.input.nationCurrencies].sort(compareById);
  for (const currency of sortedCurrencies) {
    const { burned, minted } = ledgerTotalsByCurrency.get(currency.id) ?? { burned: 0, minted: 0 };
    let confidence: number;
    let isInDefault = false;

    if (currency.currencyType === "fiat") {
      const moneySupplyStart = currency.moneySupply - (minted - burned);
      confidence = computeNextFiatConfidence({
        burnedThisTurn: burned,
        confidence: currency.confidence,
        mintedThisTurn: minted,
        moneySupplyStart,
      });
      if (isFiatConfidenceCollapsing(confidence)) {
        notifications.push({
          messageText: `Confidence in ${currency.name} is collapsing.`,
          nationId: currency.nationId,
          notificationType: "currency.confidence_collapsing",
          scope: "nation",
        });
      }
    } else {
      const backingRatio = currency.backingRatio ?? 0;
      isInDefault = isResourceBackedInDefault({
        backingRatio,
        moneySupply: currency.moneySupply,
        reserveQuantity: currency.reserveQuantity,
      });
      confidence = computeResourceBackedConfidence({
        backingRatio,
        moneySupply: currency.moneySupply,
        reserveQuantity: currency.reserveQuantity,
      });
      if (isInDefault) {
        logs.push({
          category: "currency_default",
          nationId: currency.nationId,
          payload: {
            backingRatio,
            currencyId: currency.id,
            moneySupply: currency.moneySupply,
            reserveQuantity: currency.reserveQuantity,
          },
          phase: "nationalEconomy",
        });
        notifications.push({
          messageText: `${currency.name} has defaulted — reserves no longer back the money supply.`,
          nationId: currency.nationId,
          notificationType: "currency.default",
          scope: "nation",
        });
      }
    }

    nationCurrencySnapshots.push({
      burned,
      confidence,
      currencyId: currency.id,
      minted,
      moneySupply: currency.moneySupply,
      nationId: currency.nationId,
      reserveQuantity: currency.reserveQuantity,
    });
    nationCurrencyUpdates.push({ confidence, currencyId: currency.id, isInDefault });
  }

  return {
    logs,
    nationCurrencySnapshots,
    nationCurrencyUpdates,
    nationStockpileDeltas: [...nationCredits.values()],
    nationTurnSnapshots,
    notifications,
    stockpileDeltas,
  };
}
