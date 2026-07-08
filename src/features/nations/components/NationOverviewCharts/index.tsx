import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { worldCalendarConfigQueryOptions } from "@/features/calendar";
import { nationPopulationAggregatesQueryOptions } from "@/features/reports";
import {
  formatCalendarDateShort,
  resolveTurnCalendarDate,
} from "@/shared/turnCalendarPrimitives";

import { nationSettlementsQueryOptions } from "../../queries/nationsQueries";

import { NationDemographicsCard } from "./NationDemographicsCard";
import { NationPopulationTrendSparkline } from "./NationPopulationTrendSparkline";
import { NationSettlementPopulationChart } from "./NationSettlementPopulationChart";

import type { JSX } from "react";

// Recent-turns window for the trend sparkline — enough points to read a
// trend without the range controls the full reports page needs.
const TREND_TURN_WINDOW = 11;

type NationOverviewChartsProps = {
  readonly currentTurnNumber: number;
  readonly nationId: string;
  readonly worldId: string;
};

export function NationOverviewCharts({
  currentTurnNumber,
  nationId,
  worldId,
}: NationOverviewChartsProps): JSX.Element {
  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nationId));
  const calendarQuery = useQuery(worldCalendarConfigQueryOptions(worldId));
  const calendarConfig = calendarQuery.isSuccess ? calendarQuery.data : null;

  const toTurn = Math.max(1, currentTurnNumber);
  const fromTurn = Math.max(1, toTurn - TREND_TURN_WINDOW);
  const populationTrendQuery = useQuery(
    nationPopulationAggregatesQueryOptions(nationId, fromTurn, toTurn),
  );

  // Chart axis ticks use the short template so labels don't overflow.
  function turnLabel(turn: number): string {
    if (calendarConfig === null) return `T${String(turn)}`;
    try {
      return formatCalendarDateShort(
        resolveTurnCalendarDate(calendarConfig, turn),
        {
          shortDateFormatTemplate: calendarConfig.shortDateFormatTemplate,
        },
      );
    } catch {
      return `T${String(turn)}`;
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Population by settlement</CardTitle>
        </CardHeader>
        <CardContent>
          <NationSettlementPopulationChart
            isLoading={settlementsQuery.isPending}
            settlements={settlementsQuery.data ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Population trend</CardTitle>
        </CardHeader>
        <CardContent>
          <NationPopulationTrendSparkline
            isLoading={populationTrendQuery.isPending}
            rows={populationTrendQuery.data ?? []}
            turnLabel={turnLabel}
          />
        </CardContent>
      </Card>

      <NationDemographicsCard nationId={nationId} worldId={worldId} />
    </div>
  );
}
