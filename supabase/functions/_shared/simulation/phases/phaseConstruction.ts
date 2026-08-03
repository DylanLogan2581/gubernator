// Phase: construction — distributes construction workers across project queue.
//
// Workers with a non-null constructionProjectId are assigned to that specific
// project. Workers with constructionProjectId = null form a settlement-wide
// pool that fills projects without explicit assignments, in queue order.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  AssignmentClear,
  BuildingCreated,
  BuildingTierUpgrade,
  ConstructionUpdate,
  SimBuildingTier,
  SimTierCostEntry,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
  StockpileDelta,
} from "../simulationTypes.ts";

export type PhaseConstructionOutput = {
  readonly assignmentClears: readonly AssignmentClear[];
  readonly buildingsCreated: readonly BuildingCreated[];
  readonly buildingTierUpgrades: readonly BuildingTierUpgrade[];
  readonly constructionUpdates: readonly ConstructionUpdate[];
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
  readonly stockpileDeltas: readonly StockpileDelta[];
};

// Aggregate construction costs across every tier of a blueprint whose
// tier_number lies in (fromTierNumber, toTierNumber]. Direct builds pass
// fromTierNumber = 0 so tiers 1..N are summed; upgrades pass the building's
// current tier number so only the delta tiers are charged (#1372).
function cumulativeConstructionCosts(
  tiers: readonly SimBuildingTier[],
  fromTierNumber: number,
  toTierNumber: number,
): SimTierCostEntry[] {
  const byResource = new Map<string, number>();
  for (const tier of tiers) {
    if (tier.tierNumber <= fromTierNumber || tier.tierNumber > toTierNumber) {
      continue;
    }
    for (const cost of tier.constructionCostsJson) {
      byResource.set(
        cost.resourceId,
        (byResource.get(cost.resourceId) ?? 0) + cost.amount,
      );
    }
  }
  return [...byResource].map(([resourceId, amount]) => ({ amount, resourceId }));
}

