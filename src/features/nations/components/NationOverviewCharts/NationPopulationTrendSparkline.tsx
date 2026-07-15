import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { NationPopulationAggregateRow } from "@/features/reports";

import type { JSX } from "react";

type NationPopulationTrendSparklineProps = {
  readonly isLoading: boolean;
  readonly rows: readonly NationPopulationAggregateRow[];
  readonly turnLabel: (turn: number) => string;
};

const populationTrendConfig: ChartConfig = {
  population_total: { color: "var(--chart-1)", label: "Population" },
};

const CHART_HEIGHT_CLASSNAME = "h-40 w-full";

/**
 * Compact nation-wide population trend over recent turns, sourced from the
 * same per-turn snapshot aggregates the full reports page charts use.
 */
export function NationPopulationTrendSparkline({
  isLoading,
  rows,
  turnLabel,
}: NationPopulationTrendSparklineProps): JSX.Element {
  if (isLoading) {
    return <Skeleton className={CHART_HEIGHT_CLASSNAME} />;
  }

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No population history yet.
      </p>
    );
  }

  const data = rows.map((row) => ({
    population_total: row.population_total,
    turn: row.turn_number,
    turnLabel: turnLabel(row.turn_number),
  }));

  return (
    <ChartContainer
      config={populationTrendConfig}
      className={CHART_HEIGHT_CLASSNAME}
    >
      <LineChart data={data} margin={{ right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="turnLabel"
          tick={{ fontSize: 10 }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 10 }} width={36} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) =>
                (payload[0]?.payload as { turnLabel: string } | undefined)
                  ?.turnLabel ?? ""
              }
            />
          }
        />
        <Line
          type="monotone"
          dataKey="population_total"
          stroke="var(--chart-1)"
          dot={false}
          connectNulls
          strokeWidth={2}
        />
      </LineChart>
    </ChartContainer>
  );
}
