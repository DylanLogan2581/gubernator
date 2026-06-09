import type { DepositInstance } from "@/features/deposits";
import type { ManagedPopulationInstance } from "@/features/managed-populations";
import type { TradeRoute } from "@/features/trade";

import type { SettlementJobCount } from "../types/bulkAssignmentTypes";
import type { CitizenAssignment } from "../types/citizenAssignmentTypes";

// Re-export Row types from JobAssignmentsTable for use in queries
type UnassignedRow = {
  readonly kind: "unassigned";
  readonly unassignedNpcCount: number;
};

type BulkJobRow = {
  readonly kind: "bulk";
  readonly job: SettlementJobCount;
};

type DepositRow = {
  readonly kind: "deposit";
  readonly deposit: DepositInstance;
  readonly jobName: string;
  readonly targetId: string;
  readonly targetName: string;
};

type HusbandryRow = {
  readonly kind: "husbandry";
  readonly population: ManagedPopulationInstance;
  readonly jobName: string;
  readonly targetId: string;
  readonly targetName: string;
};

type CullingRow = {
  readonly kind: "culling";
  readonly population: ManagedPopulationInstance;
  readonly jobName: string;
  readonly targetId: string;
  readonly targetName: string;
};

type TradeRouteOriginRow = {
  readonly kind: "trade_route_origin";
  readonly route: TradeRoute;
  readonly localEnd: "origin" | "destination";
  readonly resourcesLabel: string;
  readonly remoteSettlementName: string;
  readonly routeId: string;
  readonly tradeRouteEnd: "origin" | "destination";
};

type TradeRouteDestinationRow = {
  readonly kind: "trade_route_destination";
  readonly route: TradeRoute;
  readonly localEnd: "origin" | "destination";
  readonly remoteSettlementName: string;
  readonly routeId: string;
  readonly tradeRouteEnd: "origin" | "destination";
};

type Row =
  | UnassignedRow
  | BulkJobRow
  | DepositRow
  | HusbandryRow
  | CullingRow
  | TradeRouteOriginRow
  | TradeRouteDestinationRow;

type CountMaps = {
  readonly countByDeposit: ReadonlyMap<string, number>;
  readonly countByHusbandry: ReadonlyMap<string, number>;
  readonly countByCulling: ReadonlyMap<string, number>;
  readonly countByTradeRouteEnd: ReadonlyMap<string, number>;
};

type BuildSettlementAssignmentRowsResult = {
  readonly rows: readonly Row[];
  readonly countMaps: CountMaps;
};

function legsLabel(legs: readonly { readonly resourceName: string }[]): string {
  if (legs.length === 0) return "No resources";
  return legs.map((l) => l.resourceName).join(", ");
}

function getRowJobName(row: Row): string {
  switch (row.kind) {
    case "unassigned":
      return "Unassigned";
    case "bulk":
      return row.job.jobName;
    case "deposit":
      return row.jobName;
    case "husbandry":
      return row.jobName;
    case "culling":
      return row.jobName;
    case "trade_route_origin":
    case "trade_route_destination":
      return "Trader";
  }
}

function getRowTargetName(row: Row): string {
  switch (row.kind) {
    case "unassigned":
      return "";
    case "bulk":
      return "";
    case "deposit":
      return row.targetName;
    case "husbandry":
      return row.targetName;
    case "culling":
      return row.targetName;
    case "trade_route_origin":
    case "trade_route_destination":
      return row.route.id;
  }
}

