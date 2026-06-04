import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { citizenAggregateStatsForSettlementQueryOptions } from "@/features/citizens";
import { activeJobsByWorldQueryOptions } from "@/features/jobs";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import {
  latestSettlementTransitionOutcomeQueryOptions,
  type TurnTransitionOutcome,
} from "@/features/turns";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import {
  parseBuildingAutoDeconstructedPayload,
  parseBuildingSuspendedPayload,
} from "@/shared/simulation";

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
  readonly worldId: string;
};

export function SettlementBuildingsPanel({
  canAdmin,
  isArchived,
  settlementId,
  worldId,
}: SettlementBuildingsPanelProps): JSX.Element {
  const buildingsQuery = useQuery(
    settlementBuildingsBySettlementQueryOptions(settlementId),
  );
  const capQuery = useQuery(settlementPopulationCapQueryOptions(settlementId));
  const citizensQuery = useQuery(
    citizenAggregateStatsForSettlementQueryOptions(settlementId),
  );
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const jobsQuery = useQuery(activeJobsByWorldQueryOptions(worldId));
  const latestOutcomeQuery = useQuery(
    latestSettlementTransitionOutcomeQueryOptions(settlementId),
  );
  const queryClient = useQueryClient();

  const capValue = capQuery.data ?? 0;
  const citizenCount = citizensQuery.data?.statusBreakdown.alive ?? 0;

  const resourceNames = new Map(
    (resourcesQuery.data ?? []).map((r) => [r.id, r.name]),
  );
  const jobNames = new Map((jobsQuery.data ?? []).map((j) => [j.id, j.name]));

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
          jobNames={jobNames}
          latestOutcome={latestOutcomeQuery.data ?? null}
          queryClient={queryClient}
          resourceNames={resourceNames}
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
  jobNames,
  latestOutcome,
  queryClient,
  resourceNames,
  settlementId,
}: {
  readonly buildings: readonly SettlementBuilding[];
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly jobNames: ReadonlyMap<string, string>;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly resourceNames: ReadonlyMap<string, string>;
  readonly settlementId: string;
}): JSX.Element {
  const canDeconstruct = canAdmin && !isArchived;

  return (
    <div className="grid gap-3">
      {STATE_GROUPS.map((group) => {
        const groupBuildings = buildings.filter((b) =>
          (group.states as readonly string[]).includes(b.state),
        );
        if (groupBuildings.length === 0) return null;
        return (
          <BuildingStateGroup
            key={group.label}
            canDeconstruct={canDeconstruct && group.states.includes("active")}
            buildings={groupBuildings}
            jobNames={jobNames}
            label={group.label}
            latestOutcome={latestOutcome}
            queryClient={queryClient}
            resourceNames={resourceNames}
            settlementId={settlementId}
          />
        );
      })}
    </div>
  );
}

function BuildingStateGroup({
  buildings,
  canDeconstruct,
  jobNames,
  label,
  latestOutcome,
  queryClient,
  resourceNames,
  settlementId,
}: {
  readonly buildings: readonly SettlementBuilding[];
  readonly canDeconstruct: boolean;
  readonly jobNames: ReadonlyMap<string, string>;
  readonly label: string;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly resourceNames: ReadonlyMap<string, string>;
  readonly settlementId: string;
}): JSX.Element {
  return (
    <Collapsible defaultOpen className="grid gap-1">
      <CollapsibleTrigger className="group flex cursor-pointer items-center gap-1 text-left text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 -rotate-90 transition-transform group-data-[state=open]:rotate-0"
        />
        {label} ({buildings.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
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
                jobNames={jobNames}
                latestOutcome={latestOutcome}
                queryClient={queryClient}
                resourceNames={resourceNames}
                settlementId={settlementId}
              />
            ))}
          </tbody>
        </table>
      </CollapsibleContent>
    </Collapsible>
  );
}

