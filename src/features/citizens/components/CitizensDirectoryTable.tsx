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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { nationsListQueryOptions } from "@/features/nations";
import { settlementsByWorldQueryOptions } from "@/features/settlements";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getErrorDescription } from "@/lib/errorUtils";
import { cn } from "@/lib/utils";

import { citizensDirectoryQueryOptions } from "../queries/citizenDirectoryQueries";
import { formatOfficeTypesLabel } from "../utils/officeTypesLabel";

import { CitizenAvatar } from "./CitizenAvatar";

import type {
  CitizenDirectoryFilters,
  CitizenDirectoryRow,
  CitizenDirectorySortColumn,
} from "../queries/citizenDirectoryQueries";
import type { CitizenStatus, CitizenType } from "../types/citizenTypes";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

const PAGE_SIZE = 50;

const DEFAULT_SORTING: SortingState = [{ id: "name", desc: false }];

// Maps a DataTable column id to the citizen_directory_view column the
// server-side `.order()` call should use (see citizenDirectoryQueries.ts).
const SORT_COLUMN_BY_ID: Record<string, CitizenDirectorySortColumn> = {
  age: "age_turns",
  name: "name",
  nation: "nation_name",
  settlement: "settlement_name",
};

const COLUMNS: ColumnDef<CitizenDirectoryRow, unknown>[] = [
  {
    id: "name",
    accessorFn: (row) => row.name ?? "—",
    header: "Name",
    cell: ({ row }) => {
      const citizen = row.original;
      const isPlayerCharacter = citizen.citizenType === "player_character";
      const isDeceased = citizen.status === "dead";
      return (
        <>
          <CitizenAvatar
            id={citizen.id}
            name={citizen.name ?? "—"}
            size="sm"
            className={
              isPlayerCharacter
                ? "ring-2 ring-primary ring-offset-1"
                : undefined
            }
          />
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "font-medium",
                isDeceased && "text-muted-foreground",
              )}
            >
              {citizen.name ?? "—"}
            </span>
            {isPlayerCharacter ? <Badge variant="default">Player</Badge> : null}
            {isDeceased ? <Badge variant="destructive">Deceased</Badge> : null}
          </span>
        </>
      );
    },
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
              Works for the nation this turn — no settlement job output while in
              office.
            </TooltipContent>
          </Tooltip>
        );
      }
      return (
        <span className="text-muted-foreground">
          {row.original.assignmentLabel ?? "Unassigned"}
        </span>
      );
    },
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
  const [status, setStatus] = useState<CitizenStatus | undefined>("alive");
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
          value={nationId ?? "all"}
          onValueChange={(value) => {
            setNationId(value === "all" ? undefined : value);
            setSettlementId(undefined);
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
            {(nationId === undefined
              ? (settlementsQuery.data ?? [])
              : (settlementsQuery.data ?? []).filter(
                  (settlement) => settlement.nationId === nationId,
                )
            ).map((settlement) => (
              <SelectItem key={settlement.id} value={settlement.id}>
                {settlement.name}
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
        <TableSkeleton columnCount={6} rowCount={PAGE_SIZE} />
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
            rowClassName={(row) =>
              row.status === "dead" ? "opacity-70" : undefined
            }
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
            renderMobileCard={(row) => (
              <CitizenCard citizen={row} worldId={worldId} />
            )}
          />
        </>
      )}
    </div>
  );
}

function CitizenCard({
  citizen,
  worldId,
}: {
  readonly citizen: CitizenDirectoryRow;
  readonly worldId: string;
}): JSX.Element {
  const isPlayerCharacter = citizen.citizenType === "player_character";
  const isDeceased = citizen.status === "dead";
  const officeTypes = citizen.officeTypes;

  return (
    <Link
      to="/worlds/$worldId/citizens/$citizenId"
      params={{ citizenId: citizen.id, worldId }}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        isDeceased && "opacity-70",
      )}
    >
      <CitizenAvatar
        id={citizen.id}
        name={citizen.name ?? "—"}
        size="sm"
        className={
          isPlayerCharacter ? "ring-2 ring-primary ring-offset-1" : undefined
        }
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="truncate font-medium">{citizen.name ?? "—"}</span>
          {isPlayerCharacter ? <Badge variant="default">Player</Badge> : null}
          {isDeceased ? <Badge variant="destructive">Deceased</Badge> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {citizen.settlementName ?? "—"} · {citizen.nationName ?? "—"}
        </p>
        <p className="text-xs text-muted-foreground">
          Age {citizen.ageTurns ?? "—"} · {citizen.sex ?? "—"}
        </p>
        {officeTypes !== null ? (
          <Badge variant="outline" className="mt-1 cursor-default">
            In office: {formatOfficeTypesLabel(officeTypes)}
          </Badge>
        ) : (
          <p className="truncate text-xs text-muted-foreground">
            {citizen.assignmentLabel ?? "Unassigned"}
          </p>
        )}
      </div>
    </Link>
  );
}
