import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";

import { IconChip } from "@/components/shared/IconChip";
import { resolveEntityIcon } from "@/components/shared/iconPicker/CuratedIcons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatCalendarDateShort,
  resolveTurnCalendarDate,
} from "@/features/calendar";
import type { WorldCalendarConfig } from "@/features/calendar";
import { settlementResourceSnapshotsQueryOptions } from "@/features/reports";
import { settlementStockpilesByIdQueryOptions } from "@/features/resources";
import { currentTurnStateQueryOptions } from "@/features/turns";
import { resolveIconTone } from "@/lib/categoricalPalette";

import { settlementForecastQueryOptions } from "../queries/settlementForecastQueries";
import { deriveSettlementForecastWarnings } from "../utils/settlementForecastWarnings";

import { ForecastResourceSparkline } from "./ForecastResourceSparkline";

import type { ForecastSparklinePoint } from "./ForecastResourceSparkline";
import type { SettlementForecastData } from "../schemas/forecastSchemas";
import type { JSX } from "react";

type ForecastPanelProps = {
  readonly settlementId: string;
  readonly worldId: string;
};

// Recent-turn window for the per-resource trend sparklines (#1041) — enough
// points for a shape, short enough to stay a glance-able table-cell chart.
const SPARKLINE_TURN_WINDOW = 8;

type ResourceDelta = SettlementForecastData["resourceDeltas"][number];

function computeTurnsUntilEmpty(delta: ResourceDelta): number | null {
  return delta.netDelta < 0 && delta.quantityBefore > 0
    ? Math.floor(delta.quantityBefore / -delta.netDelta)
    : null;
}

function turnsUntilEmptyToneClassName(
  turnsUntilEmpty: number | null,
): string | null {
  if (turnsUntilEmpty === null) return null;
  if (turnsUntilEmpty <= 3) return "text-destructive";
  if (turnsUntilEmpty <= 10) return "text-warning-foreground";
  return null;
}

function formatRunOutLabel({
  calendarConfig,
  currentTurnNumber,
  turnsUntilEmpty,
}: {
  readonly calendarConfig: WorldCalendarConfig | null;
  readonly currentTurnNumber: number | null;
  readonly turnsUntilEmpty: number | null;
}): string {
  if (turnsUntilEmpty === null) return "—";
  if (calendarConfig === null || currentTurnNumber === null) {
    return `${String(turnsUntilEmpty)} turns`;
  }
  const runOutTurn = currentTurnNumber + turnsUntilEmpty;
  const date = resolveTurnCalendarDate(calendarConfig, runOutTurn);
  return formatCalendarDateShort(date, {
    shortDateFormatTemplate: calendarConfig.shortDateFormatTemplate,
  });
}

// Depleting resources at or below this many turns-until-empty get the
// "Critical" banner treatment (#1057) — matches the destructive tone tier.
const CRITICAL_TURNS_UNTIL_EMPTY = 3;

function formatRunOutTurnsLabel(turnsUntilEmpty: number | null): string {
  if (turnsUntilEmpty === null) return "—";
  if (turnsUntilEmpty === 0) return "Runs out this turn";
  return `Runs out in ${String(turnsUntilEmpty)} turn${turnsUntilEmpty === 1 ? "" : "s"}`;
}

export function ForecastPanel({
  settlementId,
  worldId,
}: ForecastPanelProps): JSX.Element {
  const forecastQuery = useQuery(settlementForecastQueryOptions(worldId));

  if (forecastQuery.isPending) {
    return <ForecastPanelSkeleton />;
  }

  if (forecastQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Forecast Error</AlertTitle>
        <AlertDescription>
          Unable to load settlement forecast. Try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  const forecast: SettlementForecastData | null =
    forecastQuery.data?.forecastSnapshot.bySettlement[settlementId] ?? null;

  if (forecast === null) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Forecast Unavailable</AlertTitle>
        <AlertDescription>
          The forecast data could not be parsed. Try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <ForecastPanelContent
      forecast={forecast}
      settlementId={settlementId}
      worldId={worldId}
    />
  );
}

