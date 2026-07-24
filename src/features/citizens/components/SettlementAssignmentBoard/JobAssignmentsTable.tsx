import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import {
  useCallback,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import {
  activeManagedPopulationTypesByWorldQueryOptions,
  calculateNeededWorkers,
  managedPopulationInstancesBySettlementQueryOptions,
} from "@/features/managed-populations";
import type {
  ManagedPopulationInstance,
  ManagedPopulationType,
} from "@/features/managed-populations";
import { tradeRoutesForSettlementQueryOptions } from "@/features/trade";
import type { TradeRoute, TradeRouteLeg } from "@/features/trade";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

import { setBulkConstructionPoolMutationOptions } from "../../mutations/bulkConstructionPoolMutations";
import { setBulkStandardJobAssignmentMutationOptions } from "../../mutations/bulkStandardJobAssignmentMutations";
import { setPerTargetBulkAssignmentMutationOptions } from "../../mutations/perTargetBulkAssignmentMutations";
import { settlementOfficeholderCountQueryOptions } from "../../queries/citizenDirectoryQueries";
import { citizenAggregateStatsForSettlementQueryOptions } from "../../queries/citizensQueries";
import { settlementJobCountsQueryOptions } from "../../queries/settlementJobCountsQueries";
import { settlementTargetAssignmentsQueryOptions } from "../../queries/settlementTargetAssignmentsQueries";

import type { SettlementJobCount } from "../../types/bulkAssignmentTypes";

type JobAssignmentsTableProps = {
  readonly canEdit: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

type BulkJobRow = {
  readonly kind: "bulk";
  readonly job: SettlementJobCount;
};

type ConstructionPoolRow = {
  readonly kind: "construction";
  readonly currentCount: number;
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
  readonly neededWorkers: number | null;
  readonly population: ManagedPopulationInstance;
  readonly jobName: string;
  readonly targetId: string;
  readonly targetName: string;
};

type CullingRow = {
  readonly kind: "culling";
  readonly neededWorkers: number | null;
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
  | BulkJobRow
  | ConstructionPoolRow
  | DepositRow
  | HusbandryRow
  | CullingRow
  | TradeRouteOriginRow
  | TradeRouteDestinationRow;

export function JobAssignmentsTable({
  canEdit,
  settlementId,
  worldId,
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
  const populationTypesQuery = useQuery(
    activeManagedPopulationTypesByWorldQueryOptions(worldId),
  );
  const tradeRoutesQuery = useQuery(
    tradeRoutesForSettlementQueryOptions(settlementId),
  );
  const officeholderCountQuery = useQuery(
    settlementOfficeholderCountQueryOptions(settlementId),
  );

  const [pendingDeltas, setPendingDeltas] = useState<Record<string, number>>(
    {},
  );

  const handleDirtyChange = useCallback((key: string, delta: number): void => {
    setPendingDeltas((prev) => {
      if (delta === 0) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key] === delta) return prev;
      return { ...prev, [key]: delta };
    });
  }, []);

  // Build count maps for per-target assignments
  const {
    countByDeposit,
    countByHusbandry,
    countByCulling,
    countByTradeRouteEnd,
  } = useMemo(() => {
    const countByDeposit = new Map<string, number>();
    const countByHusbandry = new Map<string, number>();
    const countByCulling = new Map<string, number>();
    const countByTradeRouteEnd = new Map<string, number>();

    for (const assignment of targetAssignmentsQuery.data ?? []) {
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

    return {
      countByDeposit,
      countByHusbandry,
      countByCulling,
      countByTradeRouteEnd,
    };
  }, [targetAssignmentsQuery.data]);

  // Build unified, sorted row list
  const rows = useMemo(() => {
    const jobCounts = jobCountsQuery.data ?? [];
    const deposits = (depositsQuery.data ?? []).filter(
      (d) => d.status === "active",
    );
    const populations = (populationsQuery.data ?? []).filter(
      (p) => p.status === "active",
    );
    const populationTypeById = new Map<string, ManagedPopulationType>();
    for (const type of populationTypesQuery.data ?? []) {
      populationTypeById.set(type.id, type);
    }
    const tradeRoutes = (tradeRoutesQuery.data ?? []).filter(
      (r) => r.status === "active",
    );

    const rows: Row[] = [];

    // Bulk jobs
    for (const job of jobCounts) {
      rows.push({
        kind: "bulk",
        job,
      });
    }

    // Construction (settlement-wide pool)
    rows.push({
      kind: "construction",
      currentCount:
        aggregateQuery.data?.assignmentTypeBreakdown.construction_project ?? 0,
    });

    // Deposits
    for (const deposit of deposits) {
      rows.push({
        kind: "deposit",
        deposit,
        jobName: deposit.depositTypeName,
        targetId: deposit.id,
        targetName: deposit.name,
      });
    }

    // Husbandry
    for (const population of populations) {
      const type = populationTypeById.get(population.managedPopulationTypeId);
      rows.push({
        kind: "husbandry",
        neededWorkers: calculateNeededWorkers(
          population.currentCount,
          type?.husbandryJobs.map((job) => job.workersPerNAnimals) ?? [],
        ),
        population,
        jobName: population.managedPopulationTypeName,
        targetId: population.id,
        targetName: population.name,
      });
    }

    // Culling
    for (const population of populations) {
      const type = populationTypeById.get(population.managedPopulationTypeId);
      rows.push({
        kind: "culling",
        neededWorkers: calculateNeededWorkers(
          population.configuredCullQuantity,
          type?.cullingJobs.map((job) => job.maxCullPerWorker) ?? [],
        ),
        population,
        jobName: population.managedPopulationTypeName,
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

    // Sort: alphabetical by job name + target name
    rows.sort((a, b) => {
      const aName = getRowJobName(a);
      const bName = getRowJobName(b);
      if (aName !== bName) return aName.localeCompare(bName);
      const aTarget = getRowTargetName(a);
      const bTarget = getRowTargetName(b);
      return aTarget.localeCompare(bTarget);
    });

    return rows;
  }, [
    aggregateQuery.data,
    jobCountsQuery.data,
    depositsQuery.data,
    populationsQuery.data,
    populationTypesQuery.data,
    tradeRoutesQuery.data,
    settlementId,
  ]);

  const isLoading =
    aggregateQuery.isPending ||
    jobCountsQuery.isPending ||
    targetAssignmentsQuery.isPending ||
    depositsQuery.isPending ||
    populationsQuery.isPending ||
    populationTypesQuery.isPending ||
    tradeRoutesQuery.isPending;

  if (isLoading) {
    return <TableSkeleton columnCount={6} rowCount={8} />;
  }

  const firstError =
    aggregateQuery.error ??
    jobCountsQuery.error ??
    targetAssignmentsQuery.error ??
    depositsQuery.error ??
    populationsQuery.error ??
    populationTypesQuery.error ??
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
    return <TableSkeleton columnCount={6} rowCount={8} />;
  }

  // Check if any rows to display
  const hasBulkOrPerTarget = rows.length > 0;

  const pendingDeltaSum = Object.values(pendingDeltas).reduce(
    (sum, delta) => sum + delta,
    0,
  );
  const liveUnassignedCount = stats.unassignedNpcCount - pendingDeltaSum;
  const pendingChangeCount = Object.keys(pendingDeltas).length;
  const officeholderCount = officeholderCountQuery.data ?? 0;
  const ineligibleIdleCount = stats.ineligibleIdleNpcCount;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">
            {liveUnassignedCount}
          </span>
          <span className="text-sm text-muted-foreground">unassigned</span>
        </div>
        {pendingChangeCount > 0 ? (
          <span className="text-sm text-muted-foreground">
            {pendingChangeCount} pending change
            {pendingChangeCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      {officeholderCount > 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">
          {officeholderCount} citizen{officeholderCount === 1 ? "" : "s"} in
          this settlement hold{officeholderCount === 1 ? "s" : ""} nation office
          and produce{officeholderCount === 1 ? "s" : ""} no job output this
          turn — their assignment is kept but inactive while in office.
        </p>
      ) : null}
      {ineligibleIdleCount > 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">
          {ineligibleIdleCount} idle citizen
          {ineligibleIdleCount === 1 ? "" : "s"} cannot be assigned right now
          (in office, studying, or serving as a soldier) and{" "}
          {ineligibleIdleCount === 1 ? "is" : "are"} not counted as unassigned.
        </p>
      ) : null}
      {hasBulkOrPerTarget ? (
        <div className="min-w-0 overflow-x-auto rounded-md border">
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
                  worldId={worldId}
                  onDirtyChange={handleDirtyChange}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="No jobs"
          description="No jobs are configured for this settlement."
        />
      )}
    </div>
  );
}

function getRowJobName(row: Row): string {
  if (row.kind === "bulk") return row.job.jobName;
  if (row.kind === "construction") return "Construction";
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
  if (row.kind === "bulk") return "";
  if (row.kind === "construction") return "";
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
  if (row.kind === "bulk") return `bulk-${row.job.jobId}`;
  if (row.kind === "construction") return "construction-pool";
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
  worldId,
  onDirtyChange,
}: {
  readonly row: Row;
  readonly canEdit: boolean;
  readonly countByDeposit: ReadonlyMap<string, number>;
  readonly countByHusbandry: ReadonlyMap<string, number>;
  readonly countByCulling: ReadonlyMap<string, number>;
  readonly countByTradeRouteEnd: ReadonlyMap<string, number>;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
  readonly worldId: string;
  readonly onDirtyChange: (key: string, delta: number) => void;
}): JSX.Element {
  if (row.kind === "bulk") {
    return (
      <BulkJobRow
        canEdit={canEdit}
        job={row.job}
        settlementId={settlementId}
        unassignedNpcCount={unassignedNpcCount}
        worldId={worldId}
        onDirtyChange={onDirtyChange}
      />
    );
  }

  if (row.kind === "construction") {
    return (
      <ConstructionPoolRow
        canEdit={canEdit}
        currentCount={row.currentCount}
        settlementId={settlementId}
        unassignedNpcCount={unassignedNpcCount}
        worldId={worldId}
        onDirtyChange={onDirtyChange}
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
        worldId={worldId}
        onDirtyChange={onDirtyChange}
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
        neededWorkers={row.neededWorkers}
        population={row.population}
        settlementId={settlementId}
        unassignedNpcCount={unassignedNpcCount}
        worldId={worldId}
        onDirtyChange={onDirtyChange}
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
        neededWorkers={row.neededWorkers}
        population={row.population}
        settlementId={settlementId}
        unassignedNpcCount={unassignedNpcCount}
        worldId={worldId}
        onDirtyChange={onDirtyChange}
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
        worldId={worldId}
        onDirtyChange={onDirtyChange}
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

function CapacityDisplay({
  current,
  capacity,
  capacityLabel,
}: {
  readonly capacity: number | null;
  readonly capacityLabel?: string;
  readonly current: number;
}): JSX.Element {
  if (capacity === null) {
    return (
      <>
        {current} / <span aria-label="no upper bound">unlimited</span>
      </>
    );
  }

  const isEmpty = current === 0;
  const isOverCapacity = current > capacity;
  const fillPct =
    capacity > 0 ? Math.min(100, Math.round((current / capacity) * 100)) : 0;
  const suffix = capacityLabel !== undefined ? ` ${capacityLabel}` : "";

  return (
    <div className="flex min-w-28 flex-col gap-1">
      <span
        className={cn(
          "tabular-nums",
          isEmpty && "font-medium text-amber-600 dark:text-amber-500",
          isOverCapacity && "font-medium text-sky-600 dark:text-sky-400",
        )}
      >
        {current} / {capacity}
        {suffix}
      </span>
      <Progress
        aria-label={`${current.toString()} of ${capacity.toString()}${suffix} filled`}
        className={cn(
          "h-1.5",
          isEmpty && "bg-amber-100 dark:bg-amber-950",
          isOverCapacity && "bg-sky-100 dark:bg-sky-950",
        )}
        value={fillPct}
      />
    </div>
  );
}

/**
 * Shared "count + Apply" row: a label cell, a capacity display, and (when
 * editable) a numeric input plus Apply button. The six per-kind rows below are
 * thin config wrappers over this component — only the label cell, capacity,
 * dirty key, extra validation, and mutation payload vary.
 */
function CountAssignmentRow({
  ariaLabel,
  canEdit,
  capacity,
  capacityExtra,
  capacityLabel,
  currentCount,
  dirtyKey,
  errorMessage,
  inputMax,
  isPending,
  labelCell,
  successMessage,
  unassignedNpcCount,
  validate,
  onApply,
  onDirtyChange,
}: {
  readonly ariaLabel: string;
  readonly canEdit: boolean;
  readonly capacity: number | null;
  readonly capacityExtra?: ReactNode;
  readonly capacityLabel?: string;
  readonly currentCount: number;
  readonly dirtyKey: string;
  readonly errorMessage: string;
  readonly inputMax?: number;
  readonly isPending: boolean;
  readonly labelCell: ReactNode;
  readonly successMessage: string;
  readonly unassignedNpcCount: number;
  readonly validate?: (parsedCount: number) => {
    readonly disabled: boolean;
    readonly tooltip?: string;
  };
  readonly onApply: (parsedCount: number) => Promise<number>;
  readonly onDirtyChange: (key: string, delta: number) => void;
}): JSX.Element {
  const [localCount, setLocalCount] = useState(String(currentCount));
  const [syncedCount, setSyncedCount] = useState(currentCount);

  // Resync the input to the server count when it changes externally (e.g.
  // another user's change or a turn advance) while the board stays mounted.
  if (currentCount !== syncedCount) {
    setSyncedCount(currentCount);
    setLocalCount(String(currentCount));
  }

  const parsedCount = parseInt(localCount, 10);
  const isValid = !Number.isNaN(parsedCount) && parsedCount >= 0;
  const isDirty = isValid && parsedCount !== currentCount;
  const isRaising = isValid && parsedCount > currentCount;
  const noNpcs = isRaising && unassignedNpcCount === 0;
  const extra = validate?.(parsedCount);
  const applyDisabled =
    isPending || !isDirty || noNpcs || (extra?.disabled ?? false);
  const applyTooltip =
    extra?.tooltip ?? (noNpcs ? "No unassigned NPCs available" : undefined);

  async function handleApply(): Promise<void> {
    if (!isValid) return;
    try {
      const after = await onApply(parsedCount);
      setLocalCount(String(after));
      onDirtyChange(dirtyKey, 0);
      notifyMutationSuccess(successMessage);
    } catch (error) {
      notifyMutationError(error, errorMessage);
    }
  }

  return (
    <TableRow className="border-b border-border last:border-0">
      <TableCell className="py-2 pr-4 font-medium">{labelCell}</TableCell>
      <TableCell className="py-2 pr-4 text-muted-foreground">
        <CapacityDisplay
          capacity={capacity}
          capacityLabel={capacityLabel}
          current={currentCount}
        />
        {capacityExtra}
      </TableCell>
      {canEdit ? (
        <TableCell className="py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={ariaLabel}
              className="w-20"
              disabled={isPending}
              inputMode="numeric"
              max={inputMax}
              min="0"
              type="number"
              value={localCount}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setLocalCount(value);
                const parsed = parseInt(value, 10);
                const valid = !Number.isNaN(parsed) && parsed >= 0;
                onDirtyChange(dirtyKey, valid ? parsed - currentCount : 0);
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

function BulkJobRow({
  canEdit,
  job,
  settlementId,
  unassignedNpcCount,
  worldId,
  onDirtyChange,
}: {
  readonly canEdit: boolean;
  readonly job: SettlementJobCount;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
  readonly worldId: string;
  readonly onDirtyChange: (key: string, delta: number) => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const mutation = useMutation(
    setBulkStandardJobAssignmentMutationOptions({ queryClient, worldId }),
  );

  const hasRequirement = job.requiredEducationLevelId !== null;
  const noQualified = hasRequirement && job.qualifiedCitizenCount === 0;

  return (
    <CountAssignmentRow
      ariaLabel={`Target count for ${job.jobName}`}
      canEdit={canEdit}
      capacity={job.capacity}
      capacityExtra={
        hasRequirement ? (
          <div className="mt-1 text-xs">
            {job.qualifiedCitizenCount} qualified
          </div>
        ) : undefined
      }
      currentCount={job.currentCount}
      dirtyKey={`bulk-${job.jobId}`}
      errorMessage="Failed to update job assignment."
      inputMax={hasRequirement ? job.qualifiedCitizenCount : undefined}
      isPending={mutation.isPending}
      labelCell={
        <div className="flex flex-wrap items-center gap-1.5">
          <span>{job.jobName}</span>
          {job.requiredEducationLevelName !== null ? (
            <Badge variant="outline">
              Requires {job.requiredEducationLevelName}
            </Badge>
          ) : null}
        </div>
      }
      successMessage="Job assignment updated."
      unassignedNpcCount={unassignedNpcCount}
      validate={(parsedCount) => {
        const exceedsQualified =
          hasRequirement && parsedCount > job.qualifiedCitizenCount;
        const tooltip = noQualified
          ? `No citizens meet the ${job.requiredEducationLevelName ?? "education"} requirement`
          : exceedsQualified
            ? `Only ${job.qualifiedCitizenCount.toString()} citizens meet the education requirement`
            : undefined;
        return { disabled: exceedsQualified, tooltip };
      }}
      onApply={(parsedCount) =>
        mutation
          .mutateAsync({
            jobId: job.jobId,
            settlementId,
            targetCount: parsedCount,
          })
          .then((result) => result.after)
      }
      onDirtyChange={onDirtyChange}
    />
  );
}

function ConstructionPoolRow({
  canEdit,
  currentCount,
  settlementId,
  unassignedNpcCount,
  worldId,
  onDirtyChange,
}: {
  readonly canEdit: boolean;
  readonly currentCount: number;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
  readonly worldId: string;
  readonly onDirtyChange: (key: string, delta: number) => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const mutation = useMutation(
    setBulkConstructionPoolMutationOptions({ queryClient, worldId }),
  );

  return (
    <CountAssignmentRow
      ariaLabel="Target count for Construction"
      canEdit={canEdit}
      capacity={null}
      currentCount={currentCount}
      dirtyKey="construction-pool"
      errorMessage="Failed to update construction worker pool."
      isPending={mutation.isPending}
      labelCell="Construction"
      successMessage="Construction worker pool updated."
      unassignedNpcCount={unassignedNpcCount}
      onApply={(parsedCount) =>
        mutation
          .mutateAsync({ settlementId, targetCount: parsedCount })
          .then((result) => result.after)
      }
      onDirtyChange={onDirtyChange}
    />
  );
}

function DepositTargetRow({
  canEdit,
  currentCount,
  deposit,
  settlementId,
  unassignedNpcCount,
  worldId,
  onDirtyChange,
}: {
  readonly canEdit: boolean;
  readonly currentCount: number;
  readonly deposit: DepositInstance;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
  readonly worldId: string;
  readonly onDirtyChange: (key: string, delta: number) => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const mutation = useMutation(
    setPerTargetBulkAssignmentMutationOptions({ queryClient, worldId }),
  );

  const label = `${deposit.name} — ${deposit.depositTypeName}`;
  const capacity = deposit.maxWorkers;

  return (
    <CountAssignmentRow
      ariaLabel={`Target count for ${label}`}
      canEdit={canEdit}
      capacity={capacity}
      currentCount={currentCount}
      dirtyKey={`deposit-${deposit.id}`}
      errorMessage="Failed to update deposit assignment."
      isPending={mutation.isPending}
      labelCell={label}
      successMessage="Deposit assignment updated."
      unassignedNpcCount={unassignedNpcCount}
      validate={(parsedCount) => {
        const atCapacity = capacity !== null && parsedCount > capacity;
        return {
          disabled: atCapacity,
          tooltip: atCapacity
            ? `Maximum workers for this deposit is ${capacity?.toString()}`
            : undefined,
        };
      }}
      onApply={(parsedCount) =>
        mutation
          .mutateAsync({
            assignmentType: "deposit",
            settlementId,
            targetCount: parsedCount,
            targetId: deposit.id,
          })
          .then((result) => result.after)
      }
      onDirtyChange={onDirtyChange}
    />
  );
}

function PopulationTargetRow({
  assignmentType,
  canEdit,
  currentCount,
  jobName,
  neededWorkers,
  population,
  settlementId,
  unassignedNpcCount,
  worldId,
  onDirtyChange,
}: {
  readonly assignmentType: "culling" | "husbandry";
  readonly canEdit: boolean;
  readonly currentCount: number;
  readonly jobName: string;
  readonly neededWorkers: number | null;
  readonly population: ManagedPopulationInstance;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
  readonly worldId: string;
  readonly onDirtyChange: (key: string, delta: number) => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const mutation = useMutation(
    setPerTargetBulkAssignmentMutationOptions({ queryClient, worldId }),
  );

  const label = `${population.name} — ${jobName}`;

  return (
    <CountAssignmentRow
      ariaLabel={`Target count for ${label}`}
      canEdit={canEdit}
      capacity={neededWorkers}
      capacityLabel="needed"
      currentCount={currentCount}
      dirtyKey={`${assignmentType}-${population.id}`}
      errorMessage="Failed to update assignment."
      isPending={mutation.isPending}
      labelCell={label}
      successMessage="Assignment updated."
      unassignedNpcCount={unassignedNpcCount}
      onApply={(parsedCount) =>
        mutation
          .mutateAsync({
            assignmentType,
            settlementId,
            targetCount: parsedCount,
            targetId: population.id,
          })
          .then((result) => result.after)
      }
      onDirtyChange={onDirtyChange}
    />
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
  worldId,
  onDirtyChange,
}: {
  readonly canEdit: boolean;
  readonly currentCount: number;
  readonly icon?: ReactNode;
  readonly label: string;
  readonly routeId: string;
  readonly settlementId: string;
  readonly tradeRouteEnd: "destination" | "origin";
  readonly unassignedNpcCount: number;
  readonly worldId: string;
  readonly onDirtyChange: (key: string, delta: number) => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const mutation = useMutation(
    setPerTargetBulkAssignmentMutationOptions({ queryClient, worldId }),
  );

  return (
    <CountAssignmentRow
      ariaLabel={`Target count for ${label}`}
      canEdit={canEdit}
      capacity={null}
      currentCount={currentCount}
      dirtyKey={`trade-route-${routeId}-${tradeRouteEnd}`}
      errorMessage="Failed to update trade route assignment."
      isPending={mutation.isPending}
      labelCell={
        <div className="flex items-center gap-1.5">
          {icon}
          <span>{label}</span>
        </div>
      }
      successMessage="Trade route assignment updated."
      unassignedNpcCount={unassignedNpcCount}
      onApply={(parsedCount) =>
        mutation
          .mutateAsync({
            assignmentType: "trade_route",
            settlementId,
            targetCount: parsedCount,
            targetId: routeId,
            tradeRouteEnd,
          })
          .then((result) => result.after)
      }
      onDirtyChange={onDirtyChange}
    />
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
