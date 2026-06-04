// Phase: trade routes — processes active and paused routes with all-or-nothing
// transfers. Pauses on any shortfall; resumes paused routes that satisfy all
// checks.
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
  const { citizenAssignments, jobs, settlements, stockpiles, tradeRoutes } =
    context.input;

  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const settlementById = new Map(settlements.map((s) => [s.id, s]));

  // Mutable stockpile maps so intra-phase transfers are visible to later routes.
  const stockpileQty = new Map<string, number>();
  const stockpileCap = new Map<string, number>();
  for (const sp of stockpiles) {
    const key = `${sp.settlementId}:${sp.resourceId}`;
    stockpileQty.set(key, sp.quantity);
    stockpileCap.set(key, sp.cap);
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

    const {
      id,
      originSettlementId,
      destinationSettlementId,
      resourceId,
      quantityPerTransition,
      status,
    } = route;

    const wasPaused = status === "paused";
    const originName =
      settlementById.get(originSettlementId)?.name ?? originSettlementId;
    const destinationName =
      settlementById.get(destinationSettlementId)?.name ??
      destinationSettlementId;

    const pause = (pauseReason: string): void => {
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
          quantityPerTransition,
          resourceId,
          tradeRouteId: id,
        },
        phase: "tradeRoutes",
        settlementId: originSettlementId,
      });
      allNotifications.push({
        messageText: `Trade route from "${originName}" to "${destinationName}" paused: ${pauseReason}.`,
        notificationType: "trade_route.paused",
        scope: "settlement",
        settlementId: originSettlementId,
      });
    };

    // Check trader capacity at origin.
    const originCapacity = traderCapacity.get(`${id}:origin`) ?? 0;
    if (originCapacity < quantityPerTransition) {
      pause("insufficient_trader_origin");
      continue;
    }

    // Check trader capacity at destination.
    const destCapacity = traderCapacity.get(`${id}:destination`) ?? 0;
    if (destCapacity < quantityPerTransition) {
      pause("insufficient_trader_destination");
      continue;
    }

    // Check origin stock.
    const originKey = `${originSettlementId}:${resourceId}`;
    const originQty = stockpileQty.get(originKey) ?? 0;
    if (originQty < quantityPerTransition) {
      pause("insufficient_origin_stock");
      continue;
    }

    // Check destination space using current (post-phase-4) storage cap.
    const destKey = `${destinationSettlementId}:${resourceId}`;
    const destQty = stockpileQty.get(destKey) ?? 0;
    const destCap = stockpileCap.get(destKey) ?? 0;
    if (destCap - destQty < quantityPerTransition) {
      pause("insufficient_destination_space");
      continue;
    }

    // All checks passed — perform all-or-nothing transfer.
    allDeltas.push({
      delta: -quantityPerTransition,
      resourceId,
      settlementId: originSettlementId,
    });
    allDeltas.push({
      delta: quantityPerTransition,
      resourceId,
      settlementId: destinationSettlementId,
    });
    stockpileQty.set(originKey, originQty - quantityPerTransition);
    stockpileQty.set(destKey, destQty + quantityPerTransition);

    allOutcomes.push({
      delivered: true,
      pauseReason: null,
      quantityTransferred: quantityPerTransition,
      tradeRouteId: id,
    });

    if (wasPaused) {
      allLogs.push({
        category: "trade_route.resumed",
        payload: {
          destinationSettlementId,
          quantityTransferred: quantityPerTransition,
          resourceId,
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
          quantityTransferred: quantityPerTransition,
          resourceId,
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