export function phaseConstruction(
  context: SimulationContext,
): PhaseConstructionOutput {
  const {
    buildingTiers,
    citizenAssignments,
    citizens,
    constructionProjects,
    settlementBuildings,
    settlements,
    stockpiles,
  } = context.input;

  const buildingTierById = new Map(buildingTiers.map((t) => [t.id, t]));
  const citizenById = new Map(citizens.map((c) => [c.id, c]));
  const settlementBuildingById = new Map(
    settlementBuildings.map((b) => [b.id, b]),
  );

  // Tiers grouped by blueprint for cumulative / delta cost computation.
  const tiersByBlueprint = new Map<string, SimBuildingTier[]>();
  for (const tier of buildingTiers) {
    const arr = tiersByBlueprint.get(tier.buildingBlueprintId);
    if (arr === undefined) {
      tiersByBlueprint.set(tier.buildingBlueprintId, [tier]);
    } else {
      arr.push(tier);
    }
  }

  // Build mutable stockpile quantity map.
  const stockpileQty = new Map<string, number>();
  for (const sp of stockpiles) {
    stockpileQty.set(`${sp.settlementId}:${sp.resourceId}`, sp.quantity);
  }

  // Separate per-project workers (non-null constructionProjectId) from pool
  // workers (null constructionProjectId). Per-project workers go to their
  // assigned project; pool workers fill projects without explicit assignments.
  const perProjectWorkerIds = new Map<string, string[]>();
  const poolWorkersBySid = new Map<string, string[]>();

  for (const assignment of citizenAssignments) {
    if (assignment.assignmentType !== "construction_project") continue;
    const citizen = citizenById.get(assignment.citizenId);
    if (citizen === undefined || citizen.settlementId === null) continue;
    const sid = citizen.settlementId;

    if (assignment.constructionProjectId !== null) {
      let arr = perProjectWorkerIds.get(assignment.constructionProjectId);
      if (arr === undefined) {
        arr = [];
        perProjectWorkerIds.set(assignment.constructionProjectId, arr);
      }
      arr.push(assignment.citizenId);
    } else {
      let arr = poolWorkersBySid.get(sid);
      if (arr === undefined) {
        arr = [];
        poolWorkersBySid.set(sid, arr);
      }
      arr.push(assignment.citizenId);
    }
  }

  // Collect actionable projects per settlement, sorted by queue_position ascending.
  type ProjectEntry = (typeof constructionProjects)[number];
  const projectsBySettlement = new Map<string, ProjectEntry[]>();
  for (const project of constructionProjects) {
    if (project.status !== "in_progress" && project.status !== "queued") {
      continue;
    }
    const sid = project.settlementId;
    const arr = projectsBySettlement.get(sid);
    if (arr === undefined) {
      projectsBySettlement.set(sid, [project]);
    } else {
      arr.push(project);
    }
  }
  for (const arr of projectsBySettlement.values()) {
    arr.sort((a, b) => a.queuePosition - b.queuePosition);
  }

  const allAssignmentClears: AssignmentClear[] = [];
  const allLogs: SimulationLogEntry[] = [];
  const allNotifications: SimulationNotification[] = [];
  const allConstructionUpdates: ConstructionUpdate[] = [];
  const allBuildingsCreated: BuildingCreated[] = [];
  const allBuildingTierUpgrades: BuildingTierUpgrade[] = [];
  const allStockpileDeltas: StockpileDelta[] = [];

  for (const settlement of settlements) {
    const sid = settlement.id;
    const poolWorkers = poolWorkersBySid.get(sid) ?? [];
    let remainingPool = poolWorkers.length;
    const projects = projectsBySettlement.get(sid) ?? [];

    for (const project of projects) {
      const explicitWorkers = perProjectWorkerIds.get(project.id) ?? [];
      const explicitCount = explicitWorkers.length;

      let workers: number;
      let useExplicit: boolean;

      if (explicitCount > 0) {
        workers = explicitCount;
        useExplicit = true;
      } else if (remainingPool > 0) {
        workers = remainingPool;
        useExplicit = false;
      } else {
        continue;
      }

      const tier = buildingTierById.get(project.targetTierId);
      if (tier === undefined) continue;

      // Determine the effective per-worker-turn cost. Direct builds pay the
      // cumulative cost of tiers 1..N; upgrades pay only the delta tiers above
      // the building's current tier (#1372).
      const blueprintTiers = tiersByBlueprint.get(project.buildingBlueprintId) ??
        [tier];
      const upgradeBuilding = project.upgradeSettlementBuildingId === null
        ? undefined
        : settlementBuildingById.get(project.upgradeSettlementBuildingId);
      const fromTierNumber = upgradeBuilding === undefined
        ? 0
        : buildingTierById.get(upgradeBuilding.currentTierId)?.tierNumber ?? 0;
      const effectiveCosts = cumulativeConstructionCosts(
        blueprintTiers,
        fromTierNumber,
        tier.tierNumber,
      );

      // Check whether the stockpile can cover construction costs × workers.
      let canPay = true;
      for (const cost of effectiveCosts) {
        const required = cost.amount * workers;
        const available = stockpileQty.get(`${sid}:${cost.resourceId}`) ?? 0;
        if (available < required) {
          canPay = false;
          break;
        }
      }

      if (!canPay) {
        allConstructionUpdates.push({
          progressWorkerTurnsDelta: 0,
          projectId: project.id,
          settlementId: sid,
          toStatus: "paused",
        });
        allLogs.push({
          category: "construction.paused",
          payload: {
            projectId: project.id,
            workers,
          },
          phase: "construction",
          settlementId: sid,
        });
        allNotifications.push({
          messageText:
            `A construction project in "${settlement.name}" was paused due to insufficient resources.`,
          notificationType: "construction.paused",
          scope: "settlement",
          settlementId: sid,
        });
        continue;
      }

      // Deduct pool count only after a successful resource check.
      if (!useExplicit) {
        remainingPool -= workers;
      }

      // Deduct construction costs from stockpile.
      const costsDeducted: Record<string, number> = {};
      for (const cost of effectiveCosts) {
        const consumed = cost.amount * workers;
        costsDeducted[cost.resourceId] = consumed;
        const key = `${sid}:${cost.resourceId}`;
        allStockpileDeltas.push({
          delta: -consumed,
          resourceId: cost.resourceId,
          settlementId: sid,
        });
        stockpileQty.set(key, (stockpileQty.get(key) ?? 0) - consumed);
      }

      const newProgress = project.progressWorkerTurns + workers;
      const isComplete = newProgress >= project.workerTurnsRequired;

      const toStatus = isComplete ? "complete" : project.status === "queued" ? "in_progress" : null;

      allConstructionUpdates.push({
        progressWorkerTurnsDelta: workers,
        projectId: project.id,
        settlementId: sid,
        toStatus,
      });

      if (isComplete) {
        // Release only the workers that contributed to this project.
        const workersToRelease = useExplicit ? explicitWorkers : poolWorkers;
        for (const citizenId of workersToRelease) {
          allAssignmentClears.push({
            citizenId,
            reason: "construction_project_completed",
          });
        }

        if (
          project.upgradeSettlementBuildingId !== null &&
          upgradeBuilding !== undefined
        ) {
          // Upgrade completion bumps the existing building's tier in place;
          // no new building row is created (#1372).
          allBuildingTierUpgrades.push({
            settlementBuildingId: project.upgradeSettlementBuildingId,
            toTierId: project.targetTierId,
          });
        } else {
          allBuildingsCreated.push({
            buildingBlueprintId: project.buildingBlueprintId,
            settlementId: sid,
            tierId: project.targetTierId,
          });
        }
        allLogs.push({
          category: "construction.completed",
          payload: {
            costsDeducted,
            newProgress,
            projectId: project.id,
            workers,
            workerTurnsRequired: project.workerTurnsRequired,
          },
          phase: "construction",
          settlementId: sid,
        });
        allNotifications.push({
          messageText: `Construction completed in "${settlement.name}".`,
          notificationType: "construction.completed",
          scope: "settlement",
          settlementId: sid,
        });
      } else {
        allLogs.push({
          category: "construction.progress",
          payload: {
            costsDeducted,
            newProgress,
            projectId: project.id,
            settlementId: sid,
            workers,
            workerTurnsRequired: project.workerTurnsRequired,
          },
          phase: "construction",
        });
      }
    }
  }

  return {
    assignmentClears: allAssignmentClears,
    buildingsCreated: allBuildingsCreated,
    buildingTierUpgrades: allBuildingTierUpgrades,
    constructionUpdates: allConstructionUpdates,
    logs: allLogs,
    notifications: allNotifications,
    stockpileDeltas: allStockpileDeltas,
  };
}
