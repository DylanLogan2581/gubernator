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
import { nationsListQueryOptions } from "@/features/nations";
import {
  PopulationTrendChart,
  TurnRangeSelector,
  worldNationsPopulationQueryOptions,
  worldPopulationAggregatesQueryOptions,
} from "@/features/reports";
import type { WorldNationPopulationAggregateRow } from "@/features/reports";
import {
  formatCalendarDate,
  resolveTurnCalendarDate,
} from "@/shared/turnCalendarPrimitives";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NationSortKey = "name" | "population" | "births" | "deaths";
type SortDir = "asc" | "desc";

type NationSummary = {
  readonly nationId: string;
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

function buildNationSummaries(
  rows: readonly WorldNationPopulationAggregateRow[],
  nameMap: Map<string, string>,
): NationSummary[] {
  const byNation = new Map<
    string,
    { latestTurn: number; latestPop: number; births: number; deaths: number }
  >();

  for (const row of rows) {
    const existing = byNation.get(row.nation_id);
    if (existing === undefined) {
      byNation.set(row.nation_id, {
        births: row.birth_count,
        deaths: row.death_count,
        latestPop: row.population_total,
        latestTurn: row.turn_number,
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

  return Array.from(byNation.entries()).map(([id, s]) => ({
    latestPopulation: s.latestPop,
    name: nameMap.get(id) ?? id,
    nationId: id,
    totalBirths: s.births,
    totalDeaths: s.deaths,
  }));
}

function compareNationSummaries(
  a: NationSummary,
  b: NationSummary,
  key: NationSortKey,
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

function sortNationSummaries(
  summaries: NationSummary[],
  key: NationSortKey,
  dir: SortDir,
): NationSummary[] {
  return [...summaries].sort((a, b) => compareNationSummaries(a, b, key, dir));
}

// ---------------------------------------------------------------------------
// NationSortIcon — module-level component
// ---------------------------------------------------------------------------

function NationSortIcon({
  column,
  sortKey,
  sortDir,
}: {
  readonly column: NationSortKey;
  readonly sortKey: NationSortKey;
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
    <ChevronUp className="ml-1 inline-block h-3 w-3" aria-hidden="true" />
  ) : (
    <ChevronDown className="ml-1 inline-block h-3 w-3" aria-hidden="true" />
  );
}

// ---------------------------------------------------------------------------
// NationColumnSortButton — module-level component
// ---------------------------------------------------------------------------

function NationColumnSortButton({
  column,
  label,
  sortKey,
  sortDir,
  onSort,
}: {
  readonly column: NationSortKey;
  readonly label: string;
  readonly sortKey: NationSortKey;
  readonly sortDir: SortDir;
  readonly onSort: (key: NationSortKey) => void;
}): JSX.Element {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-auto p-1 text-xs font-medium"
      onClick={() => onSort(column)}
    >
      {label}
      <NationSortIcon column={column} sortKey={sortKey} sortDir={sortDir} />
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Nation comparison table
// ---------------------------------------------------------------------------

function NationComparisonTable({
  isLoading,
  isError,
  rows,
  nameMap,
}: {
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly rows: readonly WorldNationPopulationAggregateRow[];
  readonly nameMap: Map<string, string>;
}): JSX.Element {
  const [sortKey, setSortKey] = useState<NationSortKey>("population");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: NationSortKey): void {
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
        <AlertDescription>Nation data could not be loaded.</AlertDescription>
      </Alert>
    );
  }

  const summaries = sortNationSummaries(
    buildNationSummaries(rows, nameMap),
    sortKey,
    sortDir,
  );

  if (summaries.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No nation data in this turn range.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <NationColumnSortButton
              column="name"
              label="Nation"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </TableHead>
          <TableHead className="text-right">
            <NationColumnSortButton
              column="population"
              label="Latest pop."
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </TableHead>
          <TableHead className="text-right">
            <NationColumnSortButton
              column="births"
              label="Births"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </TableHead>
          <TableHead className="text-right">
            <NationColumnSortButton
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
          <TableRow key={s.nationId}>
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
// WorldReportsSection
// ---------------------------------------------------------------------------

type WorldReportsSectionProps = {
  readonly currentTurnNumber: number;
  readonly worldId: string;
};

export function WorldReportsSection({
  currentTurnNumber,
  worldId,
}: WorldReportsSectionProps): JSX.Element {
  const initial = defaultRange(currentTurnNumber);
  const [fromTurn, setFromTurn] = useState(initial.fromTurn);
  const [toTurn, setToTurn] = useState(initial.toTurn);

  const calendarQuery = useQuery(worldCalendarConfigQueryOptions(worldId));
  const calendarConfig = calendarQuery.isSuccess ? calendarQuery.data : null;

  const worldPopQuery = useQuery(
    worldPopulationAggregatesQueryOptions(worldId, fromTurn, toTurn),
  );
  const nationPopQuery = useQuery(
    worldNationsPopulationQueryOptions(worldId, fromTurn, toTurn),
  );
  const nationsQuery = useQuery(nationsListQueryOptions(worldId));

  const nameMap = new Map<string, string>(
    (nationsQuery.data ?? []).map((n) => [n.id, n.name]),
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
    <section aria-labelledby="world-reports-heading" className="space-y-4">
      <h2
        id="world-reports-heading"
        className="text-lg font-semibold tracking-tight"
      >
        World Reports
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
          <CardTitle className="text-base">World population history</CardTitle>
        </CardHeader>
        <CardContent>
          {worldPopQuery.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : worldPopQuery.isError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                World population data could not be loaded.
              </AlertDescription>
            </Alert>
          ) : (
            <PopulationTrendChart
              rows={worldPopQuery.data}
              turnLabel={turnLabel}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nation comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <NationComparisonTable
            isLoading={nationPopQuery.isPending}
            isError={nationPopQuery.isError}
            rows={nationPopQuery.data ?? []}
            nameMap={nameMap}
          />
        </CardContent>
      </Card>
    </section>
  );
}
