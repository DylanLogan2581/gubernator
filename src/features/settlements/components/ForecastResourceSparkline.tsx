import { Line, LineChart, ResponsiveContainer } from "recharts";

import type { JSX } from "react";

export type ForecastSparklinePoint = {
  readonly turn: number;
  readonly quantity: number;
};

type ForecastResourceSparklineProps = {
  readonly points: readonly ForecastSparklinePoint[];
};

const SPARKLINE_SIZE_CLASSNAME = "h-8 w-20";

/**
 * Tiny trend line for a single resource's recent stockpile levels, sourced
 * from the same per-turn snapshot rows the reports page charts use (#1041).
 * Deliberately axis/tooltip-free and fixed-size so it slots into a table
 * cell without stretching row height.
 */
export function ForecastResourceSparkline({
  points,
}: ForecastResourceSparklineProps): JSX.Element {
  if (points.length < 2) {
    return (
      <div
        className={`${SPARKLINE_SIZE_CLASSNAME} flex items-center justify-center`}
      >
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    );
  }

  return (
    <div className={SPARKLINE_SIZE_CLASSNAME} data-testid="forecast-sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...points]}>
          <Line
            type="monotone"
            dataKey="quantity"
            stroke="var(--chart-1)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
