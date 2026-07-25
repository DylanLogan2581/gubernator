import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Baby,
  Clock,
  Skull,
  TrendingUp,
  Users,
} from "lucide-react";
import { type JSX, useState } from "react";

import { StatTile } from "@/components/shared/StatTile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { worldCalendarConfigQueryOptions } from "@/features/calendar";
import {
  aggregateVitalStats,
  createTurnLabelers,
  defaultReportTurnRange,
  nationSettlementSnapshotsQueryOptions,
  TurnRangeSelector,
  VitalStatsComparisonTable,
} from "@/features/reports";
import type {
  NationSettlementSnapshotRow,
  VitalStatsSummary,
} from "@/features/reports";

import { NationSettlementTrendSmallMultiples } from "./NationSettlementTrendSmallMultiples";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function settlementSummaries(
  rows: readonly NationSettlementSnapshotRow[],
): VitalStatsSummary[] {
  return aggregateVitalStats(
    rows.map((row) => ({
      birthCount: row.birth_count,
      deathCount: row.death_count,
      id: row.settlement_id,
      name: row.settlement_name,
      populationTotal: row.population_total,
      turnNumber: row.turn_number,
    })),
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

// ---------------------------------------------------------------------------
// NationReportStatTiles — at-a-glance summary derived from the same
// settlement snapshot rows the small-multiples chart and comparison table
// use, so no extra query is needed.
// ---------------------------------------------------------------------------

function NationReportStatTiles({
  isLoading,
  rows,
}: {
  readonly isLoading: boolean;
  readonly rows: readonly NationSettlementSnapshotRow[];
}): JSX.Element {
  const summaries = settlementSummaries(rows);
  const totalPopulation = summaries.reduce(
    (sum, s) => sum + s.latestPopulation,
    0,
  );
  const totalBirths = summaries.reduce((sum, s) => sum + s.totalBirths, 0);
  const totalDeaths = summaries.reduce((sum, s) => sum + s.totalDeaths, 0);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        icon={Users}
        label="Total population"
        value={totalPopulation.toLocaleString()}
        context={`Across ${String(summaries.length)} settlement${summaries.length === 1 ? "" : "s"}`}
        isLoading={isLoading}
      />
      <StatTile
        icon={Baby}
        label="Births"
        value={totalBirths.toLocaleString()}
        context="Total in turn range"
        isLoading={isLoading}
      />
      <StatTile
        icon={Skull}
        label="Deaths"
        value={totalDeaths.toLocaleString()}
        context="Total in turn range"
        isLoading={isLoading}
      />
      <StatTile
        icon={TrendingUp}
        label="Net change"
        value={`${totalBirths - totalDeaths >= 0 ? "+" : ""}${(totalBirths - totalDeaths).toLocaleString()}`}
        context="Births minus deaths in range"
        isLoading={isLoading}
      />
    </div>
  );
}

export function NationReportsSection({
  currentTurnNumber,
  nationId,
  worldId,
}: NationReportsSectionProps): JSX.Element {
  const initial = defaultReportTurnRange(currentTurnNumber);
  const [fromTurn, setFromTurn] = useState(initial.fromTurn);
  const [toTurn, setToTurn] = useState(initial.toTurn);

  const calendarQuery = useQuery(worldCalendarConfigQueryOptions(worldId));
  const calendarConfig = calendarQuery.isSuccess ? calendarQuery.data : null;
  const { axisLabel } = createTurnLabelers(calendarConfig);

  const settlementQuery = useQuery(
    nationSettlementSnapshotsQueryOptions(nationId, fromTurn, toTurn),
  );

  function handleApply(from: number, to: number): void {
    setFromTurn(from);
    setToTurn(to);
  }

  return (
    <section aria-labelledby="nation-reports-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="nation-reports-heading"
          className="text-lg font-semibold tracking-tight"
        >
          Reports
        </h2>
        <Button asChild variant="outline" size="sm">
          <Link
            to="/worlds/$worldId/history"
            params={{ worldId }}
            search={{ nationId }}
          >
            <Clock className="mr-1.5 h-3.5 w-3.5" />
            View nation turn log
          </Link>
        </Button>
      </div>

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

      <NationReportStatTiles
        isLoading={settlementQuery.isPending}
        rows={settlementQuery.data ?? []}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Population trend by settlement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {settlementQuery.isPending ? (
              <Skeleton className="h-56 w-full" />
            ) : settlementQuery.isError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Settlement data could not be loaded.
                </AlertDescription>
              </Alert>
            ) : (
              <NationSettlementTrendSmallMultiples
                rows={settlementQuery.data ?? []}
                turnLabel={axisLabel}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Settlement comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <VitalStatsComparisonTable
              entityLabel="Settlement"
              isLoading={settlementQuery.isPending}
              isError={settlementQuery.isError}
              summaries={settlementSummaries(settlementQuery.data ?? [])}
              errorMessage="Settlement data could not be loaded."
              emptyMessage="No settlement data in this turn range."
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
