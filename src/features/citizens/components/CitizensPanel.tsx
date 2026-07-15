import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { GraduationCap, Landmark, Skull, UserPlus } from "lucide-react";
import { useState, type JSX } from "react";

import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { culturesByWorldQueryOptions } from "@/features/cultures";
import { educationLevelsByWorldQueryOptions } from "@/features/education";
import { religionsByWorldQueryOptions } from "@/features/religions";
import { settlementPopulationCapQueryOptions } from "@/features/settlements";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

import {
  bulkSetCitizenCultureReligionMutationOptions,
  bulkSetCitizenEducationMutationOptions,
} from "../mutations/citizensMutations";
import { citizensDirectoryQueryOptions } from "../queries/citizenDirectoryQueries";
import { citizenAggregateStatsForSettlementQueryOptions } from "../queries/citizensQueries";
import { formatOfficeTypesLabel } from "../utils/officeTypesLabel";

import { CreateNpcDialog } from "./citizenCreation/CreateNpcDialog";
import { CreatePlayerCharacterDialog } from "./citizenCreation/CreatePlayerCharacterDialog";

import type {
  CitizenDirectoryFilters,
  CitizenDirectoryRow,
  CitizenDirectorySortColumn,
} from "../queries/citizenDirectoryQueries";
import type {
  CitizenAggregateStats,
  CitizenAssignmentType,
  CitizenStatus,
  CitizenType,
} from "../types/citizenTypes";
import type { QueryClient } from "@tanstack/react-query";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

type CitizensPanelProps = {
  readonly canAdmin: boolean;
  readonly incestPreventionDepth: number;
  readonly isArchived: boolean;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

const PAGE_SIZE = 25;

const CITIZEN_TYPE_LABELS: Record<CitizenType, string> = {
  npc: "NPC",
  player_character: "Player character",
};

const STATUS_LABELS: Record<CitizenStatus, string> = {
  alive: "Alive",
  dead: "Deceased",
};

const DEFAULT_SORTING: SortingState = [{ id: "name", desc: false }];

// Maps a DataTable column id to the citizen_directory_view column the
// server-side `.order()` call should use (see citizenDirectoryQueries.ts).
const SORT_COLUMN_BY_ID: Record<string, CitizenDirectorySortColumn> = {
  age: "age_turns",
  name: "name",
  status: "status",
};

function buildSettlementCitizensColumns(
  hasEducationLevels: boolean,
): ColumnDef<CitizenDirectoryRow, unknown>[] {
  return [
    {
      id: "name",
      accessorFn: (row) => row.name ?? "—",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name ?? "—"}</span>
      ),
    },
    {
      id: "age",
      accessorFn: (row) => row.ageTurns,
      header: "Age",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.ageTurns ?? "—"}
        </span>
      ),
    },
    {
      id: "sex",
      enableSorting: false,
      header: "Sex",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.sex ?? "—"}</span>
      ),
    },
    {
      id: "assignment",
      enableSorting: false,
      header: "Job / assignment",
      cell: ({ row }) => {
        const officeTypes = row.original.officeTypes;
        if (officeTypes !== null) {
          const officeLabel = formatOfficeTypesLabel(officeTypes);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="cursor-default">
                  In office: {officeLabel}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Works for the nation this turn — no settlement job output while
                in office.
              </TooltipContent>
            </Tooltip>
          );
        }
        return (
          <Badge
            variant={
              row.original.assignmentLabel === null ? "outline" : "secondary"
            }
          >
            {row.original.assignmentLabel ?? "Unassigned"}
          </Badge>
        );
      },
    },
    {
      id: "type",
      enableSorting: false,
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="secondary">
          {CITIZEN_TYPE_LABELS[row.original.citizenType]}
        </Badge>
      ),
    },
    {
      id: "education",
      enableSorting: false,
      header: "Education",
      cell: ({ row }) =>
        hasEducationLevels ? (
          <Badge
            variant={
              row.original.educationLevelName === null ? "outline" : "secondary"
            }
          >
            {row.original.educationLevelName ?? "Uneducated"}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      accessorFn: (row) => row.status,
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === "alive" ? "secondary" : "destructive"
          }
        >
          {STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
  ];
}

