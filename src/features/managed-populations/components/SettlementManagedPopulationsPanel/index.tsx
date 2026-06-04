import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
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

import type {
  ManagedPopulationInstance,
  ManagedPopulationInstanceStatus,
} from "../../types/managedPopulationInstanceTypes";
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

  return (
    <section
      aria-labelledby="settlement-managed-populations-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <ManagedPopulationsPanelHeader
        canAdmin={canAdmin && !isArchived}
        instancesLoaded={!instancesQuery.isPending}
        queryClient={queryClient}
        settlementId={settlementId}
        worldId={worldId}
      />

      {instancesQuery.isPending ? (
        <LoadingState label="Loading managed populations…" />
      ) : instancesQuery.isError ? (
        <ErrorState
          description={getErrorDescription(instancesQuery.error)}
          title="Managed populations could not be loaded"
        />
      ) : instancesQuery.data.length === 0 ? (
        <EmptyState
          description="This settlement has no managed population instances."
          title="No managed populations"
        />
      ) : (
        <ManagedPopulationsGroups
          canAdmin={canAdmin && !isArchived}
          canManage={(canManage || canAdmin) && !isArchived}
          husbandryCountByInstance={husbandryCountByInstance}
          instances={instancesQuery.data}
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
    </section>
  );
}

function ManagedPopulationsPanelHeader({
  canAdmin,
  instancesLoaded,
  queryClient,
  settlementId,
  worldId,
}: {
  readonly canAdmin: boolean;
  readonly instancesLoaded: boolean;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
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
        {canAdmin && instancesLoaded ? (
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

type StatusGroup = {
  readonly label: string;
  readonly status: ManagedPopulationInstanceStatus;
};

const STATUS_GROUPS: readonly StatusGroup[] = [
  { label: "Active", status: "active" },
  { label: "Extinct", status: "extinct" },
];

function ManagedPopulationsGroups({
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
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  function toggleGroup(label: string): void {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  return (
    <div className="grid gap-3">
      {STATUS_GROUPS.map((group) => {
        const groupInstances = instances.filter(
          (inst) => inst.status === group.status,
        );
        if (groupInstances.length === 0) return null;
        const isCollapsed = collapsedGroups.has(group.label);
        const panelId = `managed-populations-group-${group.label.toLowerCase()}`;
        return (
          <ManagedPopulationsStatusGroup
            key={group.label}
            canAdmin={canAdmin && group.status === "active"}
            canManage={canManage && group.status === "active"}
            husbandryCountByInstance={husbandryCountByInstance}
            instances={groupInstances}
            isCollapsed={isCollapsed}
            label={group.label}
            latestOutcome={latestOutcome}
            panelId={panelId}
            queryClient={queryClient}
            resourceById={resourceById}
            snapshotCounts={snapshotCounts}
            typeById={typeById}
            onToggle={() => {
              toggleGroup(group.label);
            }}
          />
        );
      })}
    </div>
  );
}

function ManagedPopulationsStatusGroup({
  canAdmin,
  canManage,
  husbandryCountByInstance,
  instances,
  isCollapsed,
  label,
  latestOutcome,
  onToggle,
  panelId,
  queryClient,
  resourceById,
  snapshotCounts,
  typeById,
}: {
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly husbandryCountByInstance: ReadonlyMap<string, number>;
  readonly instances: readonly ManagedPopulationInstance[];
  readonly isCollapsed: boolean;
  readonly label: string;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly onToggle: () => void;
  readonly panelId: string;
  readonly queryClient: QueryClient;
  readonly resourceById: ReadonlyMap<string, Resource>;
  readonly snapshotCounts: ManagedPopSnapshotCounts;
  readonly typeById: ReadonlyMap<string, ManagedPopulationType>;
}): JSX.Element {
  return (
    <div className="grid gap-1">
      <button
        aria-controls={panelId}
        aria-expanded={!isCollapsed}
        className="flex cursor-pointer items-center gap-1 text-left text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        type="button"
        onClick={onToggle}
      >
        {isCollapsed ? (
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        ) : (
          <ChevronDown aria-hidden="true" className="h-4 w-4" />
        )}
        {label} ({instances.length})
      </button>
      {!isCollapsed ? (
        <div id={panelId}>
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
                  husbandryCount={
                    husbandryCountByInstance.get(instance.id) ?? 0
                  }
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
        </div>
      ) : null}
    </div>
  );
}
