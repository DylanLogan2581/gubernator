import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useId, useState, type JSX } from "react";

import { DialogShell } from "@/components/shared/DialogShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { citizenAggregateStatsForSettlementQueryOptions } from "@/features/citizens";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { manualDeconstructBuildingMutationOptions } from "../mutations/settlementBuildingsMutations";
import { settlementBuildingsBySettlementQueryOptions } from "../queries/settlementBuildingsQueries";
import { settlementPopulationCapQueryOptions } from "../queries/settlementPopulationCapQueries";
import { tierEffectsToState } from "../utils/tierEditorUtils";

import type {
  SettlementBuilding,
  SettlementBuildingState,
} from "../types/settlementBuildingTypes";

type SettlementBuildingsPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
};

export function SettlementBuildingsPanel({
  canAdmin,
  isArchived,
  settlementId,
}: SettlementBuildingsPanelProps): JSX.Element {
  const buildingsQuery = useQuery(
    settlementBuildingsBySettlementQueryOptions(settlementId),
  );
  const capQuery = useQuery(settlementPopulationCapQueryOptions(settlementId));
  const citizensQuery = useQuery(
    citizenAggregateStatsForSettlementQueryOptions(settlementId),
  );
  const queryClient = useQueryClient();

  const capValue = capQuery.data ?? 0;
  const citizenCount = citizensQuery.data?.statusBreakdown.alive ?? 0;

  return (
    <section
      aria-labelledby="settlement-buildings-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-col gap-1">
        <h2 id="settlement-buildings-heading" className="text-base font-medium">
          Buildings
        </h2>
        <p className="text-sm text-muted-foreground">
          {capQuery.isPending || citizensQuery.isPending ? (
            "Loading population cap…"
          ) : capQuery.isError || citizensQuery.isError ? (
            "Population cap unavailable"
          ) : (
            <>
              Population cap:{" "}
              <span className="font-medium text-foreground">{capValue}</span>{" "}
              (citizens:{" "}
              <span className="font-medium text-foreground">
                {citizenCount}
              </span>
              )
            </>
          )}
        </p>
      </div>

      {buildingsQuery.isPending ? (
        <LoadingState label="Loading buildings…" />
      ) : buildingsQuery.isError ? (
        <ErrorState
          title="Buildings could not be loaded"
          description={getErrorDescription(buildingsQuery.error)}
        />
      ) : buildingsQuery.data.length === 0 ? (
        <EmptyState
          title="No buildings"
          description="This settlement has no buildings."
        />
      ) : (
        <BuildingsGroups
          buildings={buildingsQuery.data}
          canAdmin={canAdmin}
          isArchived={isArchived}
          queryClient={queryClient}
          settlementId={settlementId}
        />
      )}
    </section>
  );
}

type StateGroup = {
  readonly label: string;
  readonly states: readonly SettlementBuildingState[];
};

const STATE_GROUPS: readonly StateGroup[] = [
  { label: "Active", states: ["active"] },
  { label: "Suspended", states: ["suspended"] },
  {
    label: "Deconstructed",
    states: ["manually_deconstructed", "auto_deconstructed"],
  },
];

