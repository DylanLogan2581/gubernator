import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { TablePagination } from "@/components/shared/TablePagination";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { entityRoute } from "@/lib/entityRoutes";

import { useTurnLogEntityLookup } from "../../hooks/useTurnLogEntityLookup";
import {
  TURN_LOG_PAGE_SIZE,
  type TurnLogBrowserEntry,
} from "../../queries/turnLogBrowserQueries";
import {
  aggregateJobProcessedRows,
  summarizeJobBreakdown,
  type TurnLogRow,
} from "../../utils/aggregateJobProcessedRows";
import { formatResourceDeltas } from "../../utils/formatResourceDeltas";
import { isTurnLogRowExpandable } from "../../utils/isTurnLogRowExpandable";
import { logCategoryLabel } from "../../utils/logCategoryLabels";

import { EntityRef } from "./EntityRef";
import { TurnLogPayloadRenderer } from "./TurnLogPayloadRenderer";

import type { TurnLogEntityLookup } from "../../hooks/useTurnLogEntityLookup";
import type { JSX } from "react";

// ---------------------------------------------------------------------------
// Scope cell — links to settlement / nation / citizen pages
// ---------------------------------------------------------------------------

function ScopeCell({
  entry,
  worldId,
}: {
  readonly entry: TurnLogBrowserEntry;
  readonly worldId: string;
}): JSX.Element {
  const parts: JSX.Element[] = [];

  if (entry.settlementId !== null) {
    // Prefer the log entry's own nation_id; fall back to the nation_id carried
    // by the joined settlement row (settlement always has a nation).
    const resolvedNationId = entry.nationId ?? entry.settlementNationId;

    parts.push(
      <EntityRef
        key="settlement"
        name={entry.settlementName}
        href={entityRoute(worldId, {
          kind: "settlement",
          nationId: resolvedNationId,
          settlementId: entry.settlementId,
        })}
        kindLabel="Settlement"
      />,
    );
  }

  if (entry.nationId !== null && entry.settlementId === null) {
    parts.push(
      <EntityRef
        key="nation"
        name={entry.nationName}
        href={entityRoute(worldId, {
          kind: "nation",
          nationId: entry.nationId,
        })}
        kindLabel="Nation"
      />,
    );
  }

  if (entry.citizenId !== null) {
    parts.push(
      <EntityRef
        key="citizen"
        name={entry.citizenName}
        href={entityRoute(worldId, {
          kind: "citizen",
          citizenId: entry.citizenId,
        })}
        kindLabel="Citizen"
      />,
    );
  }

  if (parts.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return <span className="flex flex-wrap gap-1">{parts}</span>;
}

// ---------------------------------------------------------------------------
// Job summary — aggregated standard_job.processed rows
// ---------------------------------------------------------------------------

function JobSummaryDetail({
  entries,
  lookup,
}: {
  readonly entries: readonly TurnLogBrowserEntry[];
  readonly lookup: TurnLogEntityLookup;
}): JSX.Element {
  const breakdown = summarizeJobBreakdown(entries);

  return (
    <ul className="space-y-1 text-sm">
      {breakdown.map((row) => {
        const consumed = formatResourceDeltas(row.inputsConsumed, "-", lookup);
        const produced = formatResourceDeltas(row.outputsProduced, "+", lookup);
        const deltas = [consumed, produced].filter(Boolean).join(", ");
        return (
          <li key={row.jobId}>
            <strong>{lookup.jobName(row.jobId) ?? "Unknown job"}</strong> —{" "}
            {row.workerCount} workers
            {deltas !== "" ? ` — ${deltas}` : null}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Expanded row
// ---------------------------------------------------------------------------

function ExpandedDetailRow({
  colSpan,
  isAdmin,
  lookup,
  row,
}: {
  readonly colSpan: number;
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly row: TurnLogRow;
}): JSX.Element {
  return (
    <tr className="bg-muted/30">
      <td colSpan={colSpan} className="px-4 py-2">
        <div className="text-sm">
          {row.kind === "job-summary" ? (
            <JobSummaryDetail entries={row.entries} lookup={lookup} />
          ) : row.kind === "category-summary" ? (
            <ul className="space-y-1">
              {row.entries.map((entry) => (
                <li key={entry.id}>
                  <TurnLogPayloadRenderer
                    logCategory={entry.logCategory}
                    payload={entry.payloadJsonb}
                    isAdmin={isAdmin}
                    lookup={lookup}
                    mode="summary"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <TurnLogPayloadRenderer
              logCategory={row.entry.logCategory}
              payload={row.entry.payloadJsonb}
              isAdmin={isAdmin}
              lookup={lookup}
              mode="expanded"
            />
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------

function rowId(row: TurnLogRow): string {
  return row.kind === "entry" ? row.entry.id : row.id;
}

function rowScopeEntry(row: TurnLogRow): TurnLogBrowserEntry {
  return row.kind === "entry" ? row.entry : row.representativeEntry;
}

function isRowExpandable(row: TurnLogRow, isAdmin: boolean): boolean {
  if (row.kind === "job-summary" || row.kind === "category-summary") {
    return true;
  }
  return isTurnLogRowExpandable(
    row.entry.logCategory,
    row.entry.payloadJsonb,
    isAdmin,
  );
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function buildColumns(
  worldId: string,
  isAdmin: boolean,
  lookup: TurnLogEntityLookup,
  hideTurnColumn: boolean,
): ColumnDef<TurnLogRow>[] {
  const columns: ColumnDef<TurnLogRow>[] = [
    {
      id: "expand",
      header: "",
      cell: () => null,
      size: 32,
    },
  ];

  if (!hideTurnColumn) {
    columns.push({
      id: "turn",
      header: "Turn",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {rowScopeEntry(row.original).toTurnNumber}
        </span>
      ),
      size: 64,
    });
  }

  columns.push(
    {
      id: "category",
      header: "Category",
      cell: ({ row }) => {
        const original = row.original;
        const logCategory =
          original.kind === "entry"
            ? original.entry.logCategory
            : original.kind === "category-summary"
              ? original.logCategory
              : "standard_job.processed";
        return (
          <Badge variant="outline" className="font-mono text-xs">
            {logCategoryLabel(logCategory)}
          </Badge>
        );
      },
      size: 220,
    },
    {
      id: "scope",
      header: "Scope",
      cell: ({ row }) => (
        <ScopeCell entry={rowScopeEntry(row.original)} worldId={worldId} />
      ),
      size: 140,
    },
    {
      id: "summary",
      header: "Summary",
      cell: ({ row }) => {
        const original = row.original;
        if (original.kind === "job-summary") {
          return (
            <span className="text-sm">
              <strong>{original.count}</strong> jobs processed —{" "}
              {original.representativeEntry.settlementName ??
                "Unknown settlement"}
            </span>
          );
        }
        if (original.kind === "category-summary") {
          const label = logCategoryLabel(original.logCategory);
          return (
            <span className="text-sm">
              <strong>{label}</strong> ×{original.count}
            </span>
          );
        }
        return (
          <TurnLogPayloadRenderer
            logCategory={original.entry.logCategory}
            payload={original.entry.payloadJsonb}
            isAdmin={isAdmin}
            lookup={lookup}
            mode="summary"
          />
        );
      },
    },
  );

  return columns;
}

// ---------------------------------------------------------------------------
// Table component
// ---------------------------------------------------------------------------

type TurnLogTableProps = {
  readonly entries: readonly TurnLogBrowserEntry[];
  // Hides the redundant Turn column when the caller has pinned the log to a
  // single turn (e.g. the default "latest turn" view) — every row would
  // otherwise repeat the same value.
  readonly hideTurnColumn?: boolean;
  readonly isAdmin: boolean;
  readonly isFetching: boolean;
  readonly onPageChange: (page: number) => void;
  readonly page: number;
  readonly totalCount: number;
  readonly worldId: string;
};

export function TurnLogTable({
  entries,
  hideTurnColumn = false,
  isAdmin,
  isFetching,
  onPageChange,
  page,
  totalCount,
  worldId,
}: TurnLogTableProps): JSX.Element {
  // Keyed by the entry/synthetic-row id (stable across pages), not the
  // table's positional row index.
  const [expandedRows, setExpandedRows] = useState<Set<string>>(
    () => new Set(),
  );

  const lookup = useTurnLogEntityLookup(worldId, entries);
  const rows = useMemo(() => aggregateJobProcessedRows(entries), [entries]);
  const columns = useMemo(
    () => buildColumns(worldId, isAdmin, lookup, hideTurnColumn),
    [worldId, isAdmin, lookup, hideTurnColumn],
  );
  const pageCount = Math.ceil(totalCount / TURN_LOG_PAGE_SIZE);

  // eslint-disable-next-line react-hooks/incompatible-library -- useReactTable is a TanStack Table hook, not a React hook
  const table = useReactTable({
    data: rows as TurnLogRow[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: rowId,
    manualPagination: true,
    rowCount: totalCount,
    state: {
      pagination: {
        pageIndex: page,
        pageSize: TURN_LOG_PAGE_SIZE,
      },
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex: page, pageSize: TURN_LOG_PAGE_SIZE })
          : updater;
      onPageChange(next.pageIndex);
    },
  });

  function toggleRow(id: string): void {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const from = page * TURN_LOG_PAGE_SIZE + 1;
  const to = Math.min((page + 1) * TURN_LOG_PAGE_SIZE, totalCount);

  return (
    <div className="space-y-2">
      <div className="relative overflow-x-auto rounded-md border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden"
        />
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.column.columnDef.size }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  {isFetching
                    ? "Loading…"
                    : "No log entries match the current filters."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const expandable = isRowExpandable(row.original, isAdmin);
                const isExpanded = expandable && expandedRows.has(row.id);
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      data-state={
                        expandable
                          ? isExpanded
                            ? "expanded"
                            : "collapsed"
                          : undefined
                      }
                      className={expandable ? "cursor-pointer" : undefined}
                      onClick={expandable ? () => toggleRow(row.id) : undefined}
                    >
                      <TableCell className="w-8 pr-0">
                        {expandable ? (
                          isExpanded ? (
                            <ChevronDown
                              className="size-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronRight
                              className="size-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )
                        ) : null}
                      </TableCell>
                      {row
                        .getVisibleCells()
                        .slice(1)
                        .map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                    </TableRow>
                    {isExpanded ? (
                      <ExpandedDetailRow
                        row={row.original}
                        colSpan={columns.length}
                        isAdmin={isAdmin}
                        lookup={lookup}
                      />
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          {totalCount === 0 ? "No entries" : `${from}–${to} of ${totalCount}`}
        </span>
        <TablePagination
          page={page}
          pageCount={pageCount}
          onPageChange={onPageChange}
          isDisabled={isFetching}
        />
      </div>
    </div>
  );
}
