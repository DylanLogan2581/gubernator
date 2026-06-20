import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Plus, Skull } from "lucide-react";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { settlementTargetAssignmentsQueryOptions } from "@/features/citizens";
import {
  activeResourcesByWorldQueryOptions,
  settlementStockpilesByIdQueryOptions,
  type Resource,
  type SettlementStockpile,
} from "@/features/resources";
import {
  useSettlementTransitionOutcome,
  type TurnTransitionOutcome,
} from "@/features/turns";
import { getErrorDescription } from "@/lib/errorUtils";

import { managedPopulationInstancesBySettlementQueryOptions } from "../../queries/managedPopulationInstancesQueries";
import {
  managedPopulationSnapshotsBySettlementQueryOptions,
  type ManagedPopSnapshotCounts,
} from "../../queries/managedPopulationSnapshotsQueries";
import { activeManagedPopulationTypesByWorldQueryOptions } from "../../queries/managedPopulationsQueries";

import { AddManagedPopulationDialog } from "./AddManagedPopulationDialog";
import { ManagedPopulationInstanceRow } from "./ManagedPopulationInstanceRow";

import type { ManagedPopulationInstance } from "../../types/managedPopulationInstanceTypes";
import type { ManagedPopulationType } from "../../types/managedPopulationTypes";

