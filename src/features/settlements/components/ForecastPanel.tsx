import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { settlementStockpilesByIdQueryOptions } from "@/features/resources";

import { settlementForecastQueryOptions } from "../queries/settlementForecastQueries";

import type { JSX } from "react";

type ForecastPanelProps = {
  readonly settlementId: string;
  readonly worldId: string;
};

type ResourceDelta = {
  readonly resourceId: string;
  readonly produced: number;
  readonly consumed: number;
  readonly tradeIn: number;
  readonly tradeOut: number;
  readonly netDelta: number;
  readonly quantityBefore: number;
  readonly quantityAfter: number;
};

type TradeChange = {
  readonly tradeRouteId: string;
  readonly delivered: boolean;
  readonly pauseReason: string | null;
  readonly quantityTransferred: number;
};

type SettlementForecastData = {
  readonly settlementId: string;
  readonly resourceDeltas: ReadonlyArray<ResourceDelta>;
  readonly deathsBy: {
    readonly starvation: number;
    readonly homelessness: number;
    readonly other: number;
  };
  readonly completedProjects: readonly string[];
  readonly buildingUpkeepFailures: readonly string[];
  readonly tradeChanges: ReadonlyArray<TradeChange>;
};

function parseForecastForSettlement(
  snapshot: unknown,
  settlementId: string,
): SettlementForecastData | null {
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    !("bySettlement" in snapshot)
  ) {
    return null;
  }
  const bySettlement = (snapshot as Record<string, unknown>).bySettlement;
  if (typeof bySettlement !== "object" || bySettlement === null) {
    return null;
  }
  const settlement = (bySettlement as Record<string, unknown>)[settlementId];
  if (typeof settlement !== "object" || settlement === null) {
    return null;
  }
  return settlement as SettlementForecastData;
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

  const forecast = parseForecastForSettlement(
    forecastQuery.data?.forecastSnapshot,
    settlementId,
  );

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
    <ForecastPanelContent forecast={forecast} settlementId={settlementId} />
  );
}

function ForecastPanelContent({
  forecast,
  settlementId,
}: {
  readonly forecast: SettlementForecastData;
  readonly settlementId: string;
}): JSX.Element {
  const stockpilesQuery = useQuery(
    settlementStockpilesByIdQueryOptions(settlementId),
  );

  const resourceNameMap = useMemo<ReadonlyMap<string, string>>(() => {
    const stockpiles = stockpilesQuery.data;
    if (stockpiles === undefined) return new Map();
    return new Map(stockpiles.map((s) => [s.resourceId, s.resourceName]));
  }, [stockpilesQuery.data]);

  const warnings: Array<{ readonly key: string; readonly label: string }> = [];
  for (const buildingId of forecast.buildingUpkeepFailures) {
    warnings.push({
      key: `upkeep-${buildingId}`,
      label: `Building upkeep failed: ${buildingId}`,
    });
  }
  for (const trade of forecast.tradeChanges) {
    if (!trade.delivered) {
      const reason =
        trade.pauseReason !== null ? ` — ${trade.pauseReason}` : "";
      warnings.push({
        key: `trade-${trade.tradeRouteId}`,
        label: `Trade route paused${reason}`,
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Resources Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          {forecast.resourceDeltas.length === 0 ? (
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
                  <TableHead scope="col" className="tabular-nums text-right">
                    Turns until empty
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecast.resourceDeltas.map((delta) => {
                  const name =
                    resourceNameMap.get(delta.resourceId) ?? delta.resourceId;
                  const turnsUntilEmpty =
                    delta.netDelta < 0 && delta.quantityBefore > 0
                      ? Math.floor(delta.quantityBefore / -delta.netDelta)
                      : null;

                  return (
                    <TableRow key={delta.resourceId}>
                      <TableCell className="py-2">{name}</TableCell>
                      <TableCell className="py-2 tabular-nums text-right">
                        {delta.netDelta > 0 ? (
                          <span className="text-green-600 dark:text-green-500">
                            +{delta.netDelta.toLocaleString()}
                          </span>
                        ) : delta.netDelta < 0 ? (
                          <span className="text-red-600 dark:text-red-500">
                            {delta.netDelta.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 tabular-nums text-right">
                        {turnsUntilEmpty !== null ? (
                          turnsUntilEmpty <= 3 ? (
                            <span className="text-red-600 dark:text-red-500">
                              {turnsUntilEmpty}
                            </span>
                          ) : turnsUntilEmpty <= 10 ? (
                            <span className="text-yellow-600 dark:text-yellow-500">
                              {turnsUntilEmpty}
                            </span>
                          ) : (
                            <span>{turnsUntilEmpty}</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
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
