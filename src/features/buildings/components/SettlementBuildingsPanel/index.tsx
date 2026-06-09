import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ChevronDown, Plus } from "lucide-react";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { activeJobsByWorldQueryOptions } from "@/features/jobs";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import {
  useSettlementTransitionOutcome,
  type TurnTransitionOutcome,
} from "@/features/turns";
import { getErrorDescription } from "@/lib/errorUtils";

import { settlementBuildingsBySettlementQueryOptions } from "../../queries/settlementBuildingsQueries";

import { AddBuildingDialog } from "./AddBuildingDialog";
import { BuildingRow } from "./BuildingRow";

import type {
  SettlementBuilding,
  SettlementBuildingState,
} from "../../types/settlementBuildingTypes";

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
  const [addOpen, setAddOpen] = useState(false);
  const buildingsQuery = useQuery(
    settlementBuildingsBySettlementQueryOptions(settlementId),
  );
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const jobsQuery = useQuery(activeJobsByWorldQueryOptions(worldId));
  const latestOutcome = useSettlementTransitionOutcome(settlementId);
  const queryClient = useQueryClient();

  const canAdd = canAdmin && !isArchived;

  const resourceNames = new Map(
    (resourcesQuery.data ?? []).map((r) => [r.id, r.name]),
  );
  const jobNames = new Map((jobsQuery.data ?? []).map((j) => [j.id, j.name]));

  return (
    <Card aria-labelledby="settlement-buildings-heading" className="grid gap-3">
      <div className="flex flex-col gap-1 px-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="settlement-buildings-heading"
            className="text-base font-medium"
          >
            Buildings
          </h2>
          {canAdd ? (
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                setAddOpen(true);
              }}
            >
              <Plus aria-hidden="true" />
              Add building
            </Button>
          ) : null}
        </div>
      </div>

      <CardContent>
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
            latestOutcome={latestOutcome}
            queryClient={queryClient}
            resourceNames={resourceNames}
            settlementId={settlementId}
            worldId={worldId}
          />
        )}

        {addOpen ? (
          <AddBuildingDialog
            queryClient={queryClient}
            settlementId={settlementId}
            worldId={worldId}
            onClose={() => {
              setAddOpen(false);
            }}
          />
        ) : null}
      </CardContent>
    </Card>
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
    label: "Trash",
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
  worldId,
}: {
  readonly buildings: readonly SettlementBuilding[];
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly jobNames: ReadonlyMap<string, string>;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly resourceNames: ReadonlyMap<string, string>;
  readonly settlementId: string;
  readonly worldId: string;
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
            canAdmin={canAdmin && !isArchived}
            canDeconstruct={canDeconstruct && group.states.includes("active")}
            buildings={groupBuildings}
            jobNames={jobNames}
            label={group.label}
            latestOutcome={latestOutcome}
            queryClient={queryClient}
            resourceNames={resourceNames}
            settlementId={settlementId}
            worldId={worldId}
          />
        );
      })}
    </div>
  );
}

function BuildingStateGroup({
  buildings,
  canAdmin,
  canDeconstruct,
  jobNames,
  label,
  latestOutcome,
  queryClient,
  resourceNames,
  settlementId,
  worldId,
}: {
  readonly buildings: readonly SettlementBuilding[];
  readonly canAdmin: boolean;
  readonly canDeconstruct: boolean;
  readonly jobNames: ReadonlyMap<string, string>;
  readonly label: string;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly resourceNames: ReadonlyMap<string, string>;
  readonly settlementId: string;
  readonly worldId: string;
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
              {canAdmin ? (
                <th className="w-28 pb-2" scope="col" aria-label="Actions" />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {buildings.map((building) => (
              <BuildingRow
                key={building.id}
                building={building}
                canAdmin={canAdmin}
                canDeconstruct={canDeconstruct}
                jobNames={jobNames}
                latestOutcome={latestOutcome}
                queryClient={queryClient}
                resourceNames={resourceNames}
                settlementId={settlementId}
                worldId={worldId}
              />
            ))}
          </tbody>
        </table>
      </CollapsibleContent>
    </Collapsible>
  );
}
