import { Check, Circle, CircleCheck, CircleX, Minus } from "lucide-react";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { discoveryPairKey } from "./NationDiscoveryUtils";

import type { Nation, NationDiscoveryPair } from "../../types/nationTypes";

type NationDiscoveryGridProps = {
  readonly canEdit: boolean;
  readonly nations: readonly Nation[];
  readonly pairsByKey: ReadonlyMap<string, NationDiscoveryPair>;
  readonly pendingKey: string | null;
  readonly bulkPendingNationId: string | null;
  readonly onToggle: (nationA: Nation, nationB: Nation, met: boolean) => void;
  readonly onDiscoverAll: (nation: Nation) => void;
  readonly onClearAll: (nation: Nation) => void;
};

const CELL_SIZE = "size-14";
const CELL_PX = 56;
const NAME_COLUMN_PX = 132;

// Full N x N matrix is rendered so the grid reads symmetrically, but only the
// upper triangle (columnIndex > rowIndex) is interactive: each unordered pair
// has exactly one control there. The diagonal and lower triangle mirror the
// same state, muted and non-interactive, purely so rows/columns stay easy to
// scan. Columns are labeled with an index rather than a rotated name so
// headers stay legible regardless of name length; the legend below maps
// indices back to full names and is also exposed to row headers and
// screen readers.
export function NationDiscoveryGrid({
  canEdit,
  nations,
  pairsByKey,
  pendingKey,
  bulkPendingNationId,
  onToggle,
  onDiscoverAll,
  onClearAll,
}: NationDiscoveryGridProps): JSX.Element {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [hoveredColumnId, setHoveredColumnId] = useState<string | null>(null);

  function clearHover(): void {
    setHoveredRowId(null);
    setHoveredColumnId(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <DiscoveryLegend nations={nations} />
      <div
        className="max-h-[70vh] w-fit max-w-full overflow-auto rounded-md border border-border"
        onMouseLeave={clearHover}
      >
        <table
          className="table-fixed border-separate border-spacing-0 text-sm"
          style={{ width: NAME_COLUMN_PX + nations.length * CELL_PX }}
        >
          <colgroup>
            <col style={{ width: NAME_COLUMN_PX }} />
            {nations.map((column) => (
              <col key={column.id} style={{ width: CELL_PX }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky top-0 left-0 z-30 border-r border-b border-border bg-card p-2 text-left align-middle font-medium"
              >
                Nation
              </th>
              {nations.map((column, columnIndex) => (
                <th
                  key={column.id}
                  scope="col"
                  title={column.name}
                  className={cn(
                    CELL_SIZE,
                    "sticky top-0 z-20 border-b border-border bg-card p-1 text-center align-middle font-medium",
                    hoveredColumnId === column.id && "bg-accent",
                  )}
                  onMouseEnter={() => {
                    setHoveredColumnId(column.id);
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="text-xs text-muted-foreground"
                  >
                    {columnIndex + 1}
                  </span>
                  <span className="sr-only">{column.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nations.map((row, rowIndex) => {
              const isRowBulkPending = bulkPendingNationId === row.id;

              return (
                <tr key={row.id}>
                  <th
                    scope="row"
                    title={row.name}
                    className={cn(
                      "sticky left-0 z-10 overflow-hidden border-r border-b border-border bg-card p-2 text-left align-middle font-medium",
                      hoveredRowId === row.id && "bg-accent",
                    )}
                    onMouseEnter={() => {
                      setHoveredRowId(row.id);
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="min-w-0 flex-1 truncate">
                        <span
                          aria-hidden="true"
                          className="text-muted-foreground"
                        >
                          {rowIndex + 1}.
                        </span>{" "}
                        {row.name}
                      </span>
                      {canEdit ? (
                        <>
                          <Button
                            aria-label={`Mark ${row.name} as met with all nations`}
                            disabled={isRowBulkPending}
                            size="icon-sm"
                            title="Discover all"
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              onDiscoverAll(row);
                            }}
                          >
                            <CircleCheck />
                          </Button>
                          <Button
                            aria-label={`Mark ${row.name} as unmet with all nations`}
                            disabled={isRowBulkPending}
                            size="icon-sm"
                            title="Clear all"
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              onClearAll(row);
                            }}
                          >
                            <CircleX />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </th>
                  {nations.map((column, columnIndex) => {
                    const key = discoveryPairKey(row.id, column.id);
                    const pair = pairsByKey.get(key);
                    const met = pair !== undefined;
                    const isDiagonal = columnIndex === rowIndex;
                    const isInteractive = columnIndex > rowIndex;
                    const isHighlighted =
                      hoveredRowId === row.id || hoveredColumnId === column.id;
                    const pairLabel = `${row.name} ↔ ${column.name}: ${
                      met ? "discovered" : "not discovered"
                    }`;

                    if (isDiagonal) {
                      return (
                        <td
                          key={column.id}
                          aria-hidden="true"
                          className={cn(
                            CELL_SIZE,
                            "border-r border-b border-border bg-muted/70 p-0",
                          )}
                        >
                          <span className="flex size-full items-center justify-center">
                            <Minus
                              aria-hidden="true"
                              className="size-3 text-muted-foreground/40"
                            />
                          </span>
                        </td>
                      );
                    }

                    if (!isInteractive) {
                      // Lower triangle: mirror the upper-triangle state, muted
                      // and non-interactive so the matrix still reads
                      // symmetrically at a glance.
                      return (
                        <td
                          key={column.id}
                          aria-hidden="true"
                          className={cn(
                            CELL_SIZE,
                            "border-r border-b border-border p-0",
                            met ? "bg-primary/15" : "bg-muted/20",
                            isHighlighted && "bg-accent",
                          )}
                        >
                          <span className="flex size-full items-center justify-center">
                            {met ? (
                              <Check
                                aria-hidden="true"
                                className="size-3 text-primary/50"
                              />
                            ) : (
                              <Circle
                                aria-hidden="true"
                                className="size-2 text-muted-foreground/30"
                              />
                            )}
                          </span>
                        </td>
                      );
                    }

                    const isPending = pendingKey === key;

                    return (
                      <td
                        key={column.id}
                        className="border-r border-b border-border p-0"
                      >
                        <button
                          aria-label={pairLabel}
                          aria-pressed={met}
                          className={cn(
                            CELL_SIZE,
                            "flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-70",
                            met
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "bg-background hover:bg-accent",
                            canEdit &&
                              !isPending &&
                              "hover:ring-2 hover:ring-inset hover:ring-ring",
                            isHighlighted && !met && "bg-accent",
                          )}
                          disabled={!canEdit || isPending}
                          title={pairLabel}
                          type="button"
                          onClick={() => {
                            onToggle(row, column, !met);
                          }}
                          onMouseEnter={() => {
                            setHoveredRowId(row.id);
                            setHoveredColumnId(column.id);
                          }}
                        >
                          {met ? (
                            <Check aria-hidden="true" className="size-4" />
                          ) : (
                            <Circle
                              aria-hidden="true"
                              className="size-2.5 text-muted-foreground/40"
                            />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DiscoveryLegend({
  nations,
}: {
  readonly nations: readonly Nation[];
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <Check aria-hidden="true" className="size-3" />
          </span>
          Met
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded-sm border border-border">
            <Circle
              aria-hidden="true"
              className="size-2.5 text-muted-foreground/40"
            />
          </span>
          Not met
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="flex size-5 items-center justify-center rounded-sm bg-muted/40"
          >
            <Check aria-hidden="true" className="size-3 text-primary/50" />
          </span>
          Mirrored (read-only)
        </span>
        <span className="text-muted-foreground/80">
          Click a cell in the upper triangle to toggle
        </span>
      </div>
      <ol className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2 text-muted-foreground">
        {nations.map((nation, index) => (
          <li key={nation.id}>
            <span className="font-medium text-foreground">{index + 1}.</span>{" "}
            {nation.name}
          </li>
        ))}
      </ol>
    </div>
  );
}
