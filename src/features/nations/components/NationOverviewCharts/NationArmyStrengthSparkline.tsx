import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

import type { JSX } from "react";

export type ArmyStrengthTrendPoint = {
  readonly soldierCountTotal: number;
  readonly turnNumber: number;
};

type NationArmyStrengthSparklineProps = {
  readonly isLoading: boolean;
  readonly points: readonly ArmyStrengthTrendPoint[];
  readonly turnLabel: (turn: number) => string;
};

const armyStrengthConfig: ChartConfig = {
  soldier_count_total: { color: "var(--chart-2)", label: "Soldiers" },
};

const CHART_HEIGHT_CLASSNAME = "h-40 w-full";

/**
 * Nation-wide total soldier count across turns, from army_turn_snapshots
 * (#1113). Empty before the upkeep phase's first snapshot.
 */
export function NationArmyStrengthSparkline({
  isLoading,
  points,
  turnLabel,
}: NationArmyStrengthSparklineProps): JSX.Element {
  if (isLoading) {
    return <Skeleton className={CHART_HEIGHT_CLASSNAME} />;
  }

  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No army strength history yet.
      </p>
    );
  }

  const data = points.map((point) => ({
    soldier_count_total: point.soldierCountTotal,
    turn: point.turnNumber,
    turnLabel: turnLabel(point.turnNumber),
  }));

  return (
    <ChartContainer
      config={armyStrengthConfig}
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
          dataKey="soldier_count_total"
          stroke="var(--chart-2)"
          dot={false}
          connectNulls
          strokeWidth={2}
        />
      </LineChart>
    </ChartContainer>
  );
}