function ForecastPanelContent({
  forecast,
  settlementId,
  worldId,
}: {
  readonly forecast: SettlementForecastData;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const stockpilesQuery = useQuery(
    settlementStockpilesByIdQueryOptions(settlementId),
  );
  const turnStateQuery = useQuery(currentTurnStateQueryOptions(worldId));
  const [showStableResources, setShowStableResources] = useState(false);

  const currentTurnNumber = turnStateQuery.data?.currentTurnNumber ?? null;
  const calendarConfig = turnStateQuery.data?.calendarConfig ?? null;

  const sparklineToTurn = currentTurnNumber ?? 1;
  const sparklineFromTurn = Math.max(
    1,
    sparklineToTurn - (SPARKLINE_TURN_WINDOW - 1),
  );
  const resourceSnapshotsQuery = useQuery({
    ...settlementResourceSnapshotsQueryOptions(
      settlementId,
      sparklineFromTurn,
      sparklineToTurn,
    ),
    enabled: currentTurnNumber !== null,
  });

  const resourceInfoMap = useMemo<
    ReadonlyMap<
      string,
      {
        readonly name: string;
        readonly icon: string | null;
        readonly iconColor: number | null;
      }
    >
  >(() => {
    const stockpiles = stockpilesQuery.data;
    if (stockpiles === undefined) return new Map();
    return new Map(
      stockpiles.map((s) => [
        s.resourceId,
        {
          icon: s.resourceIcon,
          iconColor: s.resourceIconColor,
          name: s.resourceName,
        },
      ]),
    );
  }, [stockpilesQuery.data]);

  const sparklinePointsByResource = useMemo<
    ReadonlyMap<string, readonly ForecastSparklinePoint[]>
  >(() => {
    const byResource = new Map<string, ForecastSparklinePoint[]>();
    for (const row of resourceSnapshotsQuery.data ?? []) {
      const points = byResource.get(row.resource_id) ?? [];
      points.push({ quantity: row.quantity_after, turn: row.turn_number });
      byResource.set(row.resource_id, points);
    }
    return byResource;
  }, [resourceSnapshotsQuery.data]);

  const sortedResourceDeltas = useMemo(() => {
    return [...forecast.resourceDeltas].sort((a, b) => {
      const aTurns = computeTurnsUntilEmpty(a);
      const bTurns = computeTurnsUntilEmpty(b);
      if (aTurns === null && bTurns === null) return 0;
      if (aTurns === null) return 1;
      if (bTurns === null) return -1;
      return aTurns - bTurns;
    });
  }, [forecast.resourceDeltas]);

  const depletingResourceDeltas = useMemo(
    () =>
      sortedResourceDeltas.filter(
        (delta) => computeTurnsUntilEmpty(delta) !== null,
      ),
    [sortedResourceDeltas],
  );
  const stableResourceDeltas = useMemo(
    () =>
      sortedResourceDeltas.filter(
        (delta) => computeTurnsUntilEmpty(delta) === null,
      ),
    [sortedResourceDeltas],
  );
  const criticalResourceDeltas = useMemo(
    () =>
      depletingResourceDeltas.filter((delta) => {
        const turnsUntilEmpty = computeTurnsUntilEmpty(delta);
        return (
          turnsUntilEmpty !== null &&
          turnsUntilEmpty <= CRITICAL_TURNS_UNTIL_EMPTY
        );
      }),
    [depletingResourceDeltas],
  );

  const warnings = deriveSettlementForecastWarnings(forecast);

  function renderResourceRow(delta: ResourceDelta): JSX.Element {
    const info = resourceInfoMap.get(delta.resourceId);
    const name = info?.name ?? delta.resourceId;
    const turnsUntilEmpty = computeTurnsUntilEmpty(delta);
    const toneClassName = turnsUntilEmptyToneClassName(turnsUntilEmpty);
    const turnsLabel = formatRunOutTurnsLabel(turnsUntilEmpty);
    const dateLabel = formatRunOutLabel({
      calendarConfig,
      currentTurnNumber,
      turnsUntilEmpty,
    });

    return (
      <TableRow key={delta.resourceId}>
        <TableCell className="py-2">
          <div className="flex items-center gap-2">
            <IconChip
              icon={resolveEntityIcon(info?.icon ?? null)}
              tone={resolveIconTone(info?.iconColor ?? null, delta.resourceId)}
            />
            <span>{name}</span>
          </div>
        </TableCell>
        <TableCell className="py-2 tabular-nums text-right">
          {delta.netDelta > 0 ? (
            <span className="text-success-foreground">
              +{delta.netDelta.toLocaleString()}
            </span>
          ) : delta.netDelta < 0 ? (
            <span className="text-destructive">
              {delta.netDelta.toLocaleString()}
            </span>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
        </TableCell>
        <TableCell className="py-2">
          <ForecastResourceSparkline
            points={sparklinePointsByResource.get(delta.resourceId) ?? []}
          />
        </TableCell>
        <TableCell className="py-2 tabular-nums text-right">
          {turnsUntilEmpty === null ? (
            <span className="text-muted-foreground">{turnsLabel}</span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={toneClassName ?? undefined}>{turnsLabel}</span>
              </TooltipTrigger>
              <TooltipContent>{dateLabel}</TooltipContent>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="space-y-4">
      {criticalResourceDeltas.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical: resources running out</AlertTitle>
          <AlertDescription>
            {criticalResourceDeltas
              .map((delta) => {
                const info = resourceInfoMap.get(delta.resourceId);
                const name = info?.name ?? delta.resourceId;
                const turnsUntilEmpty = computeTurnsUntilEmpty(delta);
                return `${name} (${formatRunOutTurnsLabel(turnsUntilEmpty).toLowerCase()})`;
              })
              .join(", ")}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resources Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedResourceDeltas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No resource data available for this turn.
            </p>
          ) : (
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Resource</TableHead>
                  <TableHead scope="col" className="tabular-nums text-right">
                    Net/turn
                  </TableHead>
                  <TableHead scope="col">Trend</TableHead>
                  <TableHead scope="col" className="text-right">
                    Runs out
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {depletingResourceDeltas.map(renderResourceRow)}
                {stableResourceDeltas.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs text-muted-foreground"
                        onClick={() => {
                          setShowStableResources((prev) => !prev);
                        }}
                      >
                        {showStableResources
                          ? "Hide stable resources"
                          : `Show ${String(stableResourceDeltas.length)} stable resources`}
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
                {showStableResources &&
                  stableResourceDeltas.map(renderResourceRow)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="warnings">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              Warnings
              <Badge
                variant={warnings.length > 0 ? "destructive" : "outline"}
                className="ml-2"
              >
                {warnings.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {warnings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No warnings this turn.
              </p>
            ) : (
              <ul className="space-y-1">
                {warnings.map((w) => (
                  <li key={w.key} className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    {w.label}
                  </li>
                ))}
              </ul>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="upcoming">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              Upcoming
              {forecast.completedProjects.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {forecast.completedProjects.length}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {forecast.completedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No constructions completing this turn.
              </p>
            ) : (
              <ul className="space-y-1">
                {forecast.completedProjects.map((projectId) => (
                  <li key={projectId} className="text-sm">
                    {projectId}
                  </li>
                ))}
              </ul>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function ForecastPanelSkeleton(): JSX.Element {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
