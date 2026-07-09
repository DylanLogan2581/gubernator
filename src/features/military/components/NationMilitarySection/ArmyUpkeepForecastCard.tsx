import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { nationStockpileQueryOptions } from "@/features/nations";
import {
  resourcesByWorldQueryOptions,
  settlementStockpilesByIdQueryOptions,
} from "@/features/resources";
import {
  computeArmyUpkeepRequirement,
  computeUnitProjectedDesertion,
  isUpkeepShortfall,
} from "@/shared/military";

import {
  armyUnitSoldierCountsByArmyIdsQueryOptions,
  type ArmyUnitSoldierCount,
} from "../../queries/armiesQueries";
import { unitTypesByWorldQueryOptions } from "../../queries/unitTypesQueries";
import { formatArmyFundingSource, type Army } from "../../types/armyTypes";

import type { JSX } from "react";

type ArmyUpkeepForecastCardProps = {
  readonly armies: readonly Army[];
  readonly nationId: string;
  readonly worldId: string;
};

/**
 * Next-turn upkeep total per army vs available stock in its funding
 * source, with a shortfall highlight and projected desertion counts.
 * Mirrors phaseMilitaryUpkeep exactly via the shared math module (#1113)
 * — this is a forecast against *current* stock, not a guarantee, since
 * other phases can still change the pool before upkeep runs next turn.
 */
export function ArmyUpkeepForecastCard({
  armies,
  nationId,
  worldId,
}: ArmyUpkeepForecastCardProps): JSX.Element | null {
  const armyIds = useMemo(() => armies.map((army) => army.id), [armies]);
  const settlementFundedArmies = armies.filter(
    (army) => army.fundingSource === "host_settlement",
  );
  const stationedSettlementIds = useMemo(
    () => [
      ...new Set(
        settlementFundedArmies.map((army) => army.stationedSettlementId),
      ),
    ],
    [settlementFundedArmies],
  );

  const unitsQuery = useQuery(
    armyUnitSoldierCountsByArmyIdsQueryOptions(armyIds),
  );
  const unitTypesQuery = useQuery(unitTypesByWorldQueryOptions(worldId));
  const resourcesQuery = useQuery(resourcesByWorldQueryOptions(worldId));
  const nationStockpileQuery = useQuery(nationStockpileQueryOptions(nationId));
  const settlementStockpileQueries = useQueries({
    queries: stationedSettlementIds.map((settlementId) =>
      settlementStockpilesByIdQueryOptions(settlementId),
    ),
  });

  if (armies.length === 0) {
    return null;
  }

  const isLoading =
    unitsQuery.isPending ||
    unitTypesQuery.isPending ||
    resourcesQuery.isPending ||
    nationStockpileQuery.isPending ||
    settlementStockpileQueries.some((query) => query.isPending);

  const unitTypeById = new Map(
    (unitTypesQuery.data ?? []).map((unitType) => [unitType.id, unitType]),
  );
  const resourceNameById = new Map(
    (resourcesQuery.data ?? []).map((resource) => [resource.id, resource.name]),
  );
  const unitsByArmyId = new Map<string, ArmyUnitSoldierCount[]>();
  for (const row of unitsQuery.data ?? []) {
    const list = unitsByArmyId.get(row.armyId) ?? [];
    list.push(row);
    unitsByArmyId.set(row.armyId, list);
  }

  const nationAvailableByResourceId = new Map(
    (nationStockpileQuery.data ?? []).map((entry) => [
      entry.resourceId,
      entry.quantity,
    ]),
  );
  const settlementAvailableByResourceIdBySettlementId = new Map(
    stationedSettlementIds.map((settlementId, index) => [
      settlementId,
      new Map(
        (settlementStockpileQueries[index]?.data ?? []).map((entry) => [
          entry.resourceId,
          entry.quantity,
        ]),
      ),
    ]),
  );

  function formatRequirement(
    requiredByResourceId: ReadonlyMap<string, number>,
  ): string {
    const parts = [...requiredByResourceId.entries()]
      .filter(([, amount]) => amount > 0)
      .map(
        ([resourceId, amount]) =>
          `${amount.toLocaleString()} ${resourceNameById.get(resourceId) ?? "unknown resource"}`,
      );
    return parts.length === 0 ? "No upkeep cost" : parts.join(", ");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upkeep forecast</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">
            Loading upkeep forecast…
          </p>
        ) : (
          armies.map((army) => {
            const units = (unitsByArmyId.get(army.id) ?? []).flatMap((row) => {
              const unitType = unitTypeById.get(row.unitTypeId);
              if (unitType === undefined) return [];
              return [
                {
                  desertionRate: unitType.desertionRate,
                  soldierCount: row.soldierCount,
                  unitId: row.unitId,
                  upkeepCostsJson: unitType.upkeepCostsJson,
                },
              ];
            });

            const requiredByResourceId = computeArmyUpkeepRequirement(units);
            const availableByResourceId =
              army.fundingSource === "nation"
                ? nationAvailableByResourceId
                : (settlementAvailableByResourceIdBySettlementId.get(
                    army.stationedSettlementId,
                  ) ?? new Map<string, number>());
            const shortfall = isUpkeepShortfall(
              requiredByResourceId,
              availableByResourceId,
            );
            const projectedDesertions = shortfall
              ? units.reduce(
                  (sum, unit) =>
                    sum +
                    computeUnitProjectedDesertion(
                      unit.soldierCount,
                      unit.desertionRate,
                    ),
                  0,
                )
              : 0;

            return (
              <div
                key={army.id}
                className={
                  shortfall
                    ? "grid gap-1 rounded-lg border border-destructive/60 bg-destructive/5 p-3 text-sm"
                    : "grid gap-1 rounded-lg border p-3 text-sm"
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{army.name}</span>
                  <Badge variant="outline">
                    {formatArmyFundingSource(army.fundingSource)}
                  </Badge>
                  {shortfall ? (
                    <Badge variant="destructive">Projected shortfall</Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Next-turn upkeep: {formatRequirement(requiredByResourceId)}
                </p>
                {shortfall ? (
                  <p className="text-xs text-destructive">
                    Projected desertions: {projectedDesertions} soldier
                    {projectedDesertions === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