export function buildSettlementAssignmentRows(
  jobCounts: readonly SettlementJobCount[],
  assignments: readonly CitizenAssignment[],
  deposits: readonly DepositInstance[],
  populations: readonly ManagedPopulationInstance[],
  tradeRoutes: readonly TradeRoute[],
  settlementId: string,
  unassignedNpcCount: number,
): BuildSettlementAssignmentRowsResult {
  // Build count maps for per-target assignments
  const countByDeposit = new Map<string, number>();
  const countByHusbandry = new Map<string, number>();
  const countByCulling = new Map<string, number>();
  const countByTradeRouteEnd = new Map<string, number>();

  for (const assignment of assignments) {
    if (
      assignment.assignmentType === "deposit" &&
      assignment.depositInstance !== null
    ) {
      const id = assignment.depositInstance.id;
      countByDeposit.set(id, (countByDeposit.get(id) ?? 0) + 1);
    } else if (
      assignment.assignmentType === "husbandry" &&
      assignment.managedPopulationInstance !== null
    ) {
      const id = assignment.managedPopulationInstance.id;
      countByHusbandry.set(id, (countByHusbandry.get(id) ?? 0) + 1);
    } else if (
      assignment.assignmentType === "culling" &&
      assignment.managedPopulationInstance !== null
    ) {
      const id = assignment.managedPopulationInstance.id;
      countByCulling.set(id, (countByCulling.get(id) ?? 0) + 1);
    } else if (
      assignment.assignmentType === "trade_route" &&
      assignment.tradeRoute !== null
    ) {
      const key = `${assignment.tradeRoute.id}:${assignment.tradeRouteEnd}`;
      countByTradeRouteEnd.set(key, (countByTradeRouteEnd.get(key) ?? 0) + 1);
    }
  }

  // Build unified row list
  const rows: Row[] = [];

  // Unassigned (pinned first)
  rows.push({
    kind: "unassigned",
    unassignedNpcCount,
  });

  // Bulk jobs
  for (const job of jobCounts) {
    rows.push({
      kind: "bulk",
      job,
    });
  }

  // Deposits
  for (const deposit of deposits) {
    rows.push({
      kind: "deposit",
      deposit,
      jobName: deposit.depositTypeJobName,
      targetId: deposit.id,
      targetName: deposit.name,
    });
  }

  // Husbandry
  for (const population of populations) {
    rows.push({
      kind: "husbandry",
      population,
      jobName: population.husbandryJobName,
      targetId: population.id,
      targetName: population.name,
    });
  }

  // Culling
  for (const population of populations) {
    rows.push({
      kind: "culling",
      population,
      jobName: population.cullingJobName,
      targetId: population.id,
      targetName: population.name,
    });
  }

  // Trade routes (local end + remote end for each route)
  for (const route of tradeRoutes) {
    const localEnd =
      route.originSettlementId === settlementId ? "origin" : "destination";
    const remoteEnd = localEnd === "origin" ? "destination" : "origin";
    const remoteSettlementName =
      localEnd === "origin"
        ? route.destinationSettlementName
        : route.originSettlementName;
    const resourcesLabel = legsLabel(route.legs);

    // Local end (editable)
    rows.push({
      kind: "trade_route_origin",
      route,
      localEnd,
      resourcesLabel,
      remoteSettlementName,
      routeId: route.id,
      tradeRouteEnd: localEnd,
    });

    // Remote end (read-only)
    rows.push({
      kind: "trade_route_destination",
      route,
      localEnd,
      remoteSettlementName,
      routeId: route.id,
      tradeRouteEnd: remoteEnd,
    });
  }

  // Sort: alphabetical by job name + target name (except unassigned stays first)
  const unassignedRow = rows.shift();
  rows.sort((a, b) => {
    const aName = getRowJobName(a);
    const bName = getRowJobName(b);
    if (aName !== bName) return aName.localeCompare(bName);
    const aTarget = getRowTargetName(a);
    const bTarget = getRowTargetName(b);
    return aTarget.localeCompare(bTarget);
  });
  if (unassignedRow !== undefined) {
    rows.unshift(unassignedRow);
  }

  const countMaps: CountMaps = {
    countByDeposit,
    countByHusbandry,
    countByCulling,
    countByTradeRouteEnd,
  };

  return { rows, countMaps };
}

export type {
  Row,
  UnassignedRow,
  BulkJobRow,
  DepositRow,
  HusbandryRow,
  CullingRow,
  TradeRouteOriginRow,
  TradeRouteDestinationRow,
  CountMaps,
};
