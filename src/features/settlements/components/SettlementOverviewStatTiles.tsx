import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarCheck2, Users, Wheat, Zap } from "lucide-react";

import { StatTile } from "@/components/shared/StatTile";
import { settlementBuildingsBySettlementQueryOptions } from "@/features/buildings";
import { citizensDirectoryQueryOptions } from "@/features/citizens";
import { activeSettlementEventsQueryOptions } from "@/features/events";
import { settlementStockpilesByIdQueryOptions } from "@/features/resources";

import { settlementForecastQueryOptions } from "../queries/settlementForecastQueries";
import { settlementReadinessListQueryOptions } from "../queries/settlementReadinessQueries";
import { deriveSettlementReadinessState } from "../utils/settlementReadinessState";

import { getReadinessStateLabel } from "./SettlementReadinessDisplayText";

import type { JSX } from "react";

const POPULATION_PAGINATION = { pageIndex: 0, pageSize: 1 } as const;
const ALIVE_FILTER = { status: "alive" } as const;
const ACTIVE_BUILDING_STATES = new Set(["active", "suspended"]);
const AT_RISK_TURNS_THRESHOLD = 3;

type SettlementOverviewStatTilesProps = {
  readonly settlementId: string;
  readonly worldId: string;
};

/**
 * At-a-glance stat-tile row for the settlement overview. Each tile owns its
 * own query (via shared React Query cache keys, so no duplicate network
 * calls happen when other panels on the page request the same data).
 */
export function SettlementOverviewStatTiles({
  settlementId,
  worldId,
}: SettlementOverviewStatTilesProps): JSX.Element {
  const populationQuery = useQuery(
    citizensDirectoryQueryOptions(
      worldId,
      { ...ALIVE_FILTER, settlementId },
      POPULATION_PAGINATION,
    ),
  );
  const buildingsQuery = useQuery(
    settlementBuildingsBySettlementQueryOptions(settlementId),
  );
  const readinessQuery = useQuery(settlementReadinessListQueryOptions(worldId));
  const forecastQuery = useQuery(settlementForecastQueryOptions(worldId));
  const stockpilesQuery = useQuery(
    settlementStockpilesByIdQueryOptions(settlementId),
  );
  const activeEventsQuery = useQuery(
    activeSettlementEventsQueryOptions(worldId, settlementId),
  );

  const activeBuildingCount = (buildingsQuery.data ?? []).filter((building) =>
    ACTIVE_BUILDING_STATES.has(building.state),
  ).length;

  const readinessItem =
    readinessQuery.data?.find((entry) => entry.id === settlementId) ?? null;
  const readinessState =
    readinessItem === null
      ? null
      : deriveSettlementReadinessState(readinessItem);

  const forecast =
    forecastQuery.data?.forecastSnapshot.bySettlement[settlementId] ?? null;
  const foodStockpile =
    (stockpilesQuery.data ?? []).find(
      (stockpile) =>
        stockpile.isSystemResource &&
        stockpile.resourceName.toLowerCase() === "food",
    ) ?? null;
  const foodDelta =
    forecast === null || foodStockpile === null
      ? null
      : (forecast.resourceDeltas.find(
          (delta) => delta.resourceId === foodStockpile.resourceId,
        ) ?? null);

  const atRiskResourceCount =
    forecast === null
      ? 0
      : forecast.resourceDeltas.filter((delta) => {
          if (delta.netDelta >= 0 || delta.quantityBefore <= 0) return false;
          return (
            Math.floor(delta.quantityBefore / -delta.netDelta) <=
            AT_RISK_TURNS_THRESHOLD
          );
        }).length;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <StatTile
        icon={Users}
        label="Population"
        value={(populationQuery.data?.totalCount ?? 0).toLocaleString()}
        context="Living citizens"
        isLoading={populationQuery.isPending}
      />
      <StatTile
        icon={Building2}
        label="Buildings"
        value={activeBuildingCount}
        context="Active or suspended"
        isLoading={buildingsQuery.isPending}
      />
      <StatTile
        icon={CalendarCheck2}
        label="Readiness"
        value={
          readinessState === null ? "—" : getReadinessStateLabel(readinessState)
        }
        context={
          readinessState === null
            ? undefined
            : readinessState.isReadyForCurrentTurn
              ? "Ready for this turn"
              : "Not ready for this turn"
        }
        tone={
          readinessState === null
            ? "default"
            : readinessState.isReadyForCurrentTurn
              ? "success"
              : "warning"
        }
        isLoading={readinessQuery.isPending}
      />
      <StatTile
        icon={Wheat}
        label="Net food/turn"
        value={
          foodDelta === null
            ? "—"
            : `${foodDelta.netDelta > 0 ? "+" : ""}${foodDelta.netDelta.toLocaleString()}`
        }
        context={
          atRiskResourceCount > 0
            ? `${atRiskResourceCount} resource${atRiskResourceCount === 1 ? "" : "s"} ≤3 turns cover`
            : foodStockpile === null
              ? "No food resource tracked"
              : "Stable for this turn"
        }
        tone={atRiskResourceCount > 0 ? "warning" : "default"}
        isLoading={forecastQuery.isPending || stockpilesQuery.isPending}
      />
      <StatTile
        icon={Zap}
        label="Active events"
        value={activeEventsQuery.data?.length ?? 0}
        context="Currently affecting this settlement"
        isLoading={activeEventsQuery.isPending}
      />
    </div>
  );
}
