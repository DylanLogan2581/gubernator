import { Link } from "@tanstack/react-router";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  TURN_LOG_PAGE_SIZE,
  type TurnLogBrowserEntry,
} from "../../queries/turnLogBrowserQueries";
import { LOG_CATEGORY_LABELS } from "../../utils/logCategoryLabels";

import { TurnLogPayloadRenderer } from "./TurnLogPayloadRenderer";

import type { JSX } from "react";

// Renders raw JSONB as formatted text for the audit trail detail panel.
// JSON.stringify is intentional here — this is debug/audit output, not app UI.
function formatPayloadJson(payload: unknown): string {
  // eslint-disable-next-line no-restricted-syntax
  return JSON.stringify(payload, null, 2);
}

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
    const settlementLabel = entry.settlementName ?? "Unknown settlement";

    if (resolvedNationId !== null) {
      parts.push(
        <Link
          key="settlement"
          to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
          params={{
            worldId,
            nationId: resolvedNationId,
            settlementId: entry.settlementId,
          }}
          className="text-primary underline-offset-2 hover:underline"
        >
          {settlementLabel}
        </Link>,
      );
    } else {
      parts.push(
        <span key="settlement" className="text-muted-foreground">
          {settlementLabel}
        </span>,
      );
    }
  }

  if (entry.nationId !== null && entry.settlementId === null) {
    parts.push(
      <Link
        key="nation"
        to="/worlds/$worldId/nations/$nationId"
        params={{ worldId, nationId: entry.nationId }}
        className="text-primary underline-offset-2 hover:underline"
      >
        {entry.nationName ?? "Unknown nation"}
      </Link>,
    );
  }

  if (entry.citizenId !== null) {
    parts.push(
      <Link
        key="citizen"
        to="/worlds/$worldId/citizens/$citizenId"
        params={{ worldId, citizenId: entry.citizenId }}
        className="text-primary underline-offset-2 hover:underline"
      >
        {entry.citizenName ?? "Unknown citizen"}
      </Link>,
    );
  }

  if (parts.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return <span className="flex flex-wrap gap-1">{parts}</span>;
}

// ---------------------------------------------------------------------------
// Expanded payload row
// ---------------------------------------------------------------------------

function PayloadDetailRow({
  entry,
  colSpan,
}: {
  readonly entry: TurnLogBrowserEntry;
  readonly colSpan: number;
}): JSX.Element {
  return (
    <tr className="bg-muted/30">
      <td colSpan={colSpan} className="px-4 py-2">
        <div className="text-sm">
          <TurnLogPayloadRenderer
            logCategory={entry.logCategory}
            payload={entry.payloadJsonb}
          />
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Raw JSON
            </summary>
            <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
              {formatPayloadJson(entry.payloadJsonb)}
            </pre>
          </details>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function buildColumns(worldId: string): ColumnDef<TurnLogBrowserEntry>[] {
  return [
    {
      id: "expand",
      header: "",
      cell: () => null,
      size: 32,
    },
    {
      accessorKey: "toTurnNumber",
      header: "Turn",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.toTurnNumber}</span>
      ),
      size: 64,
    },
    {
      accessorKey: "logCategory",
      header: "Category",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono text-xs">
          {LOG_CATEGORY_LABELS[row.original.logCategory] ??
            row.original.logCategory}
        </Badge>
      ),
      size: 220,
    },
    {
      id: "scope",
      header: "Scope",
      cell: ({ row }) => <ScopeCell entry={row.original} worldId={worldId} />,
      size: 140,
    },
    {
      id: "summary",
      header: "Summary",
      cell: ({ row }) => (
        <TurnLogPayloadRenderer
          logCategory={row.original.logCategory}
          payload={row.original.payloadJsonb}
        />
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Table component
// ---------------------------------------------------------------------------

type TurnLogTableProps = {
  readonly entries: readonly TurnLogBrowserEntry[];
  readonly isFetching: boolean;
  readonly onPageChange: (page: number) => void;
  readonly page: number;
  readonly totalCount: number;
  readonly worldId: string;
};

export function TurnLogTable({
  entries,
  isFetching,
  onPageChange,
  page,
  totalCount,
  worldId,
}: TurnLogTableProps): JSX.Element {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(
    () => new Set(),
  );

  const columns = buildColumns(worldId);
  const pageCount = Math.ceil(totalCount / TURN_LOG_PAGE_SIZE);

  // eslint-disable-next-line react-hooks/incompatible-library -- useReactTable is a TanStack Table hook, not a React hook
  const table = useReactTable({
    data: entries as TurnLogBrowserEntry[],
    columns,
    getCoreRowModel: getCoreRowModel(),
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
                const isExpanded = expandedRows.has(row.id);
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      data-state={isExpanded ? "expanded" : undefined}
                      className="cursor-pointer"
                      onClick={() => toggleRow(row.id)}
                      aria-expanded={isExpanded}
                    >
                      <TableCell className="w-8 pr-0">
                        {isExpanded ? (
                          <ChevronDown
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronRight
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                        )}
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
                      <PayloadDetailRow
                        entry={row.original}
                        colSpan={columns.length}
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
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {totalCount === 0 ? "No entries" : `${from}–${to} of ${totalCount}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(0)}
            disabled={page === 0 || isFetching}
            aria-label="First page"
          >
            «
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0 || isFetching}
            aria-label="Previous page"
          >
            ‹
          </Button>
          <span className="px-2 tabular-nums">
            {page + 1} / {Math.max(pageCount, 1)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount - 1 || isFetching}
            aria-label="Next page"
          >
            ›
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pageCount - 1)}
            disabled={page >= pageCount - 1 || isFetching}
            aria-label="Last page"
          >
            »
          </Button>
        </div>
      </div>
    </div>
  );
}
