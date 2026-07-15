import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Fragment, type JSX, type ReactElement, type ReactNode } from "react";

import { TablePagination } from "@/components/shared/TablePagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // Declaration merging requires an `interface` with the exact type
  // parameter list tanstack-table declared (name and constraints included),
  // even though neither is referenced in this augmentation's own members.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions, unused-imports/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Right-aligns the header and cell content, e.g. for numeric columns. */
    readonly align?: "right";
  }
}

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
  /** Optional extra className per row, e.g. to mute deceased citizens. */
  readonly rowClassName?: (row: TData) => string | undefined;
  /**
   * Renders a row's sub-content, shown in a full-width row directly below it
   * while expanded. Providing this adds a leading toggle column to the table.
   */
  readonly renderExpandedContent?: (row: TData) => ReactNode;
  /** Whether a given row is currently expanded. Only consulted alongside `renderExpandedContent`. */
  readonly isRowExpanded?: (row: TData) => boolean;
  /** Called when a row's expand toggle is activated. */
  readonly onToggleRowExpand?: (row: TData) => void;
  /** Accessible name for a row's expand toggle button, e.g. "Farmhouse tiers". */
  readonly expandToggleLabel?: (row: TData) => string;
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
  rowClassName,
  renderExpandedContent,
  isRowExpanded,
  onToggleRowExpand,
  expandToggleLabel,
}: DataTableProps<TData>): JSX.Element {
  const canExpand = renderExpandedContent !== undefined;

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
  const columnCount = columns.length + (canExpand ? 1 : 0);

  return (
    <div className="min-w-0 space-y-2">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {canExpand ? (
                  <TableHead key="expand-toggle" className="w-10">
                    <span className="sr-only">Expand row</span>
                  </TableHead>
                ) : null}
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const direction = header.column.getIsSorted();
                  const alignRight =
                    header.column.columnDef.meta?.align === "right";
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={canSort ? ariaSortFor(direction) : undefined}
                      className={alignRight ? "text-right" : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className={cn(
                            "flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                            alignRight && "ml-auto",
                          )}
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
                  colSpan={columnCount}
                  className="py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const expanded =
                  canExpand && (isRowExpanded?.(row.original) ?? false);
                const panelId = `${row.id}-expanded-content`;
                return (
                  <Fragment key={row.id}>
                    <TableRow className={rowClassName?.(row.original)}>
                      {canExpand ? (
                        <TableCell key="expand-toggle">
                          <button
                            aria-controls={panelId}
                            aria-expanded={expanded}
                            aria-label={
                              expandToggleLabel?.(row.original) ?? "Expand row"
                            }
                            className="flex size-6 items-center justify-center rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                            type="button"
                            onClick={() => {
                              onToggleRowExpand?.(row.original);
                            }}
                          >
                            {expanded ? (
                              <ChevronDownIcon
                                aria-hidden="true"
                                className="size-4"
                              />
                            ) : (
                              <ChevronRightIcon
                                aria-hidden="true"
                                className="size-4"
                              />
                            )}
                          </button>
                        </TableCell>
                      ) : null}
                      {row.getVisibleCells().map((cell, cellIndex) => {
                        const cellContent = flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        );
                        const cellAlignRight =
                          cell.column.columnDef.meta?.align === "right";
                        return (
                          <TableCell
                            key={cell.id}
                            className={
                              cellAlignRight ? "text-right" : undefined
                            }
                          >
                            {cellIndex === 0 && renderRowLink !== undefined
                              ? renderRowLink(row.original, cellContent)
                              : cellContent}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    {expanded ? (
                      <TableRow key={`${row.id}-expanded`}>
                        <TableCell id={panelId} colSpan={columnCount}>
                          {renderExpandedContent?.(row.original)}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })
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
