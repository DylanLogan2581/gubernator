// Phase: citizen consumption — alive citizens consume Food and Fresh Water;
// deficits drive deterministic NPC starvation; PCs are immune.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { formatStockpileForDisplay } from "../decimalMath.ts";
import { compareById } from "../sortUtils.ts";

import type {
  CitizenDeath,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
  StockpileDelta,
} from "../simulationTypes.ts";

export type PhaseCitizenConsumptionOutput = {
  readonly citizenDeaths: readonly CitizenDeath[];
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
  readonly stockpileDeltas: readonly StockpileDelta[];
};

function formatStarvationDeathDetail({
  foodDeficit,
  foodRequired,
  foodStock,
  settlementName,
  turnNumber,
  waterDeficit,
  waterRequired,
  waterStock,
}: {
  readonly foodDeficit: number;
  readonly foodRequired: number;
  readonly foodStock: number;
  readonly settlementName: string;
  readonly turnNumber: number;
  readonly waterDeficit: number;
  readonly waterRequired: number;
  readonly waterStock: number;
}): string {
  const shortage = foodDeficit >= waterDeficit ? "food" : "fresh water";
  return (
    `Died of starvation on turn ${turnNumber} — ${settlementName} ran out of ${shortage} ` +
    `(had ${formatStockpileForDisplay(foodStock)} food and ${
      formatStockpileForDisplay(waterStock)
    } water for ${formatStockpileForDisplay(foodRequired)} food and ${
      formatStockpileForDisplay(waterRequired)
    } water required).`
  );
}

export function phaseCitizenConsumption(
  context: SimulationContext,
  effectiveSettlementIdByCitizenId: ReadonlyMap<string, string>,
): PhaseCitizenConsumptionOutput {
  const { citizens, populationRules, settlements, systemResourceIds, turnNumber } = context.input;
  const { pendingEventMultipliers } = context.shared;

  const { foodId, freshWaterId } = systemResourceIds;

  // Start from running post-prior-phase totals so managed-population maintenance
  // deductions (phase 7) are visible before citizen food/water is checked.
  const stockpileQty = new Map(context.shared.pendingStockpiles);

  const allDeaths: CitizenDeath[] = [];
  const allLogs: SimulationLogEntry[] = [];
  const allNotifications: SimulationNotification[] = [];
  const allDeltas: StockpileDelta[] = [];

  for (const settlement of settlements) {
    const sid = settlement.id;

    // A soldier consumes at their army's stationed settlement, not their home
    // settlement (#1111) — see effectiveSettlementIdByCitizenId's construction
    // in runSimulation.ts.
    const aliveInSettlement = citizens.filter(
      (c) =>
        c.status === "alive" &&
        (effectiveSettlementIdByCitizenId.get(c.id) ?? c.settlementId) === sid,
    );
    const aliveCount = aliveInSettlement.length;

    if (aliveCount === 0) continue;

    const consumptionMultiplier = pendingEventMultipliers.get(sid)?.consumption ?? 1.0;
    const foodRequired = aliveCount * populationRules.foodConsumptionPerCitizen *
      consumptionMultiplier;
    const waterRequired = aliveCount * populationRules.waterConsumptionPerCitizen *
      consumptionMultiplier;

    const foodStock = stockpileQty.get(`${sid}:${foodId}`) ?? 0;
    const waterStock = stockpileQty.get(`${sid}:${freshWaterId}`) ?? 0;

    const foodDeficit = foodRequired > 0 ? Math.max(0, 1 - foodStock / foodRequired) : 0;
    const waterDeficit = waterRequired > 0 ? Math.max(0, 1 - waterStock / waterRequired) : 0;

    const deficitRatio = Math.max(foodDeficit, waterDeficit);

    // Always deduct consumption, clamped at 0 stock.
    const foodConsumed = Math.min(foodRequired, foodStock);
    const waterConsumed = Math.min(waterRequired, waterStock);

    if (foodConsumed > 0) {
      allDeltas.push({
        delta: -foodConsumed,
        resourceId: foodId,
        settlementId: sid,
      });
    }
    if (waterConsumed > 0) {
      allDeltas.push({
        delta: -waterConsumed,
        resourceId: freshWaterId,
        settlementId: sid,
      });
    }

    allLogs.push({
      category: "citizen.consumed_food_water",
      payload: {
        aliveCount,
        foodConsumed,
        foodRequired,
        foodStock,
        settlementId: sid,
        waterConsumed,
        waterRequired,
        waterStock,
      },
      phase: "citizenConsumption",
    });

    if (deficitRatio > 0) {
      // PCs are filtered before selection; only NPCs can starve.
      const livingNpcs = aliveInSettlement.filter(
        (c) => c.citizenType === "npc",
      );
      const starvationDeaths = Math.floor(
        deficitRatio *
          populationRules.starvationSeverityMultiplier *
          livingNpcs.length,
      );

      if (starvationDeaths > 0) {
        // Deterministic selection: eldest (lowest bornOnTurnNumber) first,
        // then citizenId ascending. null bornOnTurnNumber sorts before any real turn.
        const sorted = livingNpcs.slice().sort((a, b) => {
          const aTurn = a.bornOnTurnNumber ?? -Infinity;
          const bTurn = b.bornOnTurnNumber ?? -Infinity;
          if (aTurn !== bTurn) return aTurn - bTurn;
          return compareById(a, b);
        });

        const toKill = sorted.slice(0, starvationDeaths);
        const deathDetail = formatStarvationDeathDetail({
          foodDeficit,
          foodRequired,
          foodStock,
          settlementName: settlement.name,
          turnNumber,
          waterDeficit,
          waterRequired,
          waterStock,
        });

        for (const citizen of toKill) {
          allDeaths.push({
            category: "starvation",
            citizenId: citizen.id,
            detail: deathDetail,
          });
          allLogs.push({
            category: "citizen.starved",
            citizenId: citizen.id,
            payload: { deathDetail },
            phase: "citizenConsumption",
            settlementId: sid,
          });
        }

        allNotifications.push({
          messageText: `${starvationDeaths} citizen(s) starved in ${settlement.name}.`,
          notificationType: "settlement.starvation_occurred",
          scope: "settlement",
          settlementId: sid,
        });
      }
    }
  }

  return {
    citizenDeaths: allDeaths,
    logs: allLogs,
    notifications: allNotifications,
    stockpileDeltas: allDeltas,
  };
}
