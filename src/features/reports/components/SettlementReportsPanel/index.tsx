import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Baby, Download, Skull, Users } from "lucide-react";
import { useState, type JSX } from "react";

import { StatStrip } from "@/components/shared/StatStrip";
import { StatTile } from "@/components/shared/StatTile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { worldCalendarConfigQueryOptions } from "@/features/calendar";

import {
  settlementPopulationSnapshotsQueryOptions,
  settlementResourceSnapshotsQueryOptions,
} from "../../queries/settlementSnapshotQueries";
import {
  createTurnLabelers,
  defaultReportTurnRange,
} from "../../utils/reportTurnRange";

import { PopulationByJobDonut } from "./PopulationByJobDonut";
import { PopulationTrendChart } from "./PopulationTrendChart";
import { ResourceTrendChart } from "./ResourceTrendChart";
import { StockpileByResourceDonut } from "./StockpileByResourceDonut";
import { TurnRangeSelector } from "./TurnRangeSelector";

import type {
  PopulationSnapshotRow,
  ResourceSnapshotRow,
} from "../../types/snapshotTypes";

type SettlementReportsPanelProps = {
  readonly currentTurnNumber: number;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementReportsPanel({
  currentTurnNumber,
  settlementId,
  worldId,
}: SettlementReportsPanelProps): JSX.Element {
  const initial = defaultReportTurnRange(currentTurnNumber);
  const [fromTurn, setFromTurn] = useState(initial.fromTurn);
  const [toTurn, setToTurn] = useState(initial.toTurn);

  const calendarQuery = useQuery(worldCalendarConfigQueryOptions(worldId));
  const calendarConfig = calendarQuery.isSuccess ? calendarQuery.data : null;
  const { axisLabel, turnLabel } = createTurnLabelers(calendarConfig);

  const populationQuery = useQuery(
    settlementPopulationSnapshotsQueryOptions(settlementId, fromTurn, toTurn),
  );
  const resourceQuery = useQuery(
    settlementResourceSnapshotsQueryOptions(settlementId, fromTurn, toTurn),
  );

  function handleApply(from: number, to: number): void {
    setFromTurn(from);
    setToTurn(to);
  }

  return (
    <div className="space-y-6">
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

      <SettlementReportStatTiles
        isLoading={populationQuery.isPending}
        rows={populationQuery.data ?? []}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <PopulationSection
          axisLabel={axisLabel}
          isLoading={populationQuery.isPending}
          isError={populationQuery.isError}
          rows={populationQuery.data ?? []}
          turnLabel={turnLabel}
        />

        <ResourceSection
          axisLabel={axisLabel}
          isLoading={resourceQuery.isPending}
          isError={resourceQuery.isError}
          rows={resourceQuery.data ?? []}
          turnLabel={turnLabel}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Population by job</CardTitle>
          </CardHeader>
          <CardContent>
            <PopulationByJobDonut
              settlementId={settlementId}
              worldId={worldId}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stockpile by resource</CardTitle>
          </CardHeader>
          <CardContent>
            <StockpileByResourceDonut settlementId={settlementId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettlementReportStatTiles — at-a-glance summary derived from the already-
// fetched population rows, no extra queries.
// ---------------------------------------------------------------------------

function SettlementReportStatTiles({
  isLoading,
  rows,
}: {
  readonly isLoading: boolean;
  readonly rows: readonly PopulationSnapshotRow[];
}): JSX.Element {
  const first = rows[0];
  const latest = rows[rows.length - 1];
  const netChange =
    first !== undefined && latest !== undefined
      ? latest.population_total - first.population_total
      : 0;
  const totalBirths = rows.reduce((sum, r) => sum + r.birth_count, 0);
  const totalDeaths = rows.reduce((sum, r) => sum + r.death_count, 0);

  return (
    <StatStrip className="lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-border lg:[&>*]:px-4 lg:[&>*:first-child]:pl-0 lg:[&>*:last-child]:pr-0">
      <StatTile
        icon={Users}
        label="Latest population"
        value={(latest?.population_total ?? 0).toLocaleString()}
        context={`${netChange >= 0 ? "+" : ""}${netChange.toLocaleString()} over range`}
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
        icon={Users}
        label="Population cap"
        value={(latest?.population_cap ?? 0).toLocaleString()}
        context="At latest snapshot"
        isLoading={isLoading}
      />
    </StatStrip>
  );
}

function PopulationSection({
  axisLabel,
  isLoading,
  isError,
  rows,
  turnLabel,
}: {
  readonly axisLabel: (turn: number) => string;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly rows: readonly PopulationSnapshotRow[];
  readonly turnLabel: (turn: number) => string;
}): JSX.Element {
  function exportCsv(): void {
    const header =
      "turn,date,total,npc,pc,cap,births,deaths,starvation_deaths,homeless_deaths";
    const lines = rows.map(
      (r) =>
        `${String(r.turn_number)},${turnLabel(r.turn_number)},${String(r.population_total)},${String(r.population_npc)},${String(r.population_player_character)},${String(r.population_cap)},${String(r.birth_count)},${String(r.death_count)},${String(r.starvation_deaths_count)},${String(r.homeless_deaths_count)}`,
    );
    downloadCsv("population.csv", [header, ...lines].join("\n"));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Population history</CardTitle>
        {rows.length > 0 && (
          <Button variant="ghost" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Population snapshots could not be loaded.
            </AlertDescription>
          </Alert>
        ) : (
          <PopulationTrendChart rows={rows} turnLabel={axisLabel} />
        )}
      </CardContent>
    </Card>
  );
}

function ResourceSection({
  axisLabel,
  isLoading,
  isError,
  rows,
  turnLabel,
}: {
  readonly axisLabel: (turn: number) => string;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly rows: readonly ResourceSnapshotRow[];
  readonly turnLabel: (turn: number) => string;
}): JSX.Element {
  function exportCsv(): void {
    const header =
      "turn,date,resource,qty_before,qty_after,produced,consumed,trade_in,trade_out,adjustment";
    const lines = rows.map(
      (r) =>
        `${String(r.turn_number)},${turnLabel(r.turn_number)},${r.resource_name},${String(r.quantity_before)},${String(r.quantity_after)},${String(r.produced_amount)},${String(r.consumed_amount)},${String(r.trade_in_amount)},${String(r.trade_out_amount)},${String(r.adjustment_amount)}`,
    );
    downloadCsv("resources.csv", [header, ...lines].join("\n"));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Resource history</CardTitle>
        {rows.length > 0 && (
          <Button variant="ghost" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Resource snapshots could not be loaded.
            </AlertDescription>
          </Alert>
        ) : (
          <ResourceTrendChart rows={rows} turnLabel={axisLabel} />
        )}
      </CardContent>
    </Card>
  );
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
