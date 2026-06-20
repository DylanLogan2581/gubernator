import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from "lucide-react";
import { useState, type JSX } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { worldCalendarConfigQueryOptions } from "@/features/calendar";
import {
  nationPopulationAggregatesQueryOptions,
  nationSettlementSnapshotsQueryOptions,
  PopulationTrendChart,
  TurnRangeSelector,
} from "@/features/reports";
import type { NationSettlementSnapshotRow } from "@/features/reports";
import {
  formatCalendarDate,
  resolveTurnCalendarDate,
} from "@/shared/turnCalendarPrimitives";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortKey = "name" | "population" | "births" | "deaths";
type SortDir = "asc" | "desc";

type SettlementSummary = {
  readonly settlementId: string;
  readonly name: string;
  readonly latestPopulation: number;
  readonly totalBirths: number;
  readonly totalDeaths: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultRange(currentTurnNumber: number): {
  fromTurn: number;
  toTurn: number;
} {
  const toTurn = Math.max(1, currentTurnNumber);
  const fromTurn = Math.max(1, toTurn - 19);
  return { fromTurn, toTurn };
}

function buildSettlementSummaries(
  rows: readonly NationSettlementSnapshotRow[],
): SettlementSummary[] {
  const bySettlement = new Map<
    string,
    {
      name: string;
      latestTurn: number;
      latestPop: number;
      births: number;
      deaths: number;
    }
  >();

  for (const row of rows) {
    const existing = bySettlement.get(row.settlement_id);
    if (existing === undefined) {
      bySettlement.set(row.settlement_id, {
        births: row.birth_count,
        deaths: row.death_count,
        latestPop: row.population_total,
        latestTurn: row.turn_number,
        name: row.settlement_name,
      });
    } else {
      existing.births += row.birth_count;
      existing.deaths += row.death_count;
      if (row.turn_number > existing.latestTurn) {
        existing.latestTurn = row.turn_number;
        existing.latestPop = row.population_total;
      }
    }
  }

  return Array.from(bySettlement.entries()).map(([id, s]) => ({
    latestPopulation: s.latestPop,
    name: s.name,
    settlementId: id,
    totalBirths: s.births,
    totalDeaths: s.deaths,
  }));
}

function compareSummaries(
  a: SettlementSummary,
  b: SettlementSummary,
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

function sortSummaries(
  summaries: SettlementSummary[],
  key: SortKey,
  dir: SortDir,
): SettlementSummary[] {
  return [...summaries].sort((a, b) => compareSummaries(a, b, key, dir));
}

// ---------------------------------------------------------------------------
// SortIcon — module-level component
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ColumnSortButton — module-level component
// ---------------------------------------------------------------------------

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
      aria-sort={
        isActive ? (sortDir === "asc" ? "ascending" : "descending") : undefined
      }
    >
      {label}
      <SortIcon column={column} sortKey={sortKey} sortDir={sortDir} />
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Settlement comparison table
// ---------------------------------------------------------------------------

function SettlementComparisonTable({
  isLoading,
  isError,
  rows,
}: {
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly rows: readonly NationSettlementSnapshotRow[];
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
        <AlertDescription>
          Settlement data could not be loaded.
        </AlertDescription>
      </Alert>
    );
  }

  const summaries = sortSummaries(
    buildSettlementSummaries(rows),
    sortKey,
    sortDir,
  );

  if (summaries.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No settlement data in this turn range.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <ColumnSortButton
              column="name"
              label="Settlement"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </TableHead>
          <TableHead className="text-right">
            <ColumnSortButton
              column="population"
              label="Latest pop."
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </TableHead>
          <TableHead className="text-right">
            <ColumnSortButton
              column="births"
              label="Births"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </TableHead>
          <TableHead className="text-right">
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
        {summaries.map((s) => (
          <TableRow key={s.settlementId}>
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

// ---------------------------------------------------------------------------
// NationReportsSection
// ---------------------------------------------------------------------------

type NationReportsSectionProps = {
  readonly currentTurnNumber: number;
  readonly nationId: string;
  readonly worldId: string;
};

export function NationReportsSection({
  currentTurnNumber,
  nationId,
  worldId,
}: NationReportsSectionProps): JSX.Element {
  const initial = defaultRange(currentTurnNumber);
  const [fromTurn, setFromTurn] = useState(initial.fromTurn);
  const [toTurn, setToTurn] = useState(initial.toTurn);

  const calendarQuery = useQuery(worldCalendarConfigQueryOptions(worldId));
  const calendarConfig = calendarQuery.isSuccess ? calendarQuery.data : null;

  const populationQuery = useQuery(
    nationPopulationAggregatesQueryOptions(nationId, fromTurn, toTurn),
  );
  const settlementQuery = useQuery(
    nationSettlementSnapshotsQueryOptions(nationId, fromTurn, toTurn),
  );

  function turnLabel(turn: number): string {
    if (calendarConfig === null) return `T${String(turn)}`;
    try {
      return formatCalendarDate(resolveTurnCalendarDate(calendarConfig, turn), {
        dateFormatTemplate: calendarConfig.dateFormatTemplate,
      });
    } catch {
      return `T${String(turn)}`;
    }
  }

  function handleApply(from: number, to: number): void {
    setFromTurn(from);
    setToTurn(to);
  }

  return (
    <section aria-labelledby="nation-reports-heading" className="space-y-4">
      <h2
        id="nation-reports-heading"
        className="text-lg font-semibold tracking-tight"
      >
        Reports
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Turn range</CardTitle>
        </CardHeader>
        <CardContent>
          <TurnRangeSelector
            fromTurn={fromTurn}
            toTurn={toTurn}
            onApply={handleApply}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nation population history</CardTitle>
        </CardHeader>
        <CardContent>
          {populationQuery.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : populationQuery.isError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Population data could not be loaded.
              </AlertDescription>
            </Alert>
          ) : (
            <PopulationTrendChart
              rows={populationQuery.data}
              turnLabel={turnLabel}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settlement comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <SettlementComparisonTable
            isLoading={settlementQuery.isPending}
            isError={settlementQuery.isError}
            rows={settlementQuery.data ?? []}
          />
        </CardContent>
      </Card>
    </section>
  );
}
