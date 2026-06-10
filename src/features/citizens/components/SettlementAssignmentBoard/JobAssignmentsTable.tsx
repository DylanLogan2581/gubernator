import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useState, type JSX, type ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { depositInstancesBySettlementQueryOptions } from "@/features/deposits";
import type { DepositInstance } from "@/features/deposits";
import { managedPopulationInstancesBySettlementQueryOptions } from "@/features/managed-populations";
import type { ManagedPopulationInstance } from "@/features/managed-populations";
import { tradeRoutesForSettlementQueryOptions } from "@/features/trade";
import type { TradeRoute, TradeRouteLeg } from "@/features/trade";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setBulkStandardJobAssignmentMutationOptions } from "../../mutations/bulkStandardJobAssignmentMutations";
import { setPerTargetBulkAssignmentMutationOptions } from "../../mutations/perTargetBulkAssignmentMutations";
import { citizenAggregateStatsForSettlementQueryOptions } from "../../queries/citizensQueries";
import { settlementJobCountsQueryOptions } from "../../queries/settlementJobCountsQueries";
import { settlementTargetAssignmentsQueryOptions } from "../../queries/settlementTargetAssignmentsQueries";

import type { SettlementJobCount } from "../../types/bulkAssignmentTypes";

type JobAssignmentsTableProps = {
  readonly canEdit: boolean;
  readonly settlementId: string;
};

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