function buildEffectsSummary(
  building: SettlementBuilding,
  resourceNames: ReadonlyMap<string, string>,
  jobNames: ReadonlyMap<string, string>,
): string {
  const rows = tierEffectsToState(building.effectsJson);
  const parts: string[] = [];
  for (const row of rows) {
    switch (row.effectType) {
      case "population_cap_increase":
        parts.push(`cap +${row.amount}`);
        break;
      case "job_capacity_increase":
        parts.push(
          `job +${row.amount} for ${jobNames.get(row.jobId) ?? row.jobId}`,
        );
        break;
      case "resource_storage_increase":
        parts.push(
          `storage +${row.amount} for ${resourceNames.get(row.resourceId) ?? row.resourceId}`,
        );
        break;
      case "passive_resource_production":
        parts.push(
          `passive +${row.amount}/turn of ${resourceNames.get(row.resourceId) ?? row.resourceId}`,
        );
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

type StateBadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "destructive"
  | "warning";

function stateBadgeVariant(state: SettlementBuildingState): StateBadgeVariant {
  switch (state) {
    case "active":
      return "default";
    case "suspended":
      return "warning";
    case "manually_deconstructed":
      return "secondary";
    case "auto_deconstructed":
      return "destructive";
  }
}

function stateBadgeLabel(state: SettlementBuildingState): string {
  switch (state) {
    case "active":
      return "active";
    case "suspended":
      return "Suspended";
    case "manually_deconstructed":
      return "deconstructed";
    case "auto_deconstructed":
      return "Auto-deconstructed";
  }
}

function buildStateBadgeTooltip(
  building: SettlementBuilding,
  latestOutcome: TurnTransitionOutcome | null,
): string | undefined {
  if (
    building.state !== "suspended" &&
    building.state !== "auto_deconstructed"
  ) {
    return undefined;
  }

  const logEntry = latestOutcome?.logEntries.find((e) => {
    if (e.logCategory === "building.auto_deconstructed") {
      return (
        parseBuildingAutoDeconstructedPayload(e.payloadJsonb)?.buildingId ===
        building.id
      );
    }
    if (e.logCategory === "building.suspended") {
      return (
        parseBuildingSuspendedPayload(e.payloadJsonb)?.buildingId ===
        building.id
      );
    }
    return false;
  });

  if (logEntry !== undefined && latestOutcome !== null) {
    const parts = [`Turn ${latestOutcome.toTurnNumber}`];
    if (logEntry.logCategory === "building.auto_deconstructed") {
      const payload = parseBuildingAutoDeconstructedPayload(
        logEntry.payloadJsonb,
      );
      if (payload !== null) {
        parts.push(`missed upkeep ${payload.missedUpkeepCount}×`);
        parts.push(`grace period: ${payload.gracePeriodTurns} turns`);
        return parts.join(" · ");
      }
    } else {
      const payload = parseBuildingSuspendedPayload(logEntry.payloadJsonb);
      if (payload !== null) {
        parts.push(`missed upkeep ${payload.missedUpkeepCount}×`);
        return parts.join(" · ");
      }
    }
  }

  return `Missed upkeep ${building.missedUpkeepCount}×`;
}

function BuildingRow({
  building,
  canDeconstruct,
  jobNames,
  latestOutcome,
  queryClient,
  resourceNames,
  settlementId,
}: {
  readonly building: SettlementBuilding;
  readonly canDeconstruct: boolean;
  readonly jobNames: ReadonlyMap<string, string>;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly resourceNames: ReadonlyMap<string, string>;
  readonly settlementId: string;
}): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const effectsSummary = buildEffectsSummary(building, resourceNames, jobNames);
  const showDeconstructButton = canDeconstruct && building.state === "active";
  const stateTooltip = buildStateBadgeTooltip(building, latestOutcome);

  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="py-2 pr-4">{building.blueprintName}</td>
        <td className="py-2 pr-4">Tier {building.tierNumber}</td>
        <td className="py-2 pr-4 text-muted-foreground">{effectsSummary}</td>
        <td className="w-16 py-2 pr-2">
          <Badge
            aria-label={`State: ${stateBadgeLabel(building.state)}`}
            title={stateTooltip}
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deconstruct {building.blueprintName}?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          This will permanently deconstruct{" "}
          <span className="font-medium text-foreground">
            {building.blueprintName}
          </span>{" "}
          (Tier {building.tierNumber}). This action cannot be undone.
        </DialogDescription>
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
