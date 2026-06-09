import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { settlementTargetAssignmentsQueryOptions } from "@/features/citizens";
import {
  useSettlementTransitionOutcome,
  type TurnTransitionOutcome,
} from "@/features/turns";
import { getErrorDescription } from "@/lib/errorUtils";

import { depositInstancesBySettlementQueryOptions } from "../../queries/depositInstancesQueries";

import { AddDepositInstanceDialog } from "./AddDepositInstanceDialog";
import { DepositInstanceRow } from "./DepositInstanceRow";

import type {
  DepositInstance,
  DepositInstanceStatus,
} from "../../types/depositInstanceTypes";

type SettlementDepositsPanelProps = {
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementDepositsPanel({
  canAdmin,
  canManage,
  isArchived,
  settlementId,
  worldId,
}: SettlementDepositsPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const [showRemoved, setShowRemoved] = useState(false);
  const instancesQuery = useQuery(
    depositInstancesBySettlementQueryOptions(settlementId),
  );
  const assignmentsQuery = useQuery(
    settlementTargetAssignmentsQueryOptions(settlementId),
  );
  const latestOutcome = useSettlementTransitionOutcome(settlementId);

  const assignedCountByInstance = new Map<string, number>();
  if (assignmentsQuery.data !== undefined) {
    for (const a of assignmentsQuery.data) {
      if (a.assignmentType === "deposit" && a.depositInstance !== null) {
        const id = a.depositInstance.id;
        assignedCountByInstance.set(
          id,
          (assignedCountByInstance.get(id) ?? 0) + 1,
        );
      }
    }
  }

  const visibleInstances =
    instancesQuery.data?.filter(
      (instance) => showRemoved || instance.status !== "removed",
    ) ?? [];

  return (
    <Card aria-labelledby="settlement-deposits-heading" className="grid gap-3">
      <div className="px-4 pt-4">
        <DepositsPanelHeader
          canAdmin={canAdmin && !isArchived}
          instancesLoaded={!instancesQuery.isPending}
          queryClient={queryClient}
          settlementId={settlementId}
          showRemoved={showRemoved}
          worldId={worldId}
          onToggleRemoved={() => {
            setShowRemoved((prev) => !prev);
          }}
        />
      </div>

      <CardContent>
        {instancesQuery.isPending ? (
          <LoadingState label="Loading deposits…" />
        ) : instancesQuery.isError ? (
          <ErrorState
            title="Deposits could not be loaded"
            description={getErrorDescription(instancesQuery.error)}
          />
        ) : instancesQuery.data.length === 0 ? (
          <EmptyState
            title="No deposits"
            description="This settlement has no deposit instances."
          />
        ) : visibleInstances.length === 0 ? (
          <EmptyState
            description="This settlement has no active or depleted deposit instances."
            title="No visible deposits"
          />
        ) : (
          <DepositsGroups
            assignedCountByInstance={assignedCountByInstance}
            canAdmin={canAdmin && !isArchived}
            canManage={(canManage || canAdmin) && !isArchived}
            instances={instancesQuery.data}
            latestOutcome={latestOutcome}
            queryClient={queryClient}
            settlementId={settlementId}
            showRemoved={showRemoved}
          />
        )}
      </CardContent>
    </Card>
  );
}

function DepositsPanelHeader({
  canAdmin,
  instancesLoaded,
  queryClient,
  settlementId,
  showRemoved,
  worldId,
  onToggleRemoved,
}: {
  readonly canAdmin: boolean;
  readonly instancesLoaded: boolean;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly showRemoved: boolean;
  readonly worldId: string;
  readonly onToggleRemoved: () => void;
}): JSX.Element {
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 id="settlement-deposits-heading" className="text-base font-medium">
          Deposits
        </h2>
        <div className="flex items-center gap-2">
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
              Add deposit instance
            </Button>
          ) : null}
          {instancesLoaded ? (
            <Button
              aria-label={showRemoved ? "Hide removed" : "Show removed"}
              aria-pressed={showRemoved}
              size="icon-sm"
              title={showRemoved ? "Hide removed" : "Show removed"}
              type="button"
              variant={showRemoved ? "secondary" : "ghost"}
              onClick={onToggleRemoved}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
      {showAddDialog ? (
        <AddDepositInstanceDialog
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
  readonly statuses: readonly DepositInstanceStatus[];
};

const STATUS_GROUPS: readonly StatusGroup[] = [
  { label: "Active", statuses: ["active"] },
  { label: "Depleted", statuses: ["depleted"] },
  { label: "Removed", statuses: ["removed"] },
];

function DepositsGroups({
  assignedCountByInstance,
  canAdmin,
  canManage,
  instances,
  latestOutcome,
  queryClient,
  settlementId,
  showRemoved,
}: {
  readonly assignedCountByInstance: ReadonlyMap<string, number>;
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly instances: readonly DepositInstance[];
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly showRemoved: boolean;
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

  const visibleGroups = STATUS_GROUPS.filter(
    (g) => !g.statuses.includes("removed") || showRemoved,
  );

  return (
    <div className="grid gap-3">
      {visibleGroups.map((group) => {
        const isRemovedGroup = group.statuses.includes("removed");
        const groupInstances = instances.filter((inst) =>
          (group.statuses as readonly string[]).includes(inst.status),
        );
        if (groupInstances.length === 0) return null;
        const isCollapsed = collapsedGroups.has(group.label);
        const panelId = `deposits-group-${group.label.toLowerCase()}`;
        return (
          <DepositsStatusGroup
            key={group.label}
            assignedCountByInstance={assignedCountByInstance}
            canAdmin={
              canAdmin && (group.statuses.includes("active") || isRemovedGroup)
            }
            canManage={canManage && group.statuses.includes("active")}
            instances={groupInstances}
            isCollapsed={isCollapsed}
            label={group.label}
            latestOutcome={latestOutcome}
            panelId={panelId}
            queryClient={queryClient}
            settlementId={settlementId}
            onToggle={() => {
              toggleGroup(group.label);
            }}
          />
        );
      })}
    </div>
  );
}

function DepositsStatusGroup({
  assignedCountByInstance,
  canAdmin,
  canManage,
  instances,
  isCollapsed,
  label,
  latestOutcome,
  onToggle,
  panelId,
  queryClient,
  settlementId,
}: {
  readonly assignedCountByInstance: ReadonlyMap<string, number>;
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly instances: readonly DepositInstance[];
  readonly isCollapsed: boolean;
  readonly label: string;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly onToggle: () => void;
  readonly panelId: string;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
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
                  Resources
                </th>
                <th className="pb-2 font-medium" scope="col">
                  Workers
                </th>
                {canAdmin || canManage ? (
                  <th
                    aria-label="Actions"
                    className="w-[18rem] pb-2"
                    scope="col"
                  />
                ) : null}
              </tr>
            </thead>
            <tbody>
              {instances.map((instance) => (
                <DepositInstanceRow
                  key={instance.id}
                  assignedCount={assignedCountByInstance.get(instance.id) ?? 0}
                  canAdmin={canAdmin}
                  canManage={canManage}
                  instance={instance}
                  latestOutcome={latestOutcome}
                  queryClient={queryClient}
                  settlementId={settlementId}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
