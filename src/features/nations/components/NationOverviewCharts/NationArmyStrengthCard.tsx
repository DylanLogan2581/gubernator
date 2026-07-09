import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  armiesByNationQueryOptions,
  armyLatestSnapshotsQueryOptions,
  armyTurnSnapshotHistoryByArmyIdsQueryOptions,
  armyUnitSoldierCountsByArmyIdsQueryOptions,
} from "@/features/military";

import {
  NationArmyStrengthSparkline,
  type ArmyStrengthTrendPoint,
} from "./NationArmyStrengthSparkline";

import type { JSX } from "react";

type NationArmyStrengthCardProps = {
  readonly nationId: string;
  readonly turnLabel: (turn: number) => string;
};

/**
 * Army strength trend + at-a-glance totals, sourced from army_turn_snapshots
 * (#1113). Empty state before the upkeep phase's first snapshot.
 */
export function NationArmyStrengthCard({
  nationId,
  turnLabel,
}: NationArmyStrengthCardProps): JSX.Element {
  const armiesQuery = useQuery(armiesByNationQueryOptions(nationId));
  const armyIds = useMemo(
    () => (armiesQuery.data ?? []).map((army) => army.id),
    [armiesQuery.data],
  );

  const unitsQuery = useQuery(
    armyUnitSoldierCountsByArmyIdsQueryOptions(armyIds),
  );
  const latestSnapshotsQuery = useQuery(
    armyLatestSnapshotsQueryOptions(armyIds),
  );
  const historyQuery = useQuery(
    armyTurnSnapshotHistoryByArmyIdsQueryOptions(armyIds),
  );

  const isLoading =
    armiesQuery.isPending ||
    unitsQuery.isPending ||
    latestSnapshotsQuery.isPending ||
    historyQuery.isPending;

  const soldierCountTotalByTurn = new Map<number, number>();
  for (const snapshot of historyQuery.data ?? []) {
    soldierCountTotalByTurn.set(
      snapshot.turnNumber,
      (soldierCountTotalByTurn.get(snapshot.turnNumber) ?? 0) +
        snapshot.soldierCountTotal,
    );
  }
  const points: ArmyStrengthTrendPoint[] = [
    ...soldierCountTotalByTurn.entries(),
  ]
    .sort(([a], [b]) => a - b)
    .map(([turnNumber, soldierCountTotal]) => ({
      soldierCountTotal,
      turnNumber,
    }));

  const hasSnapshots = (historyQuery.data ?? []).length > 0;
  const totalSoldiers = hasSnapshots
    ? Object.values(latestSnapshotsQuery.data ?? {}).reduce(
        (sum, snapshot) => sum + snapshot.soldierCountTotal,
        0,
      )
    : null;
  const totalUnits = (unitsQuery.data ?? []).length;
  const totalArmies = (armiesQuery.data ?? []).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Army strength</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Soldiers</p>
            <p className="font-semibold">
              {isLoading ? "…" : (totalSoldiers?.toLocaleString() ?? "—")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Units</p>
            <p className="font-semibold">
              {isLoading ? "…" : totalUnits.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Armies</p>
            <p className="font-semibold">
              {isLoading ? "…" : totalArmies.toLocaleString()}
            </p>
          </div>
        </div>

        <NationArmyStrengthSparkline
          isLoading={isLoading}
          points={points}
          turnLabel={turnLabel}
        />
      </CardContent>
    </Card>
  );
}
