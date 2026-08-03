import { TrendSparkline } from "@/components/shared/TrendSparkline";

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

/**
 * Nation-wide total soldier count across turns, from army_turn_snapshots
 * (#1113). Empty before the upkeep phase's first snapshot.
 */
export function NationArmyStrengthSparkline({
  isLoading,
  points,
  turnLabel,
}: NationArmyStrengthSparklineProps): JSX.Element {
  return (
    <TrendSparkline
      color="var(--chart-2)"
      dataKey="soldier_count_total"
      emptyMessage="No army strength history yet."
      isLoading={isLoading}
      label="Soldiers"
      points={points.map((point) => ({
        turnNumber: point.turnNumber,
        value: point.soldierCountTotal,
      }))}
      turnLabel={turnLabel}
    />
  );
}