export function CitizensPanel({
  canAdmin,
  incestPreventionDepth,
  isArchived,
  nationId,
  settlementId,
  worldId,
}: CitizensPanelProps): JSX.Element {
  const [includeDead, setIncludeDead] = useState(false);

  const aggregateQuery = useQuery(
    citizenAggregateStatsForSettlementQueryOptions(settlementId),
  );
  const popCapQuery = useQuery(
    settlementPopulationCapQueryOptions(settlementId),
  );

  const livingCount = aggregateQuery.data?.statusBreakdown.alive ?? null;
  const popCap = popCapQuery.isSuccess ? popCapQuery.data : null;
  const atCap =
    livingCount !== null && popCap !== null && livingCount >= popCap;

  return (
    <Card
      aria-labelledby="citizens-panel-heading"
      className="grid min-w-0 grid-cols-1 gap-3"
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div className="space-y-1">
          <h2 id="citizens-panel-heading" className="text-base font-medium">
            {canAdmin ? "Citizens" : "Citizen summary"}
          </h2>
          {livingCount !== null ? (
            <p
              className={cn(
                "text-sm tabular-nums",
                atCap ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {livingCount}
              {popCap !== null ? ` / ${String(popCap)}` : null}
              {atCap ? " — at capacity" : null}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/assignments"
            params={{ nationId, settlementId, worldId }}
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            Job assignments →
          </Link>
          {canAdmin ? (
            <>
              {!includeDead ? (
                <CitizensCreateActions
                  canAdmin={canAdmin}
                  incestPreventionDepth={incestPreventionDepth}
                  isArchived={isArchived}
                  settlementId={settlementId}
                  worldId={worldId}
                />
              ) : null}
              <Button
                aria-label={includeDead ? "Hide deceased" : "Show deceased"}
                aria-pressed={includeDead}
                size="icon-sm"
                title={includeDead ? "Hide deceased" : "Show deceased"}
                type="button"
                variant={includeDead ? "secondary" : "ghost"}
                onClick={() => setIncludeDead(!includeDead)}
              >
                <Skull aria-hidden="true" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <CardContent>
        {canAdmin ? (
          <CitizensAdminList
            key={includeDead ? "dead" : "alive"}
            includeDead={includeDead}
            settlementId={settlementId}
            worldId={worldId}
          />
        ) : (
          <CitizensAggregateView
            nationId={nationId}
            settlementId={settlementId}
            worldId={worldId}
          />
        )}
      </CardContent>
    </Card>
  );
}

type CitizensCreateMode = "npc" | "player_character" | null;

function CitizensCreateActions({
  canAdmin,
  incestPreventionDepth,
  isArchived,
  settlementId,
  worldId,
}: {
  readonly canAdmin: boolean;
  readonly incestPreventionDepth: number;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<CitizensCreateMode>(null);
  const [isBulkCultureReligionOpen, setIsBulkCultureReligionOpen] =
    useState(false);
  const [isBulkEducationOpen, setIsBulkEducationOpen] = useState(false);

  const disabledReason = isArchived
    ? "Creating citizens is disabled because this world is archived."
    : undefined;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isArchived}
          title={disabledReason}
          aria-label="Create NPC"
          onClick={() => setMode("npc")}
        >
          <UserPlus aria-hidden="true" />
          Create NPC
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isArchived}
          title={disabledReason}
          aria-label="Create player character"
          onClick={() => setMode("player_character")}
        >
          <UserPlus aria-hidden="true" />
          Create player character
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isArchived}
          title={disabledReason}
          aria-label="Assign culture/religion to all citizens here"
          onClick={() => setIsBulkCultureReligionOpen(true)}
        >
          <Landmark aria-hidden="true" />
          Assign culture/religion to all
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isArchived}
          title={disabledReason}
          aria-label="Set education level for all citizens here"
          onClick={() => setIsBulkEducationOpen(true)}
        >
          <GraduationCap aria-hidden="true" />
          Set education level for all
        </Button>
      </div>
      {isBulkCultureReligionOpen ? (
        <BulkAssignCultureReligionDialog
          onClose={() => setIsBulkCultureReligionOpen(false)}
          queryClient={queryClient}
          settlementId={settlementId}
          worldId={worldId}
        />
      ) : null}
      {isBulkEducationOpen ? (
        <BulkSetEducationDialog
          onClose={() => setIsBulkEducationOpen(false)}
          queryClient={queryClient}
          settlementId={settlementId}
          worldId={worldId}
        />
      ) : null}
      {mode === "npc" ? (
        <CreateNpcDialog
          incestPreventionDepth={incestPreventionDepth}
          onClose={() => setMode(null)}
          onCreated={() => undefined}
          queryClient={queryClient}
          settlementId={settlementId}
          worldId={worldId}
        />
      ) : null}
      {mode === "player_character" ? (
        <CreatePlayerCharacterDialog
          canAdmin={canAdmin}
          incestPreventionDepth={incestPreventionDepth}
          onClose={() => setMode(null)}
          onCreated={() => undefined}
          queryClient={queryClient}
          settlementId={settlementId}
          worldId={worldId}
        />
      ) : null}
    </>
  );
}

function BulkAssignCultureReligionDialog({
  onClose,
  queryClient,
  settlementId,
  worldId,
}: {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const culturesQuery = useQuery(culturesByWorldQueryOptions(worldId));
  const religionsQuery = useQuery(religionsByWorldQueryOptions(worldId));
  const [cultureId, setCultureId] = useState<string | null>(null);
  const [religionId, setReligionId] = useState<string | null>(null);

  const bulkMutation = useMutation(
    bulkSetCitizenCultureReligionMutationOptions({ queryClient }),
  );

  function handleSubmit(): void {
    bulkMutation.mutate(
      { cultureId, religionId, settlementId },
      {
        onError: (error) => {
          notifyMutationError(
            error,
            "Failed to assign culture/religion to citizens.",
          );
        },
        onSuccess: (citizens) => {
          notifyMutationSuccess(
            `Updated ${citizens.length.toString()} citizen(s).`,
          );
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Assign culture/religion to all citizens here
          </DialogTitle>
          <DialogDescription>
            Applies to every alive citizen in this settlement. Leaving a field
            unset leaves that field untouched on each citizen.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Culture</span>
            <NativeSelect
              aria-label="Culture"
              disabled={bulkMutation.isPending}
              value={cultureId ?? ""}
              onChange={(event) => {
                const next = event.currentTarget.value;
                setCultureId(next === "" ? null : next);
              }}
            >
              <option value="">Leave untouched</option>
              {culturesQuery.data?.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </NativeSelect>
          </Label>
          <Label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Religion</span>
            <NativeSelect
              aria-label="Religion"
              disabled={bulkMutation.isPending}
              value={religionId ?? ""}
              onChange={(event) => {
                const next = event.currentTarget.value;
                setReligionId(next === "" ? null : next);
              }}
            >
              <option value="">Leave untouched</option>
              {religionsQuery.data?.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </NativeSelect>
          </Label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              bulkMutation.isPending ||
              (cultureId === null && religionId === null)
            }
            onClick={handleSubmit}
          >
            {bulkMutation.isPending ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkSetEducationDialog({
  onClose,
  queryClient,
  settlementId,
  worldId,
}: {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const educationLevelsQuery = useQuery(
    educationLevelsByWorldQueryOptions(worldId),
  );
  const educationLevels = educationLevelsQuery.data ?? [];
  const noEducationSystem =
    educationLevelsQuery.isSuccess && educationLevels.length === 0;
  const [educationLevelId, setEducationLevelId] = useState<string | null>(null);

  const bulkMutation = useMutation(
    bulkSetCitizenEducationMutationOptions({ queryClient }),
  );

  function handleSubmit(): void {
    bulkMutation.mutate(
      { educationLevelId, settlementId },
      {
        onError: (error) => {
          notifyMutationError(
            error,
            "Failed to set education level for citizens.",
          );
        },
        onSuccess: (citizens) => {
          notifyMutationSuccess(
            `Updated ${citizens.length.toString()} citizen(s).`,
          );
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set education level for all citizens here</DialogTitle>
          <DialogDescription>
            Applies to every alive citizen in this settlement.
          </DialogDescription>
        </DialogHeader>
        {noEducationSystem ? (
          <p className="text-sm italic text-muted-foreground">
            No education system configured for this world.
          </p>
        ) : (
          <div className="grid gap-3">
            <Label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Education level</span>
              <NativeSelect
                aria-label="Education level"
                disabled={bulkMutation.isPending}
                value={educationLevelId ?? ""}
                onChange={(event) => {
                  const next = event.currentTarget.value;
                  setEducationLevelId(next === "" ? null : next);
                }}
              >
                <option value="">Uneducated</option>
                {educationLevels.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </NativeSelect>
            </Label>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={bulkMutation.isPending || noEducationSystem}
            onClick={handleSubmit}
          >
            {bulkMutation.isPending ? "Setting…" : "Set"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CitizensAdminList({
  includeDead,
  settlementId,
  worldId,
}: {
  readonly includeDead: boolean;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const [pageIndex, setPageIndex] = useState(0);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);

  const educationLevelsQuery = useQuery(
    educationLevelsByWorldQueryOptions(worldId),
  );
  const hasEducationLevels = (educationLevelsQuery.data?.length ?? 0) > 0;

  const activeSort = sorting[0];
  const order =
    activeSort !== undefined
      ? {
          ascending: !activeSort.desc,
          column: SORT_COLUMN_BY_ID[activeSort.id],
        }
      : undefined;

  const filters: CitizenDirectoryFilters = {
    order,
    settlementId,
    status: includeDead ? "dead" : "alive",
  };

  const citizensQuery = useQuery(
    citizensDirectoryQueryOptions(worldId, filters, {
      pageIndex,
      pageSize: PAGE_SIZE,
    }),
  );

  const rows = citizensQuery.data?.rows ?? [];
  const totalCount = citizensQuery.data?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (citizensQuery.isPending) {
    return <TableSkeleton columnCount={6} rowCount={5} />;
  }

  if (citizensQuery.isError) {
    return (
      <ErrorState
        title="Citizens could not be loaded"
        description={getErrorDescription(citizensQuery.error)}
      />
    );
  }

  return (
    <div className="grid gap-3">
      {rows.length === 0 ? (
        <EmptyState
          title={includeDead ? "No citizens yet" : "No living citizens"}
          description={
            includeDead
              ? "Citizens added to this settlement will appear here."
              : "Toggle the skull icon in the header to see deceased citizens."
          }
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground" role="status">
            {`Showing ${(pageIndex * PAGE_SIZE + 1).toString()}–${(
              pageIndex * PAGE_SIZE +
              rows.length
            ).toString()} of ${totalCount.toString()}`}
          </p>

          <DataTable
            columns={buildSettlementCitizensColumns(hasEducationLevels)}
            data={rows}
            getRowId={(row) => row.id}
            sorting={sorting}
            onSortingChange={(nextSorting) => {
              setSorting(nextSorting);
              setPageIndex(0);
            }}
            pageIndex={pageIndex}
            pageCount={pageCount}
            onPageChange={setPageIndex}
            isPaginationDisabled={citizensQuery.isFetching}
            renderRowLink={(row, children) => (
              <Link
                to="/worlds/$worldId/citizens/$citizenId"
                params={{ citizenId: row.id, worldId }}
                className="flex items-center gap-2 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {children}
              </Link>
            )}
          />
        </>
      )}
    </div>
  );
}

// The aggregate view enforces the "DB access, UI aggregates" policy: Nation
// Managers and Settlement Managers have RLS-level read access to individual
// citizen rows, but this UI never renders rows for non-admins. If a future
// feature needs per-citizen detail for those roles, reuse the existing
// citizensInSettlementQueryOptions query — no schema or RLS change required.
function CitizensAggregateView({
  nationId,
  settlementId,
  worldId,
}: {
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const aggregateQuery = useQuery(
    citizenAggregateStatsForSettlementQueryOptions(settlementId),
  );

  if (aggregateQuery.isPending) {
    return <LoadingState label="Loading citizen summary…" />;
  }

  if (aggregateQuery.isError) {
    return (
      <ErrorState
        title="Citizen summary could not be loaded"
        description={getErrorDescription(aggregateQuery.error)}
      />
    );
  }

  return (
    <CitizensAggregateContent
      nationId={nationId}
      settlementId={settlementId}
      stats={aggregateQuery.data}
      worldId={worldId}
    />
  );
}

function CitizensAggregateContent({
  nationId,
  settlementId,
  stats,
  worldId,
}: {
  readonly nationId: string;
  readonly settlementId: string;
  readonly stats: CitizenAggregateStats;
  readonly worldId: string;
}): JSX.Element {
  const aliveTotal = stats.statusBreakdown.alive;

  if (stats.total === 0) {
    return (
      <EmptyState
        title="No citizens yet"
        description="Counts appear here once citizens are added to this settlement."
      />
    );
  }

  const segments = ASSIGNMENT_BREAKDOWN_ORDER.map((key) => ({
    count: stats.assignmentTypeBreakdown[key],
    key,
    label: assignmentBreakdownLabel(key),
  })).filter((segment) => segment.count > 0);
  const assignedTotal = segments.reduce(
    (sum, segment) => sum + segment.count,
    0,
  );
  const unassignedCount = stats.assignmentTypeBreakdown.unassigned;
  const showUnassignedWarning =
    assignedTotal > 0 &&
    unassignedCount / assignedTotal >= UNASSIGNED_WARNING_RATIO;

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Stat label="Living citizens" value={aliveTotal} />
        <Stat
          label="Player characters"
          value={stats.typeBreakdown.player_character}
        />
      </dl>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Assignments</p>
        {assignedTotal > 0 ? (
          <>
            <div
              aria-label={segments
                .map((segment) => `${segment.label}: ${String(segment.count)}`)
                .join(", ")}
              className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
              role="img"
            >
              {segments.map((segment) => (
                <div
                  key={segment.key}
                  className={cn(
                    "h-full first:rounded-l-full last:rounded-r-full",
                    ASSIGNMENT_SEGMENT_COLORS[segment.key],
                  )}
                  style={{
                    width: `${String((segment.count / assignedTotal) * 100)}%`,
                  }}
                />
              ))}
            </div>
            <ul
              aria-label="Assignment breakdown"
              className="flex flex-wrap gap-x-4 gap-y-1"
            >
              {segments.map((segment) => (
                <li
                  key={segment.key}
                  className="flex items-center gap-1.5 text-sm"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2.5 rounded-full",
                      ASSIGNMENT_SEGMENT_COLORS[segment.key],
                    )}
                  />
                  <span className="text-muted-foreground">{segment.label}</span>
                  <span className="font-medium tabular-nums">
                    {segment.count}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {showUnassignedWarning ? (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/assignments"
            params={{ nationId, settlementId, worldId }}
            className="flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
          >
            <span>{unassignedCount} unassigned — assign jobs</span>
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-medium tabular-nums">{value}</dd>
    </div>
  );
}

// Categorical palette validated for CVD safety at both light and dark surfaces
// (see dataviz skill palette reference); "unassigned" uses a neutral tone so it
// reads as absence-of-assignment rather than another job category.
const ASSIGNMENT_SEGMENT_COLORS: Record<
  CitizenAssignmentType | "unassigned",
  string
> = {
  standard_job: "bg-[#2a78d6] dark:bg-[#3987e5]",
  construction_project: "bg-[#1baf7a] dark:bg-[#199e70]",
  deposit: "bg-[#eda100] dark:bg-[#c98500]",
  husbandry: "bg-[#008300] dark:bg-[#008300]",
  culling: "bg-[#4a3aa7] dark:bg-[#9085e9]",
  trade_route: "bg-[#e87ba4] dark:bg-[#d55181]",
  unassigned: "bg-muted-foreground/40",
};

// Assignment mix warrants a prominent CTA once unassigned citizens make up at
// least half of the assigned+unassigned living population.
const UNASSIGNED_WARNING_RATIO = 0.5;

const ASSIGNMENT_BREAKDOWN_ORDER: ReadonlyArray<
  CitizenAssignmentType | "unassigned"
> = [
  "standard_job",
  "construction_project",
  "deposit",
  "husbandry",
  "culling",
  "trade_route",
  "unassigned",
];

function assignmentBreakdownLabel(
  key: CitizenAssignmentType | "unassigned",
): string {
  if (key === "unassigned") {
    return "Unassigned";
  }
  return assignmentTypeLabel(key);
}

function assignmentTypeLabel(type: CitizenAssignmentType): string {
  switch (type) {
    case "construction_project":
      return "Construction";
    case "culling":
      return "Culling";
    case "deposit":
      return "Deposit";
    case "husbandry":
      return "Husbandry";
    case "standard_job":
      return "Standard job";
    case "trade_route":
      return "Trade route";
  }
}
