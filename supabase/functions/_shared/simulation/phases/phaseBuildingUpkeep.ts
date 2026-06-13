// Phase: building upkeep — subtracts upkeep costs from stockpiles; suspends or
// auto-deconstructs buildings that cannot pay; recovers suspended buildings that
// can pay again.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  BuildingStateChange,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
  StockpileDelta,
} from "../simulationTypes.ts";

export type PhaseBuildingUpkeepOutput = {
  readonly buildingStateChanges: readonly BuildingStateChange[];
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
  readonly stockpileDeltas: readonly StockpileDelta[];
};

export function phaseBuildingUpkeep(
  context: SimulationContext,
): PhaseBuildingUpkeepOutput {
  const {
    buildingBlueprints,
    buildingTiers,
    settlementBuildings,
    settlements,
  } = context.input;
  const { pendingEventMultipliers } = context.shared;

  const tierById = new Map(buildingTiers.map((t) => [t.id, t]));
  const blueprintById = new Map(buildingBlueprints.map((b) => [b.id, b]));
  const settlementById = new Map(settlements.map((s) => [s.id, s]));

  // Start from running post-prior-phase totals so phase 1–3 production is visible.
  const stockpileQty = new Map(context.shared.pendingStockpiles);

  const allStateChanges: BuildingStateChange[] = [];
  const allLogs: SimulationLogEntry[] = [];
  const allNotifications: SimulationNotification[] = [];
  const allDeltas: StockpileDelta[] = [];

  for (const building of settlementBuildings) {
    if (building.state !== "active" && building.state !== "suspended") continue;

    const tier = tierById.get(building.currentTierId);
    if (tier === undefined) continue;

    const blueprint = blueprintById.get(tier.buildingBlueprintId);
    if (blueprint === undefined) continue;

    const settlement = settlementById.get(building.settlementId);
    const settlementName = settlement?.name ?? building.settlementId;

    const mults = pendingEventMultipliers.get(building.settlementId);
    const blueprintId = tier.buildingBlueprintId;

    // Apply blueprint-specific multiplier if available, otherwise use global upkeep multiplier
    let upkeepMultiplier = 1.0;
    if (
      typeof blueprintId === "string" &&
      mults !== null &&
      mults !== undefined
    ) {
      const blueprintMult = mults.upkeepByBlueprintId.get(blueprintId);
      if (blueprintMult !== null && blueprintMult !== undefined) {
        upkeepMultiplier = blueprintMult;
      } else if (mults.upkeep !== null && mults.upkeep !== undefined) {
        upkeepMultiplier = mults.upkeep;
      }
    } else if (mults !== null && mults !== undefined && mults.upkeep !== null && mults.upkeep !== undefined) {
      upkeepMultiplier = mults.upkeep;
    }

    // Check whether the stockpile can cover all upkeep costs.
    let canPay = true;
    for (const cost of tier.upkeepCostsJson) {
      const available = stockpileQty.get(`${building.settlementId}:${cost.resourceId}`) ?? 0;
      const adjustedCost = cost.amount * upkeepMultiplier;
      if (available < adjustedCost) {
        canPay = false;
        break;
      }
    }

    if (canPay) {
      // Deduct upkeep from stockpile (adjusted for event multipliers).
      for (const cost of tier.upkeepCostsJson) {
        const adjustedCost = cost.amount * upkeepMultiplier;
        const key = `${building.settlementId}:${cost.resourceId}`;
        allDeltas.push({
          delta: -adjustedCost,
          resourceId: cost.resourceId,
          settlementId: building.settlementId,
        });
        stockpileQty.set(key, (stockpileQty.get(key) ?? 0) - adjustedCost);
      }
      // Recover a suspended building that can now pay its upkeep.
      if (building.state === "suspended") {
        allStateChanges.push({
          missedUpkeepCountDelta: -building.missedUpkeepCount,
          settlementBuildingId: building.id,
          toState: "active",
        });
        allLogs.push({
          category: "building.recovered",
          payload: {
            blueprintId: blueprint.id,
            buildingId: building.id,
          },
          phase: "buildingUpkeep",
          settlementId: building.settlementId,
        });
        allNotifications.push({
          messageText:
            `A suspended building in "${settlementName}" resumed operation after upkeep costs were met.`,
          notificationType: "building.recovered",
          scope: "settlement",
          settlementId: building.settlementId,
        });
      }
    } else {
      // Cannot pay — increment missed upkeep count and check grace period.
      const newMissedCount = building.missedUpkeepCount + 1;

      if (newMissedCount > blueprint.gracePeriodTurns) {
        allStateChanges.push({
          missedUpkeepCountDelta: 1,
          settlementBuildingId: building.id,
          toState: "auto_deconstructed",
        });
        allLogs.push({
          category: "building.auto_deconstructed",
          payload: {
            blueprintId: blueprint.id,
            buildingId: building.id,
            gracePeriodTurns: blueprint.gracePeriodTurns,
            missedUpkeepCount: newMissedCount,
          },
          phase: "buildingUpkeep",
          settlementId: building.settlementId,
        });
        allNotifications.push({
          messageText:
            `A building in "${settlementName}" was auto-deconstructed after missing upkeep too many times.`,
          notificationType: "building.auto_deconstructed",
          scope: "settlement",
          settlementId: building.settlementId,
        });
      } else {
        allStateChanges.push({
          missedUpkeepCountDelta: 1,
          settlementBuildingId: building.id,
          toState: "suspended",
        });
        allLogs.push({
          category: "building.suspended",
          payload: {
            blueprintId: blueprint.id,
            buildingId: building.id,
            missedUpkeepCount: newMissedCount,
          },
          phase: "buildingUpkeep",
          settlementId: building.settlementId,
        });
        allNotifications.push({
          messageText:
            `A building in "${settlementName}" was suspended due to insufficient upkeep resources.`,
          notificationType: "building.suspended",
          scope: "settlement",
          settlementId: building.settlementId,
        });
      }
    }
  }

  return {
    buildingStateChanges: allStateChanges,
    logs: allLogs,
    notifications: allNotifications,
    stockpileDeltas: allDeltas,
  };
}
