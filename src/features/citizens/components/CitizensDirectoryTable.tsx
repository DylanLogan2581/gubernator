import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { TablePagination } from "@/components/shared/TablePagination";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nationsListQueryOptions } from "@/features/nations";
import { settlementsByWorldQueryOptions } from "@/features/settlements";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getErrorDescription } from "@/lib/errorUtils";

import { citizensDirectoryQueryOptions } from "../queries/citizenDirectoryQueries";

import { CitizenAvatar } from "./CitizenAvatar";

import type {
  CitizenDirectoryFilters,
  CitizenDirectoryRow,
} from "../queries/citizenDirectoryQueries";
import type { CitizenStatus, CitizenType } from "../types/citizenTypes";

const PAGE_SIZE = 25;

const CITIZEN_TYPE_LABELS: Record<CitizenType, string> = {
  npc: "NPC",
  player_character: "Player character",
};

const STATUS_LABELS: Record<CitizenStatus, string> = {
  alive: "Alive",
  dead: "Deceased",
};

type CitizensDirectoryTableProps = {
  readonly worldId: string;
};

// World-level citizen directory (#989). Filtering, search, and pagination
// are all pushed server-side via citizensDirectoryQueryOptions — the client
// only ever holds the current page of rows, not the whole world's roster.
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

  const debouncedSearch = useDebouncedValue(search, 300);

  const nationsQuery = useQuery(nationsListQueryOptions(worldId));
  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));

  const filters: CitizenDirectoryFilters = {
    citizenType,
    nationId,
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
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>Settlement</TableHead>
                  <TableHead>Nation</TableHead>
                  <TableHead>Job / assignment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <CitizenDirectoryRowItem
                    key={row.id}
                    row={row}
                    worldId={worldId}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground" role="status">
              {`Showing ${(pageIndex * PAGE_SIZE + 1).toString()}–${(
                pageIndex * PAGE_SIZE +
                rows.length
              ).toString()} of ${totalCount.toString()}`}
            </p>
            <TablePagination
              page={pageIndex}
              pageCount={pageCount}
              onPageChange={setPageIndex}
            />
          </div>
        </>
      )}
    </div>
  );
}

function CitizenDirectoryRowItem({
  row,
  worldId,
}: {
  readonly row: CitizenDirectoryRow;
  readonly worldId: string;
}): JSX.Element {
  const navigate = useNavigate();

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted"
      onClick={() => {
        void navigate({
          to: "/worlds/$worldId/citizens/$citizenId",
          params: { citizenId: row.id, worldId },
        });
      }}
    >
      <TableCell className="font-medium">
        <span className="flex items-center gap-2">
          <CitizenAvatar id={row.id} name={row.name ?? "—"} size="sm" />
          {row.name ?? "—"}
        </span>
      </TableCell>
      <TableCell className="tabular-nums text-muted-foreground">
        {row.ageTurns ?? "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">{row.sex ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">
        {row.settlementName ?? "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {row.nationName ?? "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {row.assignmentLabel ?? "Unassigned"}
      </TableCell>
      <TableCell>
        <Badge variant="secondary">
          {CITIZEN_TYPE_LABELS[row.citizenType]}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={row.status === "alive" ? "secondary" : "destructive"}>
          {STATUS_LABELS[row.status]}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