function BuildingsGroups({
  buildings,
  canAdmin,
  isArchived,
  queryClient,
  settlementId,
}: {
  readonly buildings: readonly SettlementBuilding[];
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
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

  const canDeconstruct = canAdmin && !isArchived;

  return (
    <div className="grid gap-3">
      {STATE_GROUPS.map((group) => {
        const groupBuildings = buildings.filter((b) =>
          (group.states as readonly string[]).includes(b.state),
        );
        if (groupBuildings.length === 0) return null;
        const isCollapsed = collapsedGroups.has(group.label);
        const panelId = `buildings-group-${group.label.toLowerCase()}`;
        return (
          <BuildingStateGroup
            key={group.label}
            canDeconstruct={canDeconstruct && group.states.includes("active")}
            buildings={groupBuildings}
            isCollapsed={isCollapsed}
            label={group.label}
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

function BuildingStateGroup({
  buildings,
  canDeconstruct,
  isCollapsed,
  label,
  onToggle,
  panelId,
  queryClient,
  settlementId,
}: {
  readonly buildings: readonly SettlementBuilding[];
  readonly canDeconstruct: boolean;
  readonly isCollapsed: boolean;
  readonly label: string;
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
        {label} ({buildings.length})
      </button>
      {!isCollapsed ? (
        <div id={panelId}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 font-medium" scope="col">
                  Building
                </th>
                <th className="pb-2 font-medium" scope="col">
                  Tier
                </th>
                <th className="pb-2 font-medium" scope="col">
                  Effects
                </th>
                <th className="w-16 pb-2" scope="col" aria-label="State" />
                {canDeconstruct ? (
                  <th className="w-28 pb-2" scope="col" aria-label="Actions" />
                ) : null}
              </tr>
            </thead>
            <tbody>
              {buildings.map((building) => (
                <BuildingRow
                  key={building.id}
                  building={building}
                  canDeconstruct={canDeconstruct}
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

function buildEffectsSummary(building: SettlementBuilding): string {
  const rows = tierEffectsToState(building.effectsJson);
  const parts: string[] = [];
  for (const row of rows) {
    switch (row.effectType) {
      case "population_cap_increase":
        parts.push(`cap +${row.amount}`);
        break;
      case "job_capacity_increase":
        parts.push(`job +${row.amount} for ${row.jobId}`);
        break;
      case "resource_storage_increase":
        parts.push(`storage +${row.amount} for ${row.resourceId}`);
        break;
      case "passive_resource_production":
        parts.push(`passive +${row.amount}/turn of ${row.resourceId}`);
        break;
      case "":
        break;
      default: {
        const _exhaustive: never = row.effectType;
        throw new Error(`Unknown effect type: ${String(_exhaustive)}`);
      }
    }
  }
  return parts.length > 0 ? parts.join(", ") : "—";
}

type StateBadgeVariant = "default" | "secondary" | "outline" | "destructive";

function stateBadgeVariant(state: SettlementBuildingState): StateBadgeVariant {
  switch (state) {
    case "active":
      return "default";
    case "suspended":
      return "outline";
    case "manually_deconstructed":
    case "auto_deconstructed":
      return "secondary";
  }
}

function stateBadgeLabel(state: SettlementBuildingState): string {
  switch (state) {
    case "active":
      return "active";
    case "suspended":
      return "suspended";
    case "manually_deconstructed":
      return "deconstructed";
    case "auto_deconstructed":
      return "auto-deconstructed";
  }
}

function BuildingRow({
  building,
  canDeconstruct,
  queryClient,
  settlementId,
}: {
  readonly building: SettlementBuilding;
  readonly canDeconstruct: boolean;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const effectsSummary = buildEffectsSummary(building);
  const showDeconstructButton = canDeconstruct && building.state === "active";

  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="py-2 pr-4">{building.blueprintName}</td>
        <td className="py-2 pr-4">Tier {building.tierNumber}</td>
        <td className="py-2 pr-4 text-muted-foreground">{effectsSummary}</td>
        <td className="w-16 py-2 pr-2">
          <Badge
            aria-label={`State: ${stateBadgeLabel(building.state)}`}
            variant={stateBadgeVariant(building.state)}
          >
            {stateBadgeLabel(building.state)}
          </Badge>
        </td>
        {canDeconstruct ? (
          <td className="w-28 py-2 text-right">
            {showDeconstructButton ? (
              <Button
                aria-label={`Deconstruct ${building.blueprintName}`}
                size="sm"
                type="button"
                variant="destructive"
                onClick={() => {
                  setConfirmOpen(true);
                }}
              >
                Deconstruct
              </Button>
            ) : null}
          </td>
        ) : null}
      </tr>
      {confirmOpen ? (
        <DeconstructConfirmDialog
          building={building}
          queryClient={queryClient}
          settlementId={settlementId}
          onClose={() => {
            setConfirmOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function DeconstructConfirmDialog({
  building,
  onClose,
  queryClient,
  settlementId,
}: {
  readonly building: SettlementBuilding;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const titleId = useId();
  const deconstructMutation = useMutation(
    manualDeconstructBuildingMutationOptions({ queryClient, settlementId }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await deconstructMutation.mutateAsync({
        settlementBuildingId: building.id,
      });
      notifyMutationSuccess("Building deconstructed.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to deconstruct building.");
    }
  }

  return (
    <DialogShell>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="grid w-full max-w-sm gap-4 rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-lg font-semibold">
            Deconstruct {building.blueprintName}?
          </h3>
          <Button
            aria-label="Cancel deconstruct"
            disabled={deconstructMutation.isPending}
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          This will permanently deconstruct{" "}
          <span className="font-medium text-foreground">
            {building.blueprintName}
          </span>{" "}
          (Tier {building.tierNumber}). This action cannot be undone.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            disabled={deconstructMutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={deconstructMutation.isPending}
            type="button"
            variant="destructive"
            onClick={() => {
              void handleConfirm();
            }}
          >
            Deconstruct
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}
