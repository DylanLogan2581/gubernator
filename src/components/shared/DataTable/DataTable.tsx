import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";

import { TablePagination } from "@/components/shared/TablePagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { JSX, ReactElement, ReactNode } from "react";

export type DataTableProps<TData> = {
  readonly columns: readonly ColumnDef<TData, unknown>[];
  readonly data: readonly TData[];
  /** Row identity for React keys and TanStack Table's internal row map. */
  readonly getRowId: (row: TData) => string;
  /** Current single-column sort. Empty when unsorted. */
  readonly sorting: SortingState;
  /** Called with the next single-column sort whenever a sortable header is clicked. */
  readonly onSortingChange: (sorting: SortingState) => void;
  /** 0-based current page index. */
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly onPageChange: (page: number) => void;
  /** Disables pagination controls, e.g. while a page fetch is in flight. */
  readonly isPaginationDisabled?: boolean;
  /**
   * Renders the Link that makes a row keyboard-reachable and openable, given
   * the first column's own rendered cell content as `children`. The whole
   * first cell becomes the row's navigation target.
   */
  readonly renderRowLink?: (row: TData, children: ReactNode) => ReactElement;
  readonly emptyMessage?: string;
};

function SortIndicator({
  direction,
}: {
  readonly direction: false | "asc" | "desc";
}): JSX.Element {
  if (direction === "asc") {
    return <ArrowUpIcon aria-hidden="true" className="size-3.5" />;
  }
  if (direction === "desc") {
    return <ArrowDownIcon aria-hidden="true" className="size-3.5" />;
  }
  return (
    <ArrowUpDownIcon
      aria-hidden="true"
      className="size-3.5 text-muted-foreground/50"
    />
  );
}

function ariaSortFor(
  direction: false | "asc" | "desc",
): JSX.IntrinsicElements["th"]["aria-sort"] {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
}

/**
 * Shared table for server-driven (manual sorting + manual pagination)
 * collection views. Wraps the standard shadcn/TanStack Table recipe so
 * feature code only supplies column defs and current sort/page state.
 */
export function DataTable<TData>({
  columns,
  data,
  getRowId,
  sorting,
  onSortingChange,
  pageIndex,
  pageCount,
  onPageChange,
  isPaginationDisabled = false,
  renderRowLink,
  emptyMessage = "No results.",
}: DataTableProps<TData>): JSX.Element {
  // eslint-disable-next-line react-hooks/incompatible-library -- useReactTable is a TanStack Table hook, not a React hook
  const table = useReactTable({
    data: data as TData[],
    columns: columns as ColumnDef<TData, unknown>[],
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    manualSorting: true,
    state: { sorting },
  });

  function toggleSort(columnId: string): void {
    const current = sorting.find((sort) => sort.id === columnId);
    onSortingChange([
      { id: columnId, desc: current !== undefined && !current.desc },
    ]);
  }

  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const direction = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={canSort ? ariaSortFor(direction) : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                          onClick={() => {
                            toggleSort(header.column.id);
                          }}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <SortIndicator direction={direction} />
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell, cellIndex) => {
                    const cellContent = flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    );
                    return (
                      <TableCell key={cell.id}>
                        {cellIndex === 0 && renderRowLink !== undefined
                          ? renderRowLink(row.original, cellContent)
                          : cellContent}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={pageIndex}
        pageCount={pageCount}
        onPageChange={onPageChange}
        isDisabled={isPaginationDisabled}
      />
    </div>
  );
}
