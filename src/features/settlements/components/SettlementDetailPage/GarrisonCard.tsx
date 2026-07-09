import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  armiesBySettlementQueryOptions,
  armySoldierCountsQueryOptions,
  armyUnitSoldierCountsByArmyIdsQueryOptions,
  formatArmyFundingSource,
  unitTypesByWorldQueryOptions,
  type Army,
  type ArmyUnitSoldierCount,
} from "@/features/military";
import { resourcesByWorldQueryOptions } from "@/features/resources";
import { computeArmyUpkeepRequirement } from "@/shared/military";

import type { JSX } from "react";

type GarrisonCardProps = {
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

/**
 * Armies stationed at this settlement — upkeep drawn from the settlement's
 * own stockpile (funding_source = host_settlement) and a food-demand note
 * for every army regardless of funding source, since soldiers always
 * consume at their stationed settlement (#1111). Hidden entirely when no
 * armies are stationed here.
 */
export function GarrisonCard({
  nationId,
  settlementId,
  worldId,
}: GarrisonCardProps): JSX.Element | null {
  const armiesQuery = useQuery(armiesBySettlementQueryOptions(settlementId));
  const armies = armiesQuery.data ?? [];
  const armyIds = useMemo(
    () => (armiesQuery.data ?? []).map((army) => army.id),
    [armiesQuery.data],
  );

  const soldierCountsQuery = useQuery(armySoldierCountsQueryOptions(armyIds));
  const unitSoldierCountsQuery = useQuery(
    armyUnitSoldierCountsByArmyIdsQueryOptions(armyIds),
  );
  const unitTypesQuery = useQuery(unitTypesByWorldQueryOptions(worldId));
  const resourcesQuery = useQuery(resourcesByWorldQueryOptions(worldId));

  if (armiesQuery.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Garrison</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (armiesQuery.isError || armies.length === 0) {
    return null;
  }

  const unitTypeById = new Map(
    (unitTypesQuery.data ?? []).map((unitType) => [unitType.id, unitType]),
  );
  const resourceNameById = new Map(
    (resourcesQuery.data ?? []).map((resource) => [resource.id, resource.name]),
  );
  const unitSoldierCountsByArmyId = new Map<string, ArmyUnitSoldierCount[]>();
  for (const row of unitSoldierCountsQuery.data ?? []) {
    const list = unitSoldierCountsByArmyId.get(row.armyId) ?? [];
    list.push(row);
    unitSoldierCountsByArmyId.set(row.armyId, list);
  }

  function formatUpkeep(army: Army): string | null {
    if (army.fundingSource !== "host_settlement") return null;

    const units = (unitSoldierCountsByArmyId.get(army.id) ?? []).flatMap(
      (row) => {
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
      },
    );
    const requiredByResourceId = computeArmyUpkeepRequirement(units);
    if (requiredByResourceId.size === 0) return "No upkeep cost";

    const parts = [...requiredByResourceId.entries()]
      .filter(([, amount]) => amount > 0)
      .map(([resourceId, amount]) => {
        const name = resourceNameById.get(resourceId) ?? "unknown resource";
        return `${amount.toLocaleString()} ${name}`;
      });
    return parts.length === 0 ? "No upkeep cost" : `${parts.join(", ")} / turn`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Garrison</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {armies.map((army) => {
          const soldierCount = soldierCountsQuery.data?.[army.id] ?? 0;
          const upkeep = formatUpkeep(army);

          return (
            <div
              key={army.id}
              className="grid gap-1 rounded-lg border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  className="font-medium hover:underline"
                  params={{ nationId, worldId }}
                  to="/worlds/$worldId/nations/$nationId/military"
                >
                  {army.name}
                </Link>
                <Badge variant="secondary">{soldierCount} soldiers</Badge>
                <Badge variant="outline">
                  {formatArmyFundingSource(army.fundingSource)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Adds {soldierCount} citizen{soldierCount === 1 ? "" : "s"} to
                food demand here.
              </p>
              {upkeep !== null ? (
                <p className="text-xs text-muted-foreground">
                  Upkeep: {upkeep} drawn from this settlement.
                </p>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
