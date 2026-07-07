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

// Flat-ish deltas (rounding, single-unit noise) still read as "rising" or
// "falling" if compared with strict >/< — treat anything under this share of
// the starting quantity as flat so stable resources actually render flat (#1057).
const FLAT_SLOPE_RATIO_THRESHOLD = 0.01;

type SparklineTrend = "rising" | "falling" | "flat";

function resolveSparklineTrend(
  points: readonly ForecastSparklinePoint[],
): SparklineTrend {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return "flat";
  const delta = last.quantity - first.quantity;
  const threshold =
    Math.max(Math.abs(first.quantity), Math.abs(last.quantity)) *
    FLAT_SLOPE_RATIO_THRESHOLD;
  if (Math.abs(delta) <= threshold) return "flat";
  return delta > 0 ? "rising" : "falling";
}

const SPARKLINE_TREND_STROKE: Record<SparklineTrend, string> = {
  rising: "var(--color-success-foreground)",
  falling: "var(--color-destructive)",
  flat: "var(--color-muted-foreground)",
};

/**
 * Tiny trend line for a single resource's recent stockpile levels, sourced
 * from the same per-turn snapshot rows the reports page charts use (#1041).
 * Deliberately axis/tooltip-free and fixed-size so it slots into a table
 * cell without stretching row height. Colored by slope direction so flat
 * near-identical lines still read as "stable" at a glance (#1057).
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

  const trend = resolveSparklineTrend(points);

  return (
    <div
      className={SPARKLINE_SIZE_CLASSNAME}
      data-testid="forecast-sparkline"
      data-trend={trend}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...points]}>
          <Line
            type="monotone"
            dataKey="quantity"
            stroke={SPARKLINE_TREND_STROKE[trend]}
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
