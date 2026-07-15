import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  categoricalForegroundCssVar,
  hashToCategoricalSlot,
} from "@/lib/categoricalPalette";

import type { NationSettlement } from "../../types/nationTypes";
import type { JSX } from "react";

type NationSettlementPopulationChartProps = {
  readonly isLoading: boolean;
  readonly settlements: readonly NationSettlement[];
};

const chartConfig: ChartConfig = {
  population: { label: "Population" },
};

const CHART_HEIGHT_CLASSNAME = "h-56 w-full";

/**
 * Horizontal bar chart of current population per settlement. Bar (and
 * legend swatch) colors come from the shared categorical palette, keyed by
 * settlement id, so a settlement keeps the same color anywhere else in the
 * app that also derives its color from `hashToCategoricalSlot`.
 */
export function NationSettlementPopulationChart({
  isLoading,
  settlements,
}: NationSettlementPopulationChartProps): JSX.Element {
  if (isLoading) {
    return <Skeleton className={CHART_HEIGHT_CLASSNAME} />;
  }

  if (settlements.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No settlements yet.
      </p>
    );
  }

  const data = [...settlements]
    .sort((a, b) => b.population - a.population)
    .map((settlement) => ({
      fill: categoricalForegroundCssVar(hashToCategoricalSlot(settlement.id)),
      name: settlement.name,
      population: settlement.population,
      settlementId: settlement.id,
    }));

  return (
    <div className="space-y-3">
      <ChartContainer config={chartConfig} className={CHART_HEIGHT_CLASSNAME}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 20 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11 }}
            width={96}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  (payload[0]?.payload as { name: string } | undefined)?.name ??
                  ""
                }
              />
            }
          />
          <Bar dataKey="population" radius={4}>
            {data.map((entry) => (
              <Cell key={entry.settlementId} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {data.map((entry) => (
          <span key={entry.settlementId} className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: entry.fill }}
            />
            {entry.name}
          </span>
        ))}
      </div>
    </div>
  );
}
