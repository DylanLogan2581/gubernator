import { TrendSparkline } from "@/components/shared/TrendSparkline";
import type { NationPopulationAggregateRow } from "@/features/reports";

import type { JSX } from "react";

type NationPopulationTrendSparklineProps = {
  readonly isLoading: boolean;
  readonly rows: readonly NationPopulationAggregateRow[];
  readonly turnLabel: (turn: number) => string;
};

/**
 * Compact nation-wide population trend over recent turns, sourced from the
 * same per-turn snapshot aggregates the full reports page charts use.
 */
export function NationPopulationTrendSparkline({
  isLoading,
  rows,
  turnLabel,
}: NationPopulationTrendSparklineProps): JSX.Element {
  return (
    <TrendSparkline
      color="var(--chart-1)"
      dataKey="population_total"
      emptyMessage="No population history yet."
      isLoading={isLoading}
      label="Population"
      points={rows.map((row) => ({
        turnNumber: row.turn_number,
        value: row.population_total,
      }))}
      turnLabel={turnLabel}
    />
  );
}