type SettlementManagedPopulationsPanelProps = {
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementManagedPopulationsPanel({
  canAdmin,
  canManage,
  isArchived,
  settlementId,
  worldId,
}: SettlementManagedPopulationsPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const [showExtinct, setShowExtinct] = useState(false);

  const instancesQuery = useQuery(
    managedPopulationInstancesBySettlementQueryOptions(settlementId),
  );
  const typesQuery = useQuery(
    activeManagedPopulationTypesByWorldQueryOptions(worldId),
  );
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const assignmentsQuery = useQuery(
    settlementTargetAssignmentsQueryOptions(settlementId),
  );
  const stockpilesQuery = useQuery(
    settlementStockpilesByIdQueryOptions(settlementId),
  );
  const latestOutcome = useSettlementTransitionOutcome(settlementId);
  const snapshotCountsQuery = useQuery(
    managedPopulationSnapshotsBySettlementQueryOptions(settlementId),
  );

  const typeById = new Map<string, ManagedPopulationType>();
  if (typesQuery.data !== undefined) {
    for (const t of typesQuery.data) {
      typeById.set(t.id, t);
    }
  }

  const resourceById = new Map<string, Resource>();
  if (resourcesQuery.data !== undefined) {
    for (const r of resourcesQuery.data) {
      resourceById.set(r.id, r);
    }
  }

  const stockpileByResourceId = new Map<string, SettlementStockpile>();
  if (stockpilesQuery.data !== undefined) {
    for (const s of stockpilesQuery.data) {
      stockpileByResourceId.set(s.resourceId, s);
    }
  }

  // Count husbandry assignments per managed population instance
  const husbandryCountByInstance = new Map<string, number>();
  if (assignmentsQuery.data !== undefined) {
    for (const a of assignmentsQuery.data) {
      if (
        a.assignmentType === "husbandry" &&
        a.managedPopulationInstance !== null
      ) {
        const id = a.managedPopulationInstance.id;
        husbandryCountByInstance.set(
          id,
          (husbandryCountByInstance.get(id) ?? 0) + 1,
        );
      }
    }
  }

  const allInstances = instancesQuery.data ?? [];
  const activeInstances = allInstances.filter((i) => i.status === "active");
  const extinctInstances = allInstances.filter((i) => i.status === "extinct");
  const displayedInstances = showExtinct ? extinctInstances : activeInstances;

  return (
    <Card
      aria-labelledby="settlement-managed-populations-heading"
      className="grid gap-3"
    >
      <div className="px-4 pt-4">
        <ManagedPopulationsPanelHeader
          canAdmin={canAdmin && !isArchived}
          instancesLoaded={!instancesQuery.isPending}
          queryClient={queryClient}
          settlementId={settlementId}
          showExtinct={showExtinct}
          worldId={worldId}
          onToggleExtinct={() => {
            setShowExtinct((prev) => !prev);
          }}
        />
      </div>

      <CardContent>
        {instancesQuery.isPending ? (
          <TableSkeleton columnCount={6} rowCount={5} />
        ) : instancesQuery.isError ? (
          <ErrorState
            description={getErrorDescription(instancesQuery.error)}
            title="Managed populations could not be loaded"
          />
        ) : displayedInstances.length === 0 ? (
          <EmptyState
            description={
              showExtinct
                ? "This settlement has no extinct population instances."
                : "This settlement has no managed population instances."
            }
            title={
              showExtinct ? "No extinct populations" : "No managed populations"
            }
          />
        ) : (
          <ManagedPopulationsTable
            canAdmin={canAdmin && !isArchived && !showExtinct}
            canManage={(canManage || canAdmin) && !isArchived && !showExtinct}
            husbandryCountByInstance={husbandryCountByInstance}
            instances={displayedInstances}
            latestOutcome={latestOutcome}
            queryClient={queryClient}
            resourceById={resourceById}
            snapshotCounts={
              snapshotCountsQuery.data ?? {
                latestCounts: null,
                prevCounts: null,
              }
            }
            stockpileByResourceId={stockpileByResourceId}
            typeById={typeById}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ManagedPopulationsPanelHeader({
  canAdmin,
  instancesLoaded,
  queryClient,
  settlementId,
  showExtinct,
  worldId,
  onToggleExtinct,
}: {
  readonly canAdmin: boolean;
  readonly instancesLoaded: boolean;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly showExtinct: boolean;
  readonly worldId: string;
  readonly onToggleExtinct: () => void;
}): JSX.Element {
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <h2
          className="text-base font-medium"
          id="settlement-managed-populations-heading"
        >
          Managed Populations
        </h2>
        <div className="flex items-center gap-2">
          {canAdmin && instancesLoaded && !showExtinct ? (
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddDialog(true);
              }}
            >
              <Plus aria-hidden="true" />
              Add managed population
            </Button>
          ) : null}
          {instancesLoaded ? (
            <Button
              aria-label={showExtinct ? "Hide extinct" : "Show extinct"}
              aria-pressed={showExtinct}
              size="icon-sm"
              title={showExtinct ? "Hide extinct" : "Show extinct"}
              type="button"
              variant={showExtinct ? "secondary" : "ghost"}
              onClick={onToggleExtinct}
            >
              <Skull aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
      {showAddDialog ? (
        <AddManagedPopulationDialog
          queryClient={queryClient}
          settlementId={settlementId}
          worldId={worldId}
          onClose={() => {
            setShowAddDialog(false);
          }}
        />
      ) : null}
    </>
  );
}

function ManagedPopulationsTable({
  canAdmin,
  canManage,
  husbandryCountByInstance,
  instances,
  latestOutcome,
  queryClient,
  resourceById,
  snapshotCounts,
  stockpileByResourceId,
  typeById,
}: {
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly husbandryCountByInstance: ReadonlyMap<string, number>;
  readonly instances: readonly ManagedPopulationInstance[];
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly resourceById: ReadonlyMap<string, Resource>;
  readonly snapshotCounts: ManagedPopSnapshotCounts;
  readonly stockpileByResourceId: ReadonlyMap<string, SettlementStockpile>;
  readonly typeById: ReadonlyMap<string, ManagedPopulationType>;
}): JSX.Element {
  return (
    <Table className="w-full text-sm">
      <TableHeader>
        <TableRow className="text-muted-foreground">
          <TableHead scope="col">Name</TableHead>
          <TableHead scope="col">Type</TableHead>
          <TableHead scope="col">Count</TableHead>
          <TableHead scope="col">Cull qty</TableHead>
          <TableHead scope="col">Husbandry / workers</TableHead>
          <TableHead scope="col">Maintenance/turn</TableHead>
          {canAdmin ? (
            <TableHead aria-label="Actions" className="w-32" scope="col" />
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {instances.map((instance) => (
          <ManagedPopulationInstanceRow
            key={instance.id}
            canAdmin={canAdmin}
            canManage={canManage}
            husbandryCount={husbandryCountByInstance.get(instance.id) ?? 0}
            instance={instance}
            latestOutcome={latestOutcome}
            queryClient={queryClient}
            resourceById={resourceById}
            snapshotCounts={snapshotCounts}
            stockpileByResourceId={stockpileByResourceId}
            type={typeById.get(instance.managedPopulationTypeId)}
          />
        ))}
      </TableBody>
    </Table>
  );
}
