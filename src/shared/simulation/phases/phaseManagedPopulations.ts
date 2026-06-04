// Phase: managed populations — maintenance consumption, husbandry coverage,
// growth/decline, culling, and extinction.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { scaleDeficit } from "../decimalMath.ts";

import type {
  AssignmentClear,
  ManagedPopulationUpdate,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
  StockpileDelta,
} from "../simulationTypes.ts";

export type PhaseManagedPopulationsOutput = {
  readonly assignmentClears: readonly AssignmentClear[];
  readonly logs: readonly SimulationLogEntry[];
  readonly managedPopulationUpdates: readonly ManagedPopulationUpdate[];
  readonly notifications: readonly SimulationNotification[];
  readonly stockpileDeltas: readonly StockpileDelta[];
};

export function phaseManagedPopulations(
  context: SimulationContext,
): PhaseManagedPopulationsOutput {
  const {
    citizenAssignments,
    managedPopulationTypes,
    managedPopulations,
    stockpiles,
  } = context.input;

  const popTypeById = new Map(managedPopulationTypes.map((t) => [t.id, t]));

  const stockpileQty = new Map<string, number>();
  for (const sp of stockpiles) {
    stockpileQty.set(`${sp.settlementId}:${sp.resourceId}`, sp.quantity);
  }

  // Collect worker citizen IDs by population instance for each assignment type.
  const husbandryWorkersByPop = new Map<string, string[]>();
  const cullingWorkersByPop = new Map<string, string[]>();
  for (const assignment of citizenAssignments) {
    if (assignment.managedPopulationInstanceId === null) continue;
    const popId = assignment.managedPopulationInstanceId;
    if (assignment.assignmentType === "husbandry") {
      const arr = husbandryWorkersByPop.get(popId);
      if (arr === undefined) {
        husbandryWorkersByPop.set(popId, [assignment.citizenId]);
      } else {
        arr.push(assignment.citizenId);
      }
    } else if (assignment.assignmentType === "culling") {
      const arr = cullingWorkersByPop.get(popId);
      if (arr === undefined) {
        cullingWorkersByPop.set(popId, [assignment.citizenId]);
      } else {
        arr.push(assignment.citizenId);
      }
    }
  }

  const allLogs: SimulationLogEntry[] = [];
  const allNotifications: SimulationNotification[] = [];
  const allDeltas: StockpileDelta[] = [];
  const allPopUpdates: ManagedPopulationUpdate[] = [];
  const allAssignmentClears: AssignmentClear[] = [];

  for (const pop of managedPopulations) {
    if (pop.status !== "active") continue;

    const type = popTypeById.get(pop.managedPopulationTypeId);
    if (type === undefined) continue;

    const sid = pop.settlementId;
    let currentCount = pop.currentCount;

    // --- Maintenance ---
    // Find the tightest per-resource coverage ratio.
    let maintenanceCoverage = 1.0;
    for (const entry of type.maintenanceRulesJson) {
      const required = entry.amountPerNAnimals * currentCount;
      const available = stockpileQty.get(`${sid}:${entry.resourceId}`) ?? 0;
      const coverage = scaleDeficit(required, available);
      if (coverage < maintenanceCoverage) maintenanceCoverage = coverage;
    }
    // Consume maintenance scaled by the coverage ratio.
    for (const entry of type.maintenanceRulesJson) {
      const consumed =
        entry.amountPerNAnimals * currentCount * maintenanceCoverage;
      if (consumed <= 0) continue;
      const key = `${sid}:${entry.resourceId}`;
      allDeltas.push({
        delta: -consumed,
        resourceId: entry.resourceId,
        settlementId: sid,
      });
      stockpileQty.set(key, (stockpileQty.get(key) ?? 0) - consumed);
    }

    // --- Husbandry coverage ---
    const husbandryWorkers = husbandryWorkersByPop.get(pop.id)?.length ?? 0;
    const husbandryNeeded = type.husbandryWorkersPerNAnimals * currentCount;
    const husbandryCoverage = scaleDeficit(husbandryNeeded, husbandryWorkers);

    // --- Growth / decline ---
    const fullySupported =
      maintenanceCoverage >= 1.0 && husbandryCoverage >= 1.0;
    const growthCountDelta = fullySupported
      ? Math.floor(currentCount * type.growthRate)
      : -Math.ceil(currentCount * type.growthRate);
    currentCount += growthCountDelta;

    // --- Culling ---
    // Clamp cull quantity to the post-growth count (never negative population).
    const cullAmount = Math.min(
      pop.configuredCullQuantity,
      Math.max(0, currentCount),
    );
    if (cullAmount > 0) {
      for (const entry of type.cullingOutputsJson) {
        const produced = entry.amountPerNAnimals * cullAmount;
        if (produced <= 0) continue;
        const key = `${sid}:${entry.resourceId}`;
        allDeltas.push({
          delta: produced,
          resourceId: entry.resourceId,
          settlementId: sid,
        });
        stockpileQty.set(key, (stockpileQty.get(key) ?? 0) + produced);
      }
      currentCount -= cullAmount;
    }

    const totalCountDelta = currentCount - pop.currentCount;
    const isExtinct = currentCount <= 0;

    allPopUpdates.push({
      countDelta: totalCountDelta,
      managedPopulationInstanceId: pop.id,
      toStatus: isExtinct ? "extinct" : null,
    });

    if (isExtinct) {
      for (const citizenId of husbandryWorkersByPop.get(pop.id) ?? []) {
        allAssignmentClears.push({
          citizenId,
          reason: "managed_population_extinct",
        });
      }
      for (const citizenId of cullingWorkersByPop.get(pop.id) ?? []) {
        allAssignmentClears.push({
          citizenId,
          reason: "managed_population_extinct",
        });
      }

      allLogs.push({
        category: "managed_population.extinct",
        payload: {
          managedPopulationInstanceId: pop.id,
          name: pop.name,
        },
        phase: "managedPopulations",
        settlementId: sid,
      });
      allNotifications.push({
        messageText: `Population "${pop.name}" has gone extinct.`,
        notificationType: "managed_population.extinct",
        scope: "settlement",
        settlementId: sid,
      });
    } else if (growthCountDelta < 0) {
      allLogs.push({
        category: "managed_population.declining",
        payload: {
          husbandryCoverage,
          maintenanceCoverage,
          managedPopulationInstanceId: pop.id,
          name: pop.name,
        },
        phase: "managedPopulations",
        settlementId: sid,
      });
      allNotifications.push({
        messageText: `Population "${pop.name}" is declining due to insufficient maintenance or husbandry.`,
        notificationType: "managed_population.declining",
        scope: "settlement",
        settlementId: sid,
      });
    }
  }

  return {
    assignmentClears: allAssignmentClears,
    logs: allLogs,
    managedPopulationUpdates: allPopUpdates,
    notifications: allNotifications,
    stockpileDeltas: allDeltas,
  };
}
