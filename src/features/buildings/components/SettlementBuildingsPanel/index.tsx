import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ChevronDown, Eye, Plus } from "lucide-react";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { IconChip } from "@/components/shared/IconChip";
import { resolveEntityIcon } from "@/components/shared/iconPicker/CuratedIcons";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateProjectDialog } from "@/features/construction";
import { activeJobsByWorldQueryOptions } from "@/features/jobs";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import {
  useSettlementTransitionOutcome,
  type TurnTransitionOutcome,
} from "@/features/turns";
import { resolveIconTone } from "@/lib/categoricalPalette";
import { getErrorDescription } from "@/lib/errorUtils";

import { settlementBuildingsBySettlementQueryOptions } from "../../queries/settlementBuildingsQueries";
import {
  buildEffectChips,
  stateBadgeLabel,
  stateBadgeVariant,
} from "../../utils/buildingStateFormatting";

import { AddBuildingDialog } from "./AddBuildingDialog";
import { BuildingRow } from "./BuildingRow";

import type {
  SettlementBuilding,
  SettlementBuildingState,
} from "../../types/settlementBuildingTypes";

const DECONSTRUCTED_STATES: readonly SettlementBuildingState[] = [
  "manually_deconstructed",
  "auto_deconstructed",
];

type SettlementBuildingsPanelProps = {
  readonly canAdmin: boolean;
  readonly canManageSettlement: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementBuildingsPanel({
  canAdmin,
  canManageSettlement,
  isArchived,
  settlementId,
  worldId,
}: SettlementBuildingsPanelProps): JSX.Element {
  const [addOpen, setAddOpen] = useState(false);
  const [startConstructionOpen, setStartConstructionOpen] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const buildingsQuery = useQuery(
    settlementBuildingsBySettlementQueryOptions(settlementId),
  );
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const jobsQuery = useQuery(activeJobsByWorldQueryOptions(worldId));
  const latestOutcome = useSettlementTransitionOutcome(settlementId);
  const queryClient = useQueryClient();

  const canAdd = canAdmin && !isArchived;
  const canStartConstruction = canManageSettlement && !isArchived;

  const resourceNames = new Map(
    (resourcesQuery.data ?? []).map((r) => [r.id, r.name]),
  );
  const jobNames = new Map((jobsQuery.data ?? []).map((j) => [j.id, j.name]));

  const deconstructedCount = (buildingsQuery.data ?? []).filter((b) =>
    DECONSTRUCTED_STATES.includes(b.state),
  ).length;

  return (
    <section
      aria-labelledby="settlement-buildings-heading"
      className="grid min-w-0 gap-3"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="settlement-buildings-heading"
            className="text-base font-medium"
          >
            Buildings
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {canStartConstruction ? (
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() => {
                  setStartConstructionOpen(true);
                }}
              >
                <Plus aria-hidden="true" />
                Start construction
              </Button>
            ) : null}
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
            {deconstructedCount > 0 ? (
              <Button
                aria-pressed={showTrash}
                size="sm"
                type="button"
                variant={showTrash ? "secondary" : "outline"}
                onClick={() => {
                  setShowTrash((prev) => !prev);
                }}
              >
                <Eye aria-hidden="true" />
                {showTrash
                  ? "Hide deconstructed"
                  : `Show deconstructed (${deconstructedCount})`}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        {buildingsQuery.isPending ? (
          <TableSkeleton columnCount={6} rowCount={5} />
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
            canManageSettlement={canManageSettlement}
            isArchived={isArchived}
            jobNames={jobNames}
            latestOutcome={latestOutcome}
            queryClient={queryClient}
            resourceNames={resourceNames}
            settlementId={settlementId}
            showTrash={showTrash}
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

        {startConstructionOpen ? (
          <CreateProjectDialog
            queryClient={queryClient}
            settlementId={settlementId}
            worldId={worldId}
            onClose={() => {
              setStartConstructionOpen(false);
            }}
          />
        ) : null}
      </div>
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
    label: "Trash",
    states: ["manually_deconstructed", "auto_deconstructed"],
  },
];

function BuildingsGroups({
  buildings,
  canAdmin,
  canManageSettlement,
  isArchived,
  jobNames,
  latestOutcome,
  queryClient,
  resourceNames,
  settlementId,
  showTrash,
  worldId,
}: {
  readonly buildings: readonly SettlementBuilding[];
  readonly canAdmin: boolean;
  readonly canManageSettlement: boolean;
  readonly isArchived: boolean;
  readonly jobNames: ReadonlyMap<string, string>;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly resourceNames: ReadonlyMap<string, string>;
  readonly settlementId: string;
  readonly showTrash: boolean;
  readonly worldId: string;
}): JSX.Element {
  const canDeconstruct = canAdmin && !isArchived;
  const visibleStateGroups = STATE_GROUPS.filter(
    (group) => showTrash || group.label !== "Trash",
  );

  return (
    <div className="grid min-w-0 gap-3">
      {visibleStateGroups.map((group) => {
        const groupBuildings = buildings.filter((b) =>
          (group.states as readonly string[]).includes(b.state),
        );
        if (groupBuildings.length === 0) return null;
        return (
          <BuildingStateGroup
            key={group.label}
            canAdmin={canAdmin && !isArchived}
            canDeconstruct={canDeconstruct && group.states.includes("active")}
            canManageSettlement={canManageSettlement}
            buildings={groupBuildings}
            isArchived={isArchived}
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

function duplicateGroupKey(building: SettlementBuilding): string {
  return [
    building.name ?? building.blueprintName,
    building.buildingBlueprintId,
    building.currentTierId,
    building.state,
  ].join("|");
}

type DuplicateBuildingGroup = {
  readonly key: string;
  readonly buildings: readonly SettlementBuilding[];
};

function groupIdenticalBuildings(
  buildings: readonly SettlementBuilding[],
): readonly DuplicateBuildingGroup[] {
  const groups = new Map<string, SettlementBuilding[]>();
  for (const building of buildings) {
    const key = duplicateGroupKey(building);
    const existing = groups.get(key);
    if (existing !== undefined) {
      existing.push(building);
    } else {
      groups.set(key, [building]);
    }
  }
  return [...groups.entries()].map(([key, groupBuildings]) => ({
    key,
    buildings: groupBuildings,
  }));
}

function BuildingStateGroup({
  buildings,
  canAdmin,
  canDeconstruct,
  canManageSettlement,
  isArchived,
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
  readonly canManageSettlement: boolean;
  readonly isArchived: boolean;
  readonly jobNames: ReadonlyMap<string, string>;
  readonly label: string;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly resourceNames: ReadonlyMap<string, string>;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const showTierColumn = new Set(buildings.map((b) => b.tierNumber)).size > 1;
  const duplicateGroups = groupIdenticalBuildings(buildings);
  // The actions column shows for world admins (deconstruct/restore) and for
  // settlement managers (upgrade) alike.
  const showActionsColumn = canAdmin || (canManageSettlement && !isArchived);

  return (
    <Collapsible defaultOpen className="grid min-w-0 gap-1">
      <CollapsibleTrigger className="group flex cursor-pointer items-center gap-1 text-left text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 -rotate-90 transition-transform group-data-[state=open]:rotate-0"
        />
        {label} ({buildings.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="overflow-x-auto rounded-md border">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="text-muted-foreground">
                <TableHead scope="col">Building</TableHead>
                <TableHead className="w-12" scope="col">
                  Count
                </TableHead>
                {showTierColumn ? (
                  <TableHead scope="col">Tier</TableHead>
                ) : null}
                <TableHead scope="col">Effects</TableHead>
                <TableHead className="w-16" scope="col" aria-label="State" />
                {showActionsColumn ? (
                  <TableHead
                    className="w-28"
                    scope="col"
                    aria-label="Actions"
                  />
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {duplicateGroups.map((group) =>
                group.buildings.length === 1 ? (
                  <BuildingRow
                    key={group.buildings[0].id}
                    building={group.buildings[0]}
                    canAdmin={canAdmin}
                    canDeconstruct={canDeconstruct}
                    canManageSettlement={canManageSettlement}
                    isArchived={isArchived}
                    jobNames={jobNames}
                    latestOutcome={latestOutcome}
                    queryClient={queryClient}
                    resourceNames={resourceNames}
                    settlementId={settlementId}
                    showTierColumn={showTierColumn}
                    worldId={worldId}
                  />
                ) : (
                  <DuplicateBuildingGroupRows
                    key={group.key}
                    buildings={group.buildings}
                    canAdmin={canAdmin}
                    canDeconstruct={canDeconstruct}
                    canManageSettlement={canManageSettlement}
                    isArchived={isArchived}
                    jobNames={jobNames}
                    latestOutcome={latestOutcome}
                    queryClient={queryClient}
                    resourceNames={resourceNames}
                    settlementId={settlementId}
                    showTierColumn={showTierColumn}
                    worldId={worldId}
                  />
                ),
              )}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DuplicateBuildingGroupRows({
  buildings,
  canAdmin,
  canDeconstruct,
  canManageSettlement,
  isArchived,
  jobNames,
  latestOutcome,
  queryClient,
  resourceNames,
  settlementId,
  showTierColumn,
  worldId,
}: {
  readonly buildings: readonly SettlementBuilding[];
  readonly canAdmin: boolean;
  readonly canDeconstruct: boolean;
  readonly canManageSettlement: boolean;
  readonly isArchived: boolean;
  readonly jobNames: ReadonlyMap<string, string>;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly resourceNames: ReadonlyMap<string, string>;
  readonly settlementId: string;
  readonly showTierColumn: boolean;
  readonly worldId: string;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const showActionsColumn = canAdmin || (canManageSettlement && !isArchived);
  const first = buildings[0];
  const name = first.name ?? first.blueprintName;
  const effectChips = buildEffectChips(first, resourceNames, jobNames);
  const showStateBadge = first.state !== "active";

  return (
    <>
      <TableRow className="border-b border-border">
        <TableCell className="py-2 pr-4">
          <Button
            aria-expanded={expanded}
            size="sm"
            type="button"
            variant="ghost"
            className="h-6 gap-2 px-0"
            onClick={() => {
              setExpanded((prev) => !prev);
            }}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              <ChevronDown
                aria-hidden="true"
                className={expanded ? "h-4 w-4" : "h-4 w-4 -rotate-90"}
              />
            </span>
            <IconChip
              icon={resolveEntityIcon(first.blueprintIcon)}
              tone={resolveIconTone(
                first.blueprintIconColor,
                first.buildingBlueprintId,
              )}
            />
            {name}
          </Button>
        </TableCell>
        <TableCell className="w-12 py-2 pr-4">
          <Badge variant="secondary">{buildings.length}</Badge>
        </TableCell>
        {showTierColumn ? (
          <TableCell className="py-2 pr-4">Tier {first.tierNumber}</TableCell>
        ) : null}
        <TableCell className="py-2 pr-4">
          {effectChips.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {effectChips.map((chip) => (
                <Badge key={chip.key} variant="outline">
                  {chip.label}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="w-16 py-2 pr-2">
          {showStateBadge ? (
            <Badge
              aria-label={`State: ${stateBadgeLabel(first.state)}`}
              variant={stateBadgeVariant(first.state)}
            >
              {stateBadgeLabel(first.state)}
            </Badge>
          ) : null}
        </TableCell>
        {showActionsColumn ? <TableCell className="w-28 py-2" /> : null}
      </TableRow>
      {expanded
        ? buildings.map((building) => (
            <BuildingRow
              key={building.id}
              building={building}
              canAdmin={canAdmin}
              canDeconstruct={canDeconstruct}
              canManageSettlement={canManageSettlement}
              isArchived={isArchived}
              jobNames={jobNames}
              latestOutcome={latestOutcome}
              queryClient={queryClient}
              resourceNames={resourceNames}
              settlementId={settlementId}
              showTierColumn={showTierColumn}
              worldId={worldId}
            />
          ))
        : null}
    </>
  );
}
