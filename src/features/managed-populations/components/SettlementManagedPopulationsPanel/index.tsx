import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Plus, Skull } from "lucide-react";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { settlementTargetAssignmentsQueryOptions } from "@/features/citizens";
import {
  activeResourcesByWorldQueryOptions,
  type Resource,
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
          <LoadingState label="Loading managed populations…" />
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
  readonly typeById: ReadonlyMap<string, ManagedPopulationType>;
}): JSX.Element {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          <th className="pb-2 font-medium" scope="col">
            Name
          </th>
          <th className="pb-2 font-medium" scope="col">
            Type
          </th>
          <th className="pb-2 font-medium" scope="col">
            Count
          </th>
          <th className="pb-2 font-medium" scope="col">
            Cull qty
          </th>
          <th className="pb-2 font-medium" scope="col">
            Husbandry / workers
          </th>
          <th className="pb-2 font-medium" scope="col">
            Maintenance/turn
          </th>
          {canAdmin ? (
            <th aria-label="Actions" className="w-32 pb-2" scope="col" />
          ) : null}
        </tr>
      </thead>
      <tbody>
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
            type={typeById.get(instance.managedPopulationTypeId)}
          />
        ))}
      </tbody>
    </table>
  );
}
