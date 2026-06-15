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

export function phaseCitizenConsumption(
  context: SimulationContext,
): PhaseCitizenConsumptionOutput {
  const { citizens, populationRules, settlements, systemResourceIds } = context.input;
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

    const aliveInSettlement = citizens.filter(
      (c) => c.status === "alive" && c.settlementId === sid,
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
        const deathDetail = `food: ${formatStockpileForDisplay(foodStock)}/${
          formatStockpileForDisplay(foodRequired)
        }, water: ${formatStockpileForDisplay(waterStock)}/${
          formatStockpileForDisplay(waterRequired)
        }`;

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
