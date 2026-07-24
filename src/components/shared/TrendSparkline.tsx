import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

import type { JSX } from "react";

export type TrendSparklinePoint = {
  readonly turnNumber: number;
  readonly value: number;
};

type TrendSparklineProps = {
  readonly color: string;
  readonly dataKey: string;
  readonly emptyMessage: string;
  readonly isLoading: boolean;
  readonly label: string;
  readonly points: readonly TrendSparklinePoint[];
  readonly turnLabel: (turn: number) => string;
};

const CHART_HEIGHT_CLASSNAME = "h-40 w-full";

/**
 * Compact per-turn line chart: skeleton while loading, empty message before
 * the first data point, otherwise a single-series sparkline. Purely
 * presentational — callers own querying and map their rows to points.
 */
export function TrendSparkline({
  color,
  dataKey,
  emptyMessage,
  isLoading,
  label,
  points,
  turnLabel,
}: TrendSparklineProps): JSX.Element {
  if (isLoading) {
    return <Skeleton className={CHART_HEIGHT_CLASSNAME} />;
  }

  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const config: ChartConfig = { [dataKey]: { color, label } };
  const data = points.map((point) => ({
    [dataKey]: point.value,
    turn: point.turnNumber,
    turnLabel: turnLabel(point.turnNumber),
  }));

  return (
    <ChartContainer config={config} className={CHART_HEIGHT_CLASSNAME}>
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
          dataKey={dataKey}
          stroke={color}
          dot={false}
          connectNulls
          strokeWidth={2}
        />
      </LineChart>
    </ChartContainer>
  );
}
