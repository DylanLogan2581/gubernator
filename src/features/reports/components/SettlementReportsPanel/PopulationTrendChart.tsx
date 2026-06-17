import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import type { PopulationSnapshotRow } from "../../types/snapshotTypes";
import type { JSX } from "react";

type PopulationTrendChartProps = {
  readonly rows: readonly PopulationSnapshotRow[];
  readonly turnLabel: (turn: number) => string;
};

const populationLineConfig: ChartConfig = {
  population_cap: { color: "hsl(var(--chart-4))", label: "Cap" },
  population_npc: { color: "hsl(var(--chart-2))", label: "NPC" },
  population_player_character: {
    color: "hsl(var(--chart-3))",
    label: "Player characters",
  },
  population_total: { color: "hsl(var(--chart-1))", label: "Total" },
};

const eventsBarConfig: ChartConfig = {
  birth_count: { color: "hsl(var(--chart-2))", label: "Births" },
  death_count: { color: "hsl(var(--chart-1))", label: "Deaths" },
  homeless_deaths_count: {
    color: "hsl(var(--chart-4))",
    label: "Homeless deaths",
  },
  starvation_deaths_count: {
    color: "hsl(var(--chart-3))",
    label: "Starvation deaths",
  },
};

export function PopulationTrendChart({
  rows,
  turnLabel,
}: PopulationTrendChartProps): JSX.Element {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No population snapshots in this turn range.
      </p>
    );
  }

  const lineData = rows.map((r) => ({
    population_cap: r.population_cap,
    population_npc: r.population_npc,
    population_player_character: r.population_player_character,
    population_total: r.population_total,
    turn: r.turn_number,
    turnLabel: turnLabel(r.turn_number),
  }));

  const barData = rows.map((r) => ({
    birth_count: r.birth_count,
    death_count: r.death_count,
    homeless_deaths_count: r.homeless_deaths_count,
    starvation_deaths_count: r.starvation_deaths_count,
    turn: r.turn_number,
    turnLabel: turnLabel(r.turn_number),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">
          Population over time
        </h3>
        <ChartContainer config={populationLineConfig} className="h-56 w-full">
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="turnLabel"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} width={40} />
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
              dataKey="population_total"
              stroke="hsl(var(--chart-1))"
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="population_npc"
              stroke="hsl(var(--chart-2))"
              dot={false}
              strokeWidth={1.5}
            />
            <Line
              type="monotone"
              dataKey="population_player_character"
              stroke="hsl(var(--chart-3))"
              dot={false}
              strokeWidth={1.5}
            />
            <Line
              type="monotone"
              dataKey="population_cap"
              stroke="hsl(var(--chart-4))"
              dot={false}
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
          </LineChart>
        </ChartContainer>
        <div className="flex flex-wrap gap-4 mt-2 text-xs">
          {Object.entries(populationLineConfig).map(([key, conf]) => (
            <span key={key} className="flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-5 rounded-sm"
                style={{ background: conf.color as string }}
              />
              {conf.label as string}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">
          Births and deaths per turn
        </h3>
        <ChartContainer config={eventsBarConfig} className="h-48 w-full">
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="turnLabel"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} width={40} />
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
            <Bar
              dataKey="birth_count"
              stackId="events"
              fill="hsl(var(--chart-2))"
            />
            <Bar
              dataKey="death_count"
              stackId="events"
              fill="hsl(var(--chart-1))"
            />
            <Bar
              dataKey="starvation_deaths_count"
              stackId="events"
              fill="hsl(var(--chart-3))"
            />
            <Bar
              dataKey="homeless_deaths_count"
              stackId="events"
              fill="hsl(var(--chart-4))"
            />
          </BarChart>
        </ChartContainer>
        <div className="flex flex-wrap gap-4 mt-2 text-xs">
          {Object.entries(eventsBarConfig).map(([key, conf]) => (
            <span key={key} className="flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-5 rounded-sm"
                style={{ background: conf.color as string }}
              />
              {conf.label as string}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