export function JobAssignmentsTable({
  canEdit,
  settlementId,
}: JobAssignmentsTableProps): JSX.Element {
  const aggregateQuery = useQuery(
    citizenAggregateStatsForSettlementQueryOptions(settlementId),
  );
  const jobCountsQuery = useQuery(
    settlementJobCountsQueryOptions(settlementId),
  );
  const targetAssignmentsQuery = useQuery(
    settlementTargetAssignmentsQueryOptions(settlementId),
  );
  const depositsQuery = useQuery(
    depositInstancesBySettlementQueryOptions(settlementId),
  );
  const populationsQuery = useQuery(
    managedPopulationInstancesBySettlementQueryOptions(settlementId),
  );
  const tradeRoutesQuery = useQuery(
    tradeRoutesForSettlementQueryOptions(settlementId),
  );

  const isLoading =
    aggregateQuery.isPending ||
    jobCountsQuery.isPending ||
    targetAssignmentsQuery.isPending ||
    depositsQuery.isPending ||
    populationsQuery.isPending ||
    tradeRoutesQuery.isPending;

  if (isLoading) {
    return <LoadingState label="Loading job assignments…" />;
  }

  const firstError =
    aggregateQuery.error ??
    jobCountsQuery.error ??
    targetAssignmentsQuery.error ??
    depositsQuery.error ??
    populationsQuery.error ??
    tradeRoutesQuery.error;

  if (firstError !== null && firstError !== undefined) {
    return (
      <ErrorState
        title="Job assignments could not be loaded"
        description={getErrorDescription(firstError)}
      />
    );
  }

  const stats = aggregateQuery.data;
  if (stats === undefined) {
    return <LoadingState label="Loading job assignments…" />;
  }

  const jobCounts = jobCountsQuery.data ?? [];
  const assignments = targetAssignmentsQuery.data ?? [];
  const deposits = (depositsQuery.data ?? []).filter(
    (d) => d.status === "active",
  );
  const populations = (populationsQuery.data ?? []).filter(
    (p) => p.status === "active",
  );
  const tradeRoutes = (tradeRoutesQuery.data ?? []).filter(
    (r) => r.status === "active",
  );

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
    unassignedNpcCount: stats.unassignedNpcCount,
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

  // Check if any rows to display
  const hasBulkOrPerTarget = rows.length > 1; // > 1 because unassigned is always present

  if (!hasBulkOrPerTarget) {
    return (
      <EmptyState
        title="No jobs"
        description="No jobs are configured for this settlement."
      />
    );
  }

  return (
    <Table className="w-full text-sm">
      <TableHeader>
        <TableRow className="text-muted-foreground">
          <TableHead scope="col">Job</TableHead>
          <TableHead scope="col">Assigned / Capacity</TableHead>
          {canEdit ? <TableHead scope="col">Set count</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, idx) => (
          <RowRenderer
            key={getRowKey(row, idx)}
            row={row}
            canEdit={canEdit}
            countByDeposit={countByDeposit}
            countByHusbandry={countByHusbandry}
            countByCulling={countByCulling}
            countByTradeRouteEnd={countByTradeRouteEnd}
            settlementId={settlementId}
            unassignedNpcCount={stats.unassignedNpcCount}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function getRowJobName(row: Row): string {
  if (row.kind === "unassigned") return "Unassigned";
  if (row.kind === "bulk") return row.job.jobName;
  if (row.kind === "deposit") return row.jobName;
  if (row.kind === "husbandry") return row.jobName;
  if (row.kind === "culling") return row.jobName;
  if (
    row.kind === "trade_route_origin" ||
    row.kind === "trade_route_destination"
  ) {
    return "Trader";
  }
  const _: never = row;
  return _;
}

function getRowTargetName(row: Row): string {
  if (row.kind === "unassigned" || row.kind === "bulk") return "";
  if (row.kind === "deposit") return row.targetName;
  if (row.kind === "husbandry") return row.targetName;
  if (row.kind === "culling") return row.targetName;
  if (
    row.kind === "trade_route_origin" ||
    row.kind === "trade_route_destination"
  ) {
    return row.route.id; // Preserve order within trade routes
  }
  const _: never = row;
  return _;
}

function getRowKey(row: Row, idx: number): string {
  if (row.kind === "unassigned") return "unassigned";
  if (row.kind === "bulk") return `bulk-${row.job.jobId}`;
  if (row.kind === "deposit") return `deposit-${row.targetId}`;
  if (row.kind === "husbandry") return `husbandry-${row.targetId}`;
  if (row.kind === "culling") return `culling-${row.targetId}`;
  if (row.kind === "trade_route_origin")
    return `trade-route-origin-${row.routeId}`;
  if (row.kind === "trade_route_destination")
    return `trade-route-destination-${row.routeId}-${idx}`;
  const _: never = row;
  return _;
}

function legsLabel(legs: readonly TradeRouteLeg[]): string {
  if (legs.length === 0) return "No resources";
  return legs.map((l) => l.resourceName).join(", ");
}

function RowRenderer({
  row,
  canEdit,
  countByDeposit,
  countByHusbandry,
  countByCulling,
  countByTradeRouteEnd,
  settlementId,
  unassignedNpcCount,
}: {
  readonly row: Row;
  readonly canEdit: boolean;
  readonly countByDeposit: ReadonlyMap<string, number>;
  readonly countByHusbandry: ReadonlyMap<string, number>;
  readonly countByCulling: ReadonlyMap<string, number>;
  readonly countByTradeRouteEnd: ReadonlyMap<string, number>;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
}): JSX.Element {
  if (row.kind === "unassigned") {
    return (
      <UnassignedRow
        canEdit={canEdit}
        unassignedNpcCount={unassignedNpcCount}
      />
    );
  }

  if (row.kind === "bulk") {
    return (
      <BulkJobRow
        canEdit={canEdit}
        job={row.job}
        settlementId={settlementId}
        unassignedNpcCount={unassignedNpcCount}
      />
    );
  }

  if (row.kind === "deposit") {
    const currentCount = countByDeposit.get(row.targetId) ?? 0;
    return (
      <DepositTargetRow
        canEdit={canEdit}
        currentCount={currentCount}
        deposit={row.deposit}
        settlementId={settlementId}
        unassignedNpcCount={unassignedNpcCount}
      />
    );
  }

  if (row.kind === "husbandry") {
    const currentCount = countByHusbandry.get(row.targetId) ?? 0;
    return (
      <PopulationTargetRow
        assignmentType="husbandry"
        canEdit={canEdit}
        currentCount={currentCount}
        jobName={row.jobName}
        population={row.population}
        settlementId={settlementId}
        unassignedNpcCount={unassignedNpcCount}
      />
    );
  }

  if (row.kind === "culling") {
    const currentCount = countByCulling.get(row.targetId) ?? 0;
    return (
      <PopulationTargetRow
        assignmentType="culling"
        canEdit={canEdit}
        currentCount={currentCount}
        jobName={row.jobName}
        population={row.population}
        settlementId={settlementId}
        unassignedNpcCount={unassignedNpcCount}
      />
    );
  }

  if (row.kind === "trade_route_origin") {
    const currentCount =
      countByTradeRouteEnd.get(`${row.routeId}:${row.tradeRouteEnd}`) ?? 0;
    const isOrigin = row.localEnd === "origin";
    const localLabel = isOrigin
      ? `Trader: ${row.resourcesLabel} → ${row.route.destinationSettlementName}`
      : `Trader: ${row.resourcesLabel} from ${row.route.originSettlementName}`;
    const localTooltip = isOrigin
      ? `Trading ${row.resourcesLabel} with ${row.route.destinationSettlementName}`
      : `Trading ${row.resourcesLabel} with ${row.route.originSettlementName}`;
    const LocalIcon = isOrigin ? ArrowUpFromLine : ArrowDownToLine;

    return (
      <TradeRouteLocalEndRow
        canEdit={canEdit}
        currentCount={currentCount}
        icon={
          <span title={localTooltip}>
            <LocalIcon
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
            />
          </span>
        }
        label={localLabel}
        routeId={row.routeId}
        settlementId={settlementId}
        tradeRouteEnd={row.tradeRouteEnd}
        unassignedNpcCount={unassignedNpcCount}
      />
    );
  }

  if (row.kind === "trade_route_destination") {
    const currentCount =
      countByTradeRouteEnd.get(`${row.routeId}:${row.tradeRouteEnd}`) ?? 0;

    return (
      <TradeRouteRemoteEndRow
        assignedCount={currentCount}
        destinationSettlementName={row.route.destinationSettlementName}
        originSettlementName={row.route.originSettlementName}
        remoteSettlementName={row.remoteSettlementName}
        tradeRouteEnd={row.tradeRouteEnd}
      />
    );
  }

  const _: never = row;
  return _;
}

function UnassignedRow({
  canEdit,
  unassignedNpcCount,
}: {
  readonly canEdit: boolean;
  readonly unassignedNpcCount: number;
}): JSX.Element {
  return (
    <TableRow>
      <TableCell className="py-2 pr-4 font-medium">Unassigned</TableCell>
      <TableCell className="py-2 pr-4 tabular-nums text-muted-foreground">
        {unassignedNpcCount.toString()} /{" "}
        <span aria-label="no upper bound">∞</span>
      </TableCell>
      {canEdit ? (
        <TableCell className="py-2 text-muted-foreground">—</TableCell>
      ) : null}
    </TableRow>
  );
}

function BulkJobRow({
  canEdit,
  job,
  settlementId,
  unassignedNpcCount,
}: {
  readonly canEdit: boolean;
  readonly job: SettlementJobCount;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [localCount, setLocalCount] = useState(String(job.currentCount));
  const mutation = useMutation(
    setBulkStandardJobAssignmentMutationOptions({ queryClient }),
  );

  const parsedCount = parseInt(localCount, 10);
  const isValid = !Number.isNaN(parsedCount) && parsedCount >= 0;
  const isDirty = isValid && parsedCount !== job.currentCount;
  const isRaising = isValid && parsedCount > job.currentCount;
  const applyDisabled =
    mutation.isPending || !isDirty || (isRaising && unassignedNpcCount === 0);

  async function handleApply(): Promise<void> {
    if (!isValid) return;
    try {
      const result = await mutation.mutateAsync({
        jobId: job.jobId,
        settlementId,
        targetCount: parsedCount,
      });
      setLocalCount(String(result.after));
      notifyMutationSuccess("Job assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update job assignment.");
    }
  }

  return (
    <TableRow className="border-b border-border last:border-0">
      <TableCell className="py-2 pr-4 font-medium">{job.jobName}</TableCell>
      <TableCell className="py-2 pr-4 tabular-nums text-muted-foreground">
        {job.currentCount} / {job.capacity}
      </TableCell>
      {canEdit ? (
        <TableCell className="py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={`Target count for ${job.jobName}`}
              className="w-20"
              disabled={mutation.isPending}
              inputMode="numeric"
              min="0"
              type="number"
              value={localCount}
              onChange={(e) => {
                setLocalCount(e.currentTarget.value);
              }}
            />
            <Button
              disabled={applyDisabled}
              size="sm"
              type="button"
              onClick={() => {
                void handleApply();
              }}
            >
              Apply
            </Button>
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function DepositTargetRow({
  canEdit,
  currentCount,
  deposit,
  settlementId,
  unassignedNpcCount,
}: {
  readonly canEdit: boolean;
  readonly currentCount: number;
  readonly deposit: DepositInstance;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [localCount, setLocalCount] = useState(String(currentCount));
  const mutation = useMutation(
    setPerTargetBulkAssignmentMutationOptions({ queryClient }),
  );

  const label = `${deposit.name} — ${deposit.depositTypeJobName}`;
  const capacity = deposit.maxWorkers;
  const capacityDisplay =
    capacity !== null ? (
      capacity.toString()
    ) : (
      <span aria-label="no upper bound">∞</span>
    );

  const parsedCount = parseInt(localCount, 10);
  const isValid = !Number.isNaN(parsedCount) && parsedCount >= 0;
  const isDirty = isValid && parsedCount !== currentCount;
  const isRaising = isValid && parsedCount > currentCount;
  const atCapacity = capacity !== null && isValid && parsedCount > capacity;
  const noNpcs = isRaising && unassignedNpcCount === 0;
  const applyDisabled = mutation.isPending || !isDirty || atCapacity || noNpcs;

  const applyTooltip = atCapacity
    ? `Maximum workers for this deposit is ${capacity?.toString()}`
    : noNpcs
      ? "No unassigned NPCs available"
      : undefined;

  async function handleApply(): Promise<void> {
    if (!isValid) return;
    try {
      const result = await mutation.mutateAsync({
        assignmentType: "deposit",
        settlementId,
        targetCount: parsedCount,
        targetId: deposit.id,
      });
      setLocalCount(String(result.after));
      notifyMutationSuccess("Deposit assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update deposit assignment.");
    }
  }

  return (
    <TableRow className="border-b border-border last:border-0">
      <TableCell className="py-2 pr-4 font-medium">{label}</TableCell>
      <TableCell className="py-2 pr-4 tabular-nums text-muted-foreground">
        {currentCount} / {capacityDisplay}
      </TableCell>
      {canEdit ? (
        <TableCell className="py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={`Target count for ${label}`}
              className="w-20"
              disabled={mutation.isPending}
              inputMode="numeric"
              min="0"
              type="number"
              value={localCount}
              onChange={(e) => {
                setLocalCount(e.currentTarget.value);
              }}
            />
            <span title={applyTooltip}>
              <Button
                disabled={applyDisabled}
                size="sm"
                type="button"
                onClick={() => {
                  void handleApply();
                }}
              >
                Apply
              </Button>
            </span>
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function PopulationTargetRow({
  assignmentType,
  canEdit,
  currentCount,
  jobName,
  population,
  settlementId,
  unassignedNpcCount,
}: {
  readonly assignmentType: "culling" | "husbandry";
  readonly canEdit: boolean;
  readonly currentCount: number;
  readonly jobName: string;
  readonly population: ManagedPopulationInstance;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [localCount, setLocalCount] = useState(String(currentCount));
  const mutation = useMutation(
    setPerTargetBulkAssignmentMutationOptions({ queryClient }),
  );

  const label = `${population.name} — ${jobName}`;

  const parsedCount = parseInt(localCount, 10);
  const isValid = !Number.isNaN(parsedCount) && parsedCount >= 0;
  const isDirty = isValid && parsedCount !== currentCount;
  const isRaising = isValid && parsedCount > currentCount;
  const noNpcs = isRaising && unassignedNpcCount === 0;
  const applyDisabled = mutation.isPending || !isDirty || noNpcs;
  const applyTooltip = noNpcs ? "No unassigned NPCs available" : undefined;

  async function handleApply(): Promise<void> {
    if (!isValid) return;
    try {
      const result = await mutation.mutateAsync({
        assignmentType,
        settlementId,
        targetCount: parsedCount,
        targetId: population.id,
      });
      setLocalCount(String(result.after));
      notifyMutationSuccess("Assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update assignment.");
    }
  }

  return (
    <TableRow className="border-b border-border last:border-0">
      <TableCell className="py-2 pr-4 font-medium">{label}</TableCell>
      <TableCell className="py-2 pr-4 tabular-nums text-muted-foreground">
        {currentCount} / <span aria-label="no upper bound">∞</span>
      </TableCell>
      {canEdit ? (
        <TableCell className="py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={`Target count for ${label}`}
              className="w-20"
              disabled={mutation.isPending}
              inputMode="numeric"
              min="0"
              type="number"
              value={localCount}
              onChange={(e) => {
                setLocalCount(e.currentTarget.value);
              }}
            />
            <span title={applyTooltip}>
              <Button
                disabled={applyDisabled}
                size="sm"
                type="button"
                onClick={() => {
                  void handleApply();
                }}
              >
                Apply
              </Button>
            </span>
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function TradeRouteLocalEndRow({
  canEdit,
  currentCount,
  icon,
  label,
  routeId,
  settlementId,
  tradeRouteEnd,
  unassignedNpcCount,
}: {
  readonly canEdit: boolean;
  readonly currentCount: number;
  readonly icon?: ReactNode;
  readonly label: string;
  readonly routeId: string;
  readonly settlementId: string;
  readonly tradeRouteEnd: "destination" | "origin";
  readonly unassignedNpcCount: number;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [localCount, setLocalCount] = useState(String(currentCount));
  const mutation = useMutation(
    setPerTargetBulkAssignmentMutationOptions({ queryClient }),
  );

  const parsedCount = parseInt(localCount, 10);
  const isValid = !Number.isNaN(parsedCount) && parsedCount >= 0;
  const isDirty = isValid && parsedCount !== currentCount;
  const isRaising = isValid && parsedCount > currentCount;
  const noNpcs = isRaising && unassignedNpcCount === 0;
  const applyDisabled = mutation.isPending || !isDirty || noNpcs;
  const applyTooltip = noNpcs ? "No unassigned NPCs available" : undefined;

  async function handleApply(): Promise<void> {
    if (!isValid) return;
    try {
      const result = await mutation.mutateAsync({
        assignmentType: "trade_route",
        settlementId,
        targetCount: parsedCount,
        targetId: routeId,
        tradeRouteEnd,
      });
      setLocalCount(String(result.after));
      notifyMutationSuccess("Trade route assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update trade route assignment.");
    }
  }

  return (
    <TableRow className="border-b border-border last:border-0">
      <TableCell className="py-2 pr-4 font-medium">
        <div className="flex items-center gap-1.5">
          {icon}
          <span>{label}</span>
        </div>
      </TableCell>
      <TableCell className="py-2 pr-4 tabular-nums text-muted-foreground">
        {currentCount} / <span aria-label="no upper bound">∞</span>
      </TableCell>
      {canEdit ? (
        <TableCell className="py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={`Target count for ${label}`}
              className="w-20"
              disabled={mutation.isPending}
              inputMode="numeric"
              min="0"
              type="number"
              value={localCount}
              onChange={(e) => {
                setLocalCount(e.currentTarget.value);
              }}
            />
            <span title={applyTooltip}>
              <Button
                disabled={applyDisabled}
                size="sm"
                type="button"
                onClick={() => {
                  void handleApply();
                }}
              >
                Apply
              </Button>
            </span>
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function TradeRouteRemoteEndRow({
  assignedCount,
  destinationSettlementName,
  originSettlementName,
  remoteSettlementName,
  tradeRouteEnd,
}: {
  readonly assignedCount: number;
  readonly destinationSettlementName: string;
  readonly originSettlementName: string;
  readonly remoteSettlementName: string;
  readonly tradeRouteEnd: "destination" | "origin";
}): JSX.Element {
  const isSending = tradeRouteEnd === "origin";
  const RemoteIcon = isSending ? ArrowUpFromLine : ArrowDownToLine;
  const remoteTooltip = isSending
    ? `Sending to ${destinationSettlementName}`
    : `Receiving from ${originSettlementName}`;
  const endLabel = isSending
    ? "Trader (sending — remote)"
    : "Trader (receiving — remote)";

  return (
    <TableRow className="border-b border-border last:border-0 bg-muted/20">
      <TableCell className="py-2 pr-4 font-medium">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span title={remoteTooltip}>
            <RemoteIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          </span>
          <span className="text-xs">
            {endLabel}: {remoteSettlementName}
          </span>
        </div>
      </TableCell>
      <TableCell className="py-2 pr-4 tabular-nums text-muted-foreground text-xs">
        {assignedCount.toString()} assigned (remote)
      </TableCell>
    </TableRow>
  );
}
