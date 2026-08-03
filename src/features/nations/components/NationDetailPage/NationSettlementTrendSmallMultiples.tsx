import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { NationSettlementSnapshotRow } from "@/features/reports";
import {
  categoricalForegroundCssVar,
  hashToCategoricalSlot,
} from "@/lib/categoricalPalette";

import type { JSX } from "react";

type NationSettlementTrendSmallMultiplesProps = {
  readonly rows: readonly NationSettlementSnapshotRow[];
  readonly turnLabel: (turn: number) => string;
};

type SettlementSeries = {
  readonly settlementId: string;
  readonly settlementName: string;
  readonly color: string;
  readonly points: ReadonlyArray<{
    turn: number;
    turnLabel: string;
    population: number;
  }>;
};

function buildSeries(
  rows: readonly NationSettlementSnapshotRow[],
  turnLabel: (turn: number) => string,
): SettlementSeries[] {
  const bySettlement = new Map<
    string,
    {
      name: string;
      points: { turn: number; turnLabel: string; population: number }[];
    }
  >();

  for (const row of rows) {
    const existing = bySettlement.get(row.settlement_id);
    const point = {
      population: row.population_total,
      turn: row.turn_number,
      turnLabel: turnLabel(row.turn_number),
    };
    if (existing === undefined) {
      bySettlement.set(row.settlement_id, {
        name: row.settlement_name,
        points: [point],
      });
    } else {
      existing.points.push(point);
    }
  }

  return Array.from(bySettlement.entries())
    .map(([id, s]) => ({
      color: categoricalForegroundCssVar(hashToCategoricalSlot(id)),
      points: s.points,
      settlementId: id,
      settlementName: s.name,
    }))
    .sort((a, b) => a.settlementName.localeCompare(b.settlementName));
}

const chartConfig: ChartConfig = { population: { label: "Population" } };

/**
 * Small-multiples population trend, one mini line chart per settlement,
 * instead of a single blended nation-wide line — keeps per-settlement
 * shape legible rather than averaging it away (#1038).
 */
export function NationSettlementTrendSmallMultiples({
  rows,
  turnLabel,
}: NationSettlementTrendSmallMultiplesProps): JSX.Element {
  const series = buildSeries(rows, turnLabel);

  if (series.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No settlement data in this turn range.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {series.map((s) => (
        <div key={s.settlementId}>
          <h4 className="mb-1.5 truncate text-xs font-medium text-muted-foreground">
            {s.settlementName}
          </h4>
          <ChartContainer config={chartConfig} className="h-28 w-full">
            <LineChart data={[...s.points]} margin={{ right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="turnLabel"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10 }} width={32} allowDecimals={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelKey="turnLabel"
                    labelFormatter={(_, payload) =>
                      (payload[0]?.payload as { turnLabel: string } | undefined)
                        ?.turnLabel ?? ""
                    }
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="population"
                stroke={s.color}
                dot={false}
                connectNulls
                strokeWidth={2}
              />
            </LineChart>
          </ChartContainer>
        </div>
      ))}
    </div>
  );
}
