import { useEffect, useState } from "react";
import { Line, LineChart } from "recharts";

import { Badge } from "@/components/ui/badge";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import {
  DIORAMA_INITIAL_TICK_INDEX,
  DIORAMA_SERIES,
  DIORAMA_TICK_INTERVAL_MS,
} from "../lib/dioramaSeries";

import type { JSX } from "react";

const stockpileChartConfig: ChartConfig = {
  stockpile: { color: "var(--chart-2)", label: "Stockpile" },
};

// A self-contained, client-only vignette: a fake settlement ticking through a
// fixed, precomputed sequence of turns. No network calls, no shared
// simulation code — purely decorative proof of the core loop for anon
// visitors.
export function HomeDioramaSection(): JSX.Element {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [tickIndex, setTickIndex] = useState(DIORAMA_INITIAL_TICK_INDEX);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTickIndex((index) => (index + 1) % DIORAMA_SERIES.length);
    }, DIORAMA_TICK_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion]);

  const currentTick = DIORAMA_SERIES[tickIndex];
  const chartData = DIORAMA_SERIES.slice(0, tickIndex + 1);

  return (
    <section
      aria-label="Live demo: a settlement growing turn by turn"
      className="flex flex-col gap-6 rounded-xl bg-card p-6 ring-1 ring-foreground/10 md:flex-row md:items-center"
    >
      <div className="flex flex-col gap-4 md:w-72 md:shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Watch a settlement grow</h2>
          <span className="text-sm text-muted-foreground">
            Turn {currentTick.tick + 1}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          A simulated settlement, not connected to any account, ticking through
          turns on its own.
        </p>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Population</p>
            <p className="text-3xl font-semibold tabular-nums">
              {currentTick.population}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stockpile</p>
            <p className="text-3xl font-semibold tabular-nums">
              {currentTick.stockpile}
            </p>
          </div>
        </div>
        <div className="flex h-6 items-center">
          {currentTick.event !== null ? (
            <Badge variant="secondary">{currentTick.event}</Badge>
          ) : null}
        </div>
      </div>
      <ChartContainer
        config={stockpileChartConfig}
        className="h-40 w-full md:h-48"
      >
        <LineChart data={[...chartData]}>
          <Line
            type="monotone"
            dataKey="stockpile"
            stroke="var(--chart-2)"
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </section>
  );
}
