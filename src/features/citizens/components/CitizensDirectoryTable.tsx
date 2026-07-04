import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type JSX } from "react";

import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { nationsListQueryOptions } from "@/features/nations";
import { settlementsByWorldQueryOptions } from "@/features/settlements";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getErrorDescription } from "@/lib/errorUtils";

import { citizensDirectoryQueryOptions } from "../queries/citizenDirectoryQueries";

import { CitizenAvatar } from "./CitizenAvatar";

import type {
  CitizenDirectoryFilters,
  CitizenDirectoryRow,
  CitizenDirectorySortColumn,
} from "../queries/citizenDirectoryQueries";
import type { CitizenStatus, CitizenType } from "../types/citizenTypes";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

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
  nation: "nation_name",
  settlement: "settlement_name",
  status: "status",
};

const COLUMNS: ColumnDef<CitizenDirectoryRow, unknown>[] = [
  {
    id: "name",
    accessorFn: (row) => row.name ?? "—",
    header: "Name",
    cell: ({ row }) => (
      <>
        <CitizenAvatar
          id={row.original.id}
          name={row.original.name ?? "—"}
          size="sm"
        />
        <span className="font-medium">{row.original.name ?? "—"}</span>
      </>
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
    id: "settlement",
    accessorFn: (row) => row.settlementName ?? "—",
    header: "Settlement",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.settlementName ?? "—"}
      </span>
    ),
  },
  {
    id: "nation",
    accessorFn: (row) => row.nationName ?? "—",
    header: "Nation",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.nationName ?? "—"}
      </span>
    ),
  },
  {
    id: "assignment",
    enableSorting: false,
    header: "Job / assignment",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.assignmentLabel ?? "Unassigned"}
      </span>
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

type CitizensDirectoryTableProps = {
  readonly worldId: string;
};

// World-level citizen directory (#989, sortable via #1002). Filtering,
// sorting, and pagination are all pushed server-side via
// citizensDirectoryQueryOptions — the client only ever holds the current
// page of rows, not the whole world's roster.
export function CitizensDirectoryTable({
  worldId,
}: CitizensDirectoryTableProps): JSX.Element {
  const [search, setSearch] = useState("");
  const [settlementId, setSettlementId] = useState<string | undefined>(
    undefined,
  );
  const [nationId, setNationId] = useState<string | undefined>(undefined);
  const [citizenType, setCitizenType] = useState<CitizenType | undefined>(
    undefined,
  );
  const [status, setStatus] = useState<CitizenStatus | undefined>(undefined);
  const [pageIndex, setPageIndex] = useState(0);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);

  const debouncedSearch = useDebouncedValue(search, 300);

  const nationsQuery = useQuery(nationsListQueryOptions(worldId));
  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));

  const activeSort = sorting[0];
  const order =
    activeSort !== undefined
      ? {
          ascending: !activeSort.desc,
          column: SORT_COLUMN_BY_ID[activeSort.id],
        }
      : undefined;

  const filters: CitizenDirectoryFilters = {
    citizenType,
    nationId,
    order,
    search: debouncedSearch,
    settlementId,
    status,
  };

  const directoryQuery = useQuery(
    citizensDirectoryQueryOptions(worldId, filters, {
      pageIndex,
      pageSize: PAGE_SIZE,
    }),
  );

  function resetToFirstPage(): void {
    setPageIndex(0);
  }

  const rows = directoryQuery.data?.rows ?? [];
  const totalCount = directoryQuery.data?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          aria-label="Search citizens by name"
          className="sm:w-[220px]"
          placeholder="Search by name…"
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            resetToFirstPage();
          }}
        />

        <Select
          value={settlementId ?? "all"}
          onValueChange={(value) => {
            setSettlementId(value === "all" ? undefined : value);
            resetToFirstPage();
          }}
        >
          <SelectTrigger
            className="sm:w-[200px]"
            aria-label="Filter by settlement"
          >
            <SelectValue placeholder="All settlements" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All settlements</SelectItem>
            {(settlementsQuery.data ?? []).map((settlement) => (
              <SelectItem key={settlement.id} value={settlement.id}>
                {settlement.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={nationId ?? "all"}
          onValueChange={(value) => {
            setNationId(value === "all" ? undefined : value);
            resetToFirstPage();
          }}
        >
          <SelectTrigger className="sm:w-[180px]" aria-label="Filter by nation">
            <SelectValue placeholder="All nations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All nations</SelectItem>
            {(nationsQuery.data ?? []).map((nation) => (
              <SelectItem key={nation.id} value={nation.id}>
                {nation.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={citizenType ?? "all"}
          onValueChange={(value) => {
            setCitizenType(
              value === "all" ? undefined : (value as CitizenType),
            );
            resetToFirstPage();
          }}
        >
          <SelectTrigger
            className="sm:w-[170px]"
            aria-label="Filter by PC or NPC"
          >
            <SelectValue placeholder="PC / NPC" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All citizens</SelectItem>
            <SelectItem value="player_character">Player characters</SelectItem>
            <SelectItem value="npc">NPCs</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={status ?? "all"}
          onValueChange={(value) => {
            setStatus(value === "all" ? undefined : (value as CitizenStatus));
            resetToFirstPage();
          }}
        >
          <SelectTrigger className="sm:w-[150px]" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="alive">Alive</SelectItem>
            <SelectItem value="dead">Deceased</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {directoryQuery.isPending ? (
        <TableSkeleton columnCount={8} rowCount={PAGE_SIZE} />
      ) : directoryQuery.isError ? (
        <ErrorState
          title="Citizens could not be loaded"
          description={getErrorDescription(directoryQuery.error)}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No citizens found"
          description="Try widening your filters or search."
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
            columns={COLUMNS}
            data={rows}
            getRowId={(row) => row.id}
            sorting={sorting}
            onSortingChange={(nextSorting) => {
              setSorting(nextSorting);
              resetToFirstPage();
            }}
            pageIndex={pageIndex}
            pageCount={pageCount}
            onPageChange={setPageIndex}
            isPaginationDisabled={directoryQuery.isFetching}
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
