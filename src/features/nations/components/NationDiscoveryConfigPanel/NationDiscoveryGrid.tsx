import { Check, Circle, MoreHorizontal, Minus } from "lucide-react";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { NationFlagAvatar } from "../NationFlagAvatar";

import { discoveryPairKey } from "./NationDiscoveryUtils";

import type { Nation, NationDiscoveryPair } from "../../types/nationTypes";

type NationDiscoveryGridProps = {
  readonly canEdit: boolean;
  readonly rows: readonly Nation[];
  readonly columns: readonly Nation[];
  readonly pairsByKey: ReadonlyMap<string, NationDiscoveryPair>;
  readonly pendingKey: string | null;
  readonly bulkPendingNationId: string | null;
  readonly onToggle: (nationA: Nation, nationB: Nation, met: boolean) => void;
  readonly onDiscoverAll: (nation: Nation) => void;
  readonly onClearAll: (nation: Nation) => void;
};

const CELL_SIZE = "size-14";
const CELL_PX = 56;
const NAME_COLUMN_PX = 220;

// Rows and columns are independent lists: columns are always every nation in
// the world (for context), while rows are the nations matching the current
// search (all of them when the search is empty). Both triangles are
// interactive: a cell's row/column pair maps to the same order-independent
// discoveryPairKey regardless of which nation is the row and which is the
// column, so the two mirrored cells for a pair always render identically and
// toggling either one flips the same underlying record. Column headers show
// each nation's flag with the full name on hover/focus via the native title
// tooltip (and exposed to screen readers via sr-only text).
export function NationDiscoveryGrid({
  canEdit,
  rows,
  columns,
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
      <DiscoveryLegend />
      <div
        className="max-h-[70vh] w-fit max-w-full overflow-auto rounded-md border border-border"
        onMouseLeave={clearHover}
      >
        <table
          className="table-fixed border-separate border-spacing-0 text-sm"
          style={{ width: NAME_COLUMN_PX + columns.length * CELL_PX }}
        >
          <colgroup>
            <col style={{ width: NAME_COLUMN_PX }} />
            {columns.map((column) => (
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
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  title={column.name}
                  className={cn(
                    CELL_SIZE,
                    "sticky top-0 z-20 border-b border-border bg-card p-1 align-middle font-medium",
                    hoveredColumnId === column.id && "bg-accent",
                  )}
                  onMouseEnter={() => {
                    setHoveredColumnId(column.id);
                  }}
                >
                  <span className="flex items-center justify-center">
                    <NationFlagAvatar
                      className="w-10"
                      flagPath={column.flagPath}
                      nationId={column.id}
                    />
                  </span>
                  <span className="sr-only">{column.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
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
                      <span className="min-w-0 flex-1 break-words">
                        {row.name}
                      </span>
                      {canEdit ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-label={`Actions for ${row.name}`}
                              disabled={isRowBulkPending}
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            >
                              <MoreHorizontal aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                onDiscoverAll(row);
                              }}
                            >
                              Discover all
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                onClearAll(row);
                              }}
                            >
                              Clear all
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </th>
                  {columns.map((column) => {
                    const key = discoveryPairKey(row.id, column.id);
                    const pair = pairsByKey.get(key);
                    const met = pair !== undefined;
                    const isDiagonal = column.id === row.id;
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

function DiscoveryLegend(): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
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
      <span className="text-muted-foreground/80">
        Click a cell to toggle whether the row and column nations have met
      </span>
    </div>
  );
}
