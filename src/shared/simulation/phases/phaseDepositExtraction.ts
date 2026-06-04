// Phase: deposit extraction.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { proportionalShare, scaleDeficit } from "../decimalMath.ts";

import type {
  AssignmentClear,
  DepositResourceDelta,
  DepositUpdate,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
  StockpileDelta,
} from "../simulationTypes.ts";

export type PhaseDepositExtractionOutput = {
  readonly assignmentClears: readonly AssignmentClear[];
  readonly depositUpdates: readonly DepositUpdate[];
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
  readonly stockpileDeltas: readonly StockpileDelta[];
};

export function phaseDepositExtraction(
  context: SimulationContext,
): PhaseDepositExtractionOutput {
  const { citizenAssignments, depositTypes, deposits, stockpiles } =
    context.input;

  const depositTypeById = new Map(depositTypes.map((dt) => [dt.id, dt]));

  const stockpileQty = new Map<string, number>();
  const stockpileCap = new Map<string, number>();
  for (const sp of stockpiles) {
    const key = `${sp.settlementId}:${sp.resourceId}`;
    stockpileQty.set(key, sp.quantity);
    stockpileCap.set(key, sp.cap);
  }

  // Collect worker counts and citizen IDs per deposit instance.
  const workerCountByDeposit = new Map<string, number>();
  const workerIdsByDeposit = new Map<string, string[]>();
  for (const assignment of citizenAssignments) {
    if (
      assignment.assignmentType !== "deposit" ||
      assignment.depositInstanceId === null
    ) {
      continue;
    }
    const dId = assignment.depositInstanceId;
    workerCountByDeposit.set(dId, (workerCountByDeposit.get(dId) ?? 0) + 1);
    const existing = workerIdsByDeposit.get(dId);
    if (existing === undefined) {
      workerIdsByDeposit.set(dId, [assignment.citizenId]);
    } else {
      existing.push(assignment.citizenId);
    }
  }

  const allLogs: SimulationLogEntry[] = [];
  const allDeltas: StockpileDelta[] = [];
  const allDepositUpdates: DepositUpdate[] = [];
  const allAssignmentClears: AssignmentClear[] = [];
  const allNotifications: SimulationNotification[] = [];

  for (const deposit of deposits) {
    if (deposit.status !== "active") continue;

    const depositType = depositTypeById.get(deposit.depositTypeId);
    if (depositType === undefined) continue;

    const sid = deposit.settlementId;

    // Cap workers by maxWorkers if set.
    const rawWorkers = workerCountByDeposit.get(deposit.id) ?? 0;
    const workers =
      deposit.maxWorkers !== null
        ? Math.min(rawWorkers, deposit.maxWorkers)
        : rawWorkers;

    if (workers === 0) continue;

    // Input shortfall scale: tightest resource constraint across all worker inputs.
    let inputShortfallScale = 1.0;
    for (const input of depositType.workerInputsJson) {
      const required = workers * input.amountPerWorker;
      const available = stockpileQty.get(`${sid}:${input.resourceId}`) ?? 0;
      const scale = scaleDeficit(required, available);
      if (scale < inputShortfallScale) inputShortfallScale = scale;
    }

    // Consume worker inputs from the settlement stockpile.
    const inputsConsumed: Record<string, number> = {};
    for (const input of depositType.workerInputsJson) {
      const consumed = workers * input.amountPerWorker * inputShortfallScale;
      inputsConsumed[input.resourceId] = consumed;
      const key = `${sid}:${input.resourceId}`;
      allDeltas.push({
        delta: -consumed,
        resourceId: input.resourceId,
        settlementId: sid,
      });
      stockpileQty.set(key, (stockpileQty.get(key) ?? 0) - consumed);
    }

    // Distribute total extraction across deposit resources weighted by remainingQuantity.
    const totalExtraction =
      workers * depositType.outputUnitsPerWorker * inputShortfallScale;
    const weights = deposit.resources.map((r) => r.remainingQuantity);
    const rawShares = proportionalShare(totalExtraction, weights);

    const resourceDeltas: DepositResourceDelta[] = [];
    const extractedByResource: Record<string, number> = {};

    for (let i = 0; i < deposit.resources.length; i++) {
      const res = deposit.resources[i];
      if (res === undefined) continue;
      const rawShare = rawShares[i] ?? 0;

      // Cap by remaining quantity — can't extract more than what's there.
      const cappedByDeposit = Math.min(rawShare, res.remainingQuantity);

      // Throttle by available stockpile space; overflow stays in the deposit.
      const spKey = `${sid}:${res.resourceId}`;
      const currentQty = stockpileQty.get(spKey) ?? 0;
      const cap = stockpileCap.get(spKey) ?? Infinity;
      const spaceAvailable = Math.max(0, cap - currentQty);
      const actualExtracted = Math.min(cappedByDeposit, spaceAvailable);

      extractedByResource[res.resourceId] = actualExtracted;

      if (actualExtracted > 0) {
        resourceDeltas.push({
          delta: -actualExtracted,
          resourceId: res.resourceId,
        });
        allDeltas.push({
          delta: actualExtracted,
          resourceId: res.resourceId,
          settlementId: sid,
        });
        stockpileQty.set(spKey, currentQty + actualExtracted);
      }
    }

    // Deposit depletes when every resource's remaining quantity reaches zero.
    const isDepleted = deposit.resources.every((r) => {
      const extracted = extractedByResource[r.resourceId] ?? 0;
      return r.remainingQuantity - extracted <= 0;
    });

    allDepositUpdates.push({
      depositInstanceId: deposit.id,
      resourceDeltas,
      toStatus: isDepleted ? "depleted" : null,
    });

    allLogs.push({
      category: "deposit.processed",
      payload: {
        depositId: deposit.id,
        extractedByResource,
        inputShortfallScale,
        inputsConsumed,
        settlementId: sid,
        totalExtraction,
        workers,
      },
      phase: "depositExtraction",
    });

    if (isDepleted) {
      for (const citizenId of workerIdsByDeposit.get(deposit.id) ?? []) {
        allAssignmentClears.push({ citizenId, reason: "deposit_depleted" });
      }

      allLogs.push({
        category: "deposit.depleted",
        payload: {
          depositId: deposit.id,
          depositName: deposit.name,
        },
        phase: "depositExtraction",
        settlementId: sid,
      });

      allNotifications.push({
        messageText: `Deposit "${deposit.name}" has been depleted.`,
        notificationType: "deposit.depleted",
        scope: "settlement",
        settlementId: sid,
      });
    }
  }

  return {
    assignmentClears: allAssignmentClears,
    depositUpdates: allDepositUpdates,
    logs: allLogs,
    notifications: allNotifications,
    stockpileDeltas: allDeltas,
  };
}
