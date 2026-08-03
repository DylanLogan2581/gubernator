// Sortable births/deaths/population comparison table shared by the world
// overview (nation rows) and nation detail (settlement rows) report sections.
// Both aggregate per-turn snapshot rows into one summary per entity, then rank
// them by the same four columns — only the entity label and the source rows
// differ, so callers aggregate with aggregateVitalStats and hand the summaries
// here.

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from "lucide-react";
import { useState, type JSX } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { VitalStatsSummary } from "../utils/vitalStats";

type SortKey = "name" | "population" | "births" | "deaths";
type SortDir = "asc" | "desc";

function compareSummaries(
  a: VitalStatsSummary,
  b: VitalStatsSummary,
  key: SortKey,
  dir: SortDir,
): number {
  let diff: number;
  if (key === "name") {
    diff = a.name.localeCompare(b.name);
  } else if (key === "population") {
    diff = a.latestPopulation - b.latestPopulation;
  } else if (key === "births") {
    diff = a.totalBirths - b.totalBirths;
  } else {
    diff = a.totalDeaths - b.totalDeaths;
  }
  return dir === "asc" ? diff : -diff;
}

function ariaSortFor(
  column: SortKey,
  sortKey: SortKey,
  sortDir: SortDir,
): "ascending" | "descending" | undefined {
  if (column !== sortKey) return undefined;
  return sortDir === "asc" ? "ascending" : "descending";
}

function SortIcon({
  column,
  sortKey,
  sortDir,
}: {
  readonly column: SortKey;
  readonly sortKey: SortKey;
  readonly sortDir: SortDir;
}): JSX.Element {
  if (column !== sortKey) {
    return (
      <ChevronsUpDown
        className="ml-1 inline-block h-3 w-3 opacity-40"
        aria-hidden="true"
      />
    );
  }
  return sortDir === "asc" ? (
    <ChevronUp
      className="ml-1 inline-block h-3 w-3 text-foreground"
      aria-hidden="true"
    />
  ) : (
    <ChevronDown
      className="ml-1 inline-block h-3 w-3 text-foreground"
      aria-hidden="true"
    />
  );
}

function ColumnSortButton({
  column,
  label,
  sortKey,
  sortDir,
  onSort,
}: {
  readonly column: SortKey;
  readonly label: string;
  readonly sortKey: SortKey;
  readonly sortDir: SortDir;
  readonly onSort: (key: SortKey) => void;
}): JSX.Element {
  const isActive = column === sortKey;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`-ml-3 h-auto p-1 text-xs ${
        isActive
          ? "font-semibold text-foreground"
          : "font-medium text-muted-foreground"
      }`}
      onClick={() => onSort(column)}
    >
      {label}
      <SortIcon column={column} sortKey={sortKey} sortDir={sortDir} />
    </Button>
  );
}

export function VitalStatsComparisonTable({
  emptyMessage,
  entityLabel,
  errorMessage,
  isError,
  isLoading,
  summaries,
}: {
  /** Header for the first column, e.g. "Nation" or "Settlement". */
  readonly entityLabel: string;
  readonly emptyMessage: string;
  readonly errorMessage: string;
  readonly isError: boolean;
  readonly isLoading: boolean;
  /** Pre-aggregated rows; the table owns the sort. */
  readonly summaries: readonly VitalStatsSummary[];
}): JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>("population");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey): void {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  }

  if (summaries.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const sorted = [...summaries].sort((a, b) =>
    compareSummaries(a, b, sortKey, sortDir),
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead aria-sort={ariaSortFor("name", sortKey, sortDir)}>
            <ColumnSortButton
              column="name"
              label={entityLabel}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </TableHead>
          <TableHead
            className="text-right"
            aria-sort={ariaSortFor("population", sortKey, sortDir)}
          >
            <ColumnSortButton
              column="population"
              label="Latest pop."
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </TableHead>
          <TableHead
            className="text-right"
            aria-sort={ariaSortFor("births", sortKey, sortDir)}
          >
            <ColumnSortButton
              column="births"
              label="Births"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </TableHead>
          <TableHead
            className="text-right"
            aria-sort={ariaSortFor("deaths", sortKey, sortDir)}
          >
            <ColumnSortButton
              column="deaths"
              label="Deaths"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{s.name}</TableCell>
            <TableCell className="text-right">
              {s.latestPopulation.toLocaleString()}
            </TableCell>
            <TableCell className="text-right">
              {s.totalBirths.toLocaleString()}
            </TableCell>
            <TableCell className="text-right">
              {s.totalDeaths.toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
