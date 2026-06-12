import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock } from "lucide-react";

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

import { settlementForecastQueryOptions } from "../queries/settlementForecastQueries";

import type { JSX } from "react";

type ForecastPanelProps = {
  readonly settlementId: string;
  readonly worldId: string;
};

export function ForecastPanel({
  settlementId: _settlementId,
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

  if (forecastQuery.data === null) {
    return (
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>No Forecast Available</AlertTitle>
        <AlertDescription>
          Complete a turn to generate a forecast for this settlement.
        </AlertDescription>
      </Alert>
    );
  }

  if (forecastQuery.data === undefined) {
    return (
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>No Forecast Available</AlertTitle>
        <AlertDescription>
          Complete a turn to generate a forecast for this settlement.
        </AlertDescription>
      </Alert>
    );
  }

  return <ForecastPanelContent />;
}

function ForecastPanelContent(): JSX.Element {
  // TODO: Parse forecast.forecastSnapshot and display structured data
  // For now, render a placeholder

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Resources Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Per-resource forecast table will display here. Net per turn and
            turns-until-empty calculations based on current assignments and
            trade routes.
          </div>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="resources">
          <AccordionTrigger>Resources Table</AccordionTrigger>
          <AccordionContent>
            <div className="text-sm text-muted-foreground">
              Per-resource forecast: net per turn, turns until empty
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="warnings">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              Warnings
              <Badge variant="outline" className="ml-2">
                0
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="text-sm text-muted-foreground">
              Starvation risk, upkeep failure, trade pause
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="upcoming">
          <AccordionTrigger>Upcoming Events</AccordionTrigger>
          <AccordionContent>
            <div className="text-sm text-muted-foreground">
              Construction completions and event activations
            </div>
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
