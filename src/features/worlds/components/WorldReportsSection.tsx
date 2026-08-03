import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState, type JSX } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { worldCalendarConfigQueryOptions } from "@/features/calendar";
import { nationsListQueryOptions } from "@/features/nations";
import {
  aggregateVitalStats,
  createTurnLabelers,
  defaultReportTurnRange,
  PopulationTrendChart,
  TurnRangeSelector,
  VitalStatsComparisonTable,
  worldNationsPopulationQueryOptions,
  worldPopulationAggregatesQueryOptions,
} from "@/features/reports";
import type { WorldNationPopulationAggregateRow } from "@/features/reports";

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
  const initial = defaultReportTurnRange(currentTurnNumber);
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

  const nationSummaries = aggregateVitalStats(
    (nationPopQuery.data ?? []).map(
      (row: WorldNationPopulationAggregateRow) => ({
        birthCount: row.birth_count,
        deathCount: row.death_count,
        id: row.nation_id,
        name: nameMap.get(row.nation_id) ?? row.nation_id,
        populationTotal: row.population_total,
        turnNumber: row.turn_number,
      }),
    ),
  );

  // Chart axis ticks use the short template so labels don't overflow.
  const { axisLabel } = createTurnLabelers(calendarConfig);

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
          <CardTitle>Turn range</CardTitle>
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
          <CardTitle>World population history</CardTitle>
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
              turnLabel={axisLabel}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nation comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <VitalStatsComparisonTable
            entityLabel="Nation"
            isLoading={nationPopQuery.isPending}
            isError={nationPopQuery.isError}
            summaries={nationSummaries}
            errorMessage="Nation data could not be loaded."
            emptyMessage="No nation data in this turn range."
          />
        </CardContent>
      </Card>
    </section>
  );
}
