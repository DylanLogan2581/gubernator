// Phase: trade routes — processes active and paused routes with all-or-nothing
// transfers across all legs. Pauses on any shortfall; resumes paused routes
// that satisfy all checks.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
  StockpileDelta,
  TradeRouteOutcome,
} from "../simulationTypes.ts";

export type PhaseTradeRoutesOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
  readonly stockpileDeltas: readonly StockpileDelta[];
  readonly tradeRouteOutcomes: readonly TradeRouteOutcome[];
};

export function phaseTradeRoutes(
  context: SimulationContext,
): PhaseTradeRoutesOutput {
  const { citizenAssignments, jobs, settlements, stockpiles, tradeRoutes } = context.input;

  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const settlementById = new Map(settlements.map((s) => [s.id, s]));

  // Start quantities from running post-prior-phase totals; caps are static.
  const stockpileQty = new Map(context.shared.pendingStockpiles);
  const stockpileCap = new Map<string, number>();
  for (const sp of stockpiles) {
    stockpileCap.set(`${sp.settlementId}:${sp.resourceId}`, sp.cap);
  }

  // Sum trader capacity per route end: key = `${routeId}:${end}`.
  const traderCapacity = new Map<string, number>();
  for (const assignment of citizenAssignments) {
    if (
      assignment.assignmentType !== "trade_route" ||
      assignment.tradeRouteId === null ||
      assignment.tradeRouteEnd === null ||
      assignment.jobId === null
    ) {
      continue;
    }
    const job = jobById.get(assignment.jobId);
    if (job === undefined || job.traderCapacityPerWorker === null) continue;
    const key = `${assignment.tradeRouteId}:${assignment.tradeRouteEnd}`;
    traderCapacity.set(
      key,
      (traderCapacity.get(key) ?? 0) + job.traderCapacityPerWorker,
    );
  }

  const allLogs: SimulationLogEntry[] = [];
  const allNotifications: SimulationNotification[] = [];
  const allDeltas: StockpileDelta[] = [];
  const allOutcomes: TradeRouteOutcome[] = [];

  for (const route of tradeRoutes) {
    if (route.status !== "active" && route.status !== "paused") continue;

    const { id, originSettlementId, destinationSettlementId, legs, status } = route;

    const wasPaused = status === "paused";
    const originName = settlementById.get(originSettlementId)?.name ?? originSettlementId;
    const destinationName = settlementById.get(destinationSettlementId)?.name ??
      destinationSettlementId;

    // Total quantity across all legs for trader capacity checks.
    const totalQty = legs.reduce(
      (sum, leg) => sum + leg.quantityPerTransition,
      0,
    );

    const pause = (pauseReason: string, previouslyPaused: boolean): void => {
      allOutcomes.push({
        delivered: false,
        pauseReason,
        quantityTransferred: 0,
        tradeRouteId: id,
      });
      allLogs.push({
        category: "trade_route.paused",
        payload: {
          destinationSettlementId,
          pauseReason,
          tradeRouteId: id,
        },
        phase: "tradeRoutes",
        settlementId: originSettlementId,
      });
      if (!previouslyPaused) {
        allNotifications.push({
          messageText:
            `Trade route from "${originName}" to "${destinationName}" paused: ${pauseReason}.`,
          notificationType: "trade_route.paused",
          scope: "settlement",
          settlementId: originSettlementId,
        });
      }
    };

    // Check trader capacity at origin.
    const originCapacity = traderCapacity.get(`${id}:origin`) ?? 0;
    if (originCapacity < totalQty) {
      pause("insufficient_trader_origin", wasPaused);
      continue;
    }

    // Check trader capacity at destination.
    const destCapacity = traderCapacity.get(`${id}:destination`) ?? 0;
    if (destCapacity < totalQty) {
      pause("insufficient_trader_destination", wasPaused);
      continue;
    }

    // Check every leg can be satisfied before committing any transfer.
    let pauseReason: string | null = null;
    for (const leg of legs) {
      if (leg.direction === "send") {
        // Send: origin → destination
        const originKey = `${originSettlementId}:${leg.resourceId}`;
        const originQty = stockpileQty.get(originKey) ?? 0;
        if (originQty < leg.quantityPerTransition) {
          pauseReason = "insufficient_origin_stock";
          break;
        }
        const destKey = `${destinationSettlementId}:${leg.resourceId}`;
        const destQty = stockpileQty.get(destKey) ?? 0;
        const destCap = stockpileCap.get(destKey) ?? 0;
        if (destCap - destQty < leg.quantityPerTransition) {
          pauseReason = "insufficient_destination_space";
          break;
        }
      } else {
        // Receive: destination → origin
        const destKey = `${destinationSettlementId}:${leg.resourceId}`;
        const destQty = stockpileQty.get(destKey) ?? 0;
        if (destQty < leg.quantityPerTransition) {
          pauseReason = "insufficient_destination_stock";
          break;
        }
        const originKey = `${originSettlementId}:${leg.resourceId}`;
        const originQty = stockpileQty.get(originKey) ?? 0;
        const originCap = stockpileCap.get(originKey) ?? 0;
        if (originCap - originQty < leg.quantityPerTransition) {
          pauseReason = "insufficient_origin_space";
          break;
        }
      }
    }

    if (pauseReason !== null) {
      pause(pauseReason, wasPaused);
      continue;
    }

    // All checks passed — perform all-or-nothing transfers.
    let totalTransferred = 0;
    for (const leg of legs) {
      totalTransferred += leg.quantityPerTransition;
      if (leg.direction === "send") {
        const originKey = `${originSettlementId}:${leg.resourceId}`;
        const destKey = `${destinationSettlementId}:${leg.resourceId}`;
        allDeltas.push({
          delta: -leg.quantityPerTransition,
          resourceId: leg.resourceId,
          settlementId: originSettlementId,
        });
        allDeltas.push({
          delta: leg.quantityPerTransition,
          resourceId: leg.resourceId,
          settlementId: destinationSettlementId,
        });
        stockpileQty.set(
          originKey,
          (stockpileQty.get(originKey) ?? 0) - leg.quantityPerTransition,
        );
        stockpileQty.set(
          destKey,
          (stockpileQty.get(destKey) ?? 0) + leg.quantityPerTransition,
        );
      } else {
        const destKey = `${destinationSettlementId}:${leg.resourceId}`;
        const originKey = `${originSettlementId}:${leg.resourceId}`;
        allDeltas.push({
          delta: -leg.quantityPerTransition,
          resourceId: leg.resourceId,
          settlementId: destinationSettlementId,
        });
        allDeltas.push({
          delta: leg.quantityPerTransition,
          resourceId: leg.resourceId,
          settlementId: originSettlementId,
        });
        stockpileQty.set(
          destKey,
          (stockpileQty.get(destKey) ?? 0) - leg.quantityPerTransition,
        );
        stockpileQty.set(
          originKey,
          (stockpileQty.get(originKey) ?? 0) + leg.quantityPerTransition,
        );
      }
    }

    allOutcomes.push({
      delivered: true,
      pauseReason: null,
      quantityTransferred: totalTransferred,
      tradeRouteId: id,
    });

    if (wasPaused) {
      allLogs.push({
        category: "trade_route.resumed",
        payload: {
          destinationSettlementId,
          quantityTransferred: totalTransferred,
          tradeRouteId: id,
        },
        phase: "tradeRoutes",
        settlementId: originSettlementId,
      });
      allNotifications.push({
        messageText: `Trade route from "${originName}" to "${destinationName}" has resumed.`,
        notificationType: "trade_route.resumed",
        scope: "settlement",
        settlementId: originSettlementId,
      });
    } else {
      allLogs.push({
        category: "trade_route.delivered",
        payload: {
          destinationSettlementId,
          originSettlementId,
          quantityTransferred: totalTransferred,
          tradeRouteId: id,
        },
        phase: "tradeRoutes",
      });
    }
  }

  return {
    logs: allLogs,
    notifications: allNotifications,
    stockpileDeltas: allDeltas,
    tradeRouteOutcomes: allOutcomes,
  };
}
