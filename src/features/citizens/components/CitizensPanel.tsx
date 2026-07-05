import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Skull, UserPlus } from "lucide-react";
import { useState, type JSX } from "react";

import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { settlementPopulationCapQueryOptions } from "@/features/settlements";
import { getErrorDescription } from "@/lib/errorUtils";
import { cn } from "@/lib/utils";

import { citizensDirectoryQueryOptions } from "../queries/citizenDirectoryQueries";
import { citizenAggregateStatsForSettlementQueryOptions } from "../queries/citizensQueries";

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

const SETTLEMENT_CITIZENS_COLUMNS: ColumnDef<CitizenDirectoryRow, unknown>[] = [
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
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.assignmentLabel === null ? "outline" : "secondary"
        }
      >
        {row.original.assignmentLabel ?? "Unassigned"}
      </Badge>
    ),
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
    id: "status",
    accessorFn: (row) => row.status,
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === "alive" ? "secondary" : "destructive"}
      >
        {STATUS_LABELS[row.original.status]}
      </Badge>
    ),
  },
];

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
    <Card aria-labelledby="citizens-panel-heading" className="grid gap-3">
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div className="space-y-1">
          <h2 id="citizens-panel-heading" className="text-base font-medium">
            Citizens
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
          <CitizensAggregateView settlementId={settlementId} />
        )}
      </CardContent>
    </Card>
  );
}

type CitizensCreateMode = "npc" | "player_character" | null;

function CitizensCreateActions({
  incestPreventionDepth,
  isArchived,
  settlementId,
  worldId,
}: {
  readonly incestPreventionDepth: number;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<CitizensCreateMode>(null);

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
      </div>
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
            columns={SETTLEMENT_CITIZENS_COLUMNS}
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
  settlementId,
}: {
  readonly settlementId: string;
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

  return <CitizensAggregateContent stats={aggregateQuery.data} />;
}

function CitizensAggregateContent({
  stats,
}: {
  readonly stats: CitizenAggregateStats;
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
        <ul aria-label="Assignment breakdown" className="grid gap-1.5">
          {ASSIGNMENT_BREAKDOWN_ORDER.map((key) => (
            <li
              key={key}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            >
              <span className="text-muted-foreground">
                {assignmentBreakdownLabel(key)}
              </span>
              <span className="font-medium tabular-nums">
                {stats.assignmentTypeBreakdown[key]}
              </span>
            </li>
          ))}
        </ul>
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
