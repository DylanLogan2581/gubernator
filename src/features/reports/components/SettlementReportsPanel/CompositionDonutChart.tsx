import { Cell, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

export type DonutSlice = {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly color: string;
  readonly icon?: LucideIcon;
};

type CompositionDonutChartProps = {
  readonly slices: readonly DonutSlice[];
  readonly emptyMessage: string;
};

const CHART_CONFIG: ChartConfig = {};

/**
 * Reusable donut for a composition breakdown (population by job, stockpile
 * by resource) — categorical color per slice, icon-or-swatch legend below.
 * Zero-value slices are dropped so the legend and tooltip don't clutter with
 * empty categories.
 */
export function CompositionDonutChart({
  slices,
  emptyMessage,
}: CompositionDonutChartProps): JSX.Element {
  const nonZero = slices.filter((slice) => slice.value > 0);

  if (nonZero.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ChartContainer config={CHART_CONFIG} className="h-48 w-full">
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent nameKey="label" hideLabel />}
          />
          <Pie
            data={[...nonZero]}
            dataKey="value"
            nameKey="label"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {nonZero.map((slice) => (
              // fill attr alone won't paint var(--...) colors in Chromium; the
              // style prop resolves through CSSOM so it does.
              <Cell
                key={slice.id}
                fill={slice.color}
                style={{ fill: slice.color }}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {nonZero.map((slice) => {
          const Icon = slice.icon;
          return (
            <li key={slice.id} className="flex items-center gap-1.5">
              {Icon !== undefined ? (
                <Icon
                  className="h-3 w-3 shrink-0"
                  style={{ color: slice.color }}
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: slice.color }}
                />
              )}
              <span>{slice.label}</span>
              <span className="text-muted-foreground">
                {slice.value.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
