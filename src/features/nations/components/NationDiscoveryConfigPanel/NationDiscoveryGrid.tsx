import { CircleCheck, CircleX } from "lucide-react";
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

const CELL_SIZE = "size-10";

// Full N x N matrix is rendered so the grid reads symmetrically, but only the
// upper triangle (columnIndex > rowIndex) is interactive: each unordered pair
// has exactly one control there. The diagonal and lower triangle mirror the
// same state, muted and non-interactive, purely so rows/columns stay easy to
// scan.
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
    <div
      className="max-h-[70vh] overflow-auto rounded-md border border-border"
      onMouseLeave={clearHover}
    >
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky top-0 left-0 z-30 border-r border-b border-border bg-card p-2 text-left align-middle font-medium"
            >
              Nation
            </th>
            {nations.map((column) => (
              <th
                key={column.id}
                scope="col"
                title={column.name}
                className={cn(
                  CELL_SIZE,
                  "sticky top-0 z-20 border-b border-border bg-card p-1 align-bottom font-medium",
                  hoveredColumnId === column.id && "bg-accent",
                )}
                onMouseEnter={() => {
                  setHoveredColumnId(column.id);
                }}
              >
                <span className="block max-w-10 origin-bottom-left -rotate-45 truncate text-xs whitespace-nowrap text-muted-foreground">
                  {column.name}
                </span>
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
                    "sticky left-0 z-10 max-w-40 border-r border-b border-border bg-card p-2 text-left align-middle font-medium",
                    hoveredRowId === row.id && "bg-accent",
                  )}
                  onMouseEnter={() => {
                    setHoveredRowId(row.id);
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span className="min-w-0 flex-1 truncate">{row.name}</span>
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
                          "border-r border-b border-border bg-muted/60 p-0",
                        )}
                      />
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
                          met ? "bg-primary/20" : "bg-muted/30",
                          isHighlighted && "bg-accent",
                        )}
                      />
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
                            ? "bg-primary hover:bg-primary/90"
                            : "bg-transparent hover:bg-muted",
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
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
