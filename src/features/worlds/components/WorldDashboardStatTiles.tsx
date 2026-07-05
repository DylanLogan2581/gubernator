import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Flag, Users, Zap } from "lucide-react";

import { StatTile } from "@/components/shared/StatTile";
import { citizensDirectoryQueryOptions } from "@/features/citizens";
import {
  eventsListQueryOptions,
  type EventListFilters,
} from "@/features/events";
import { nationsListQueryOptions } from "@/features/nations";
import {
  formatSettlementReadinessPercentage,
  settlementReadinessSummaryQueryOptions,
} from "@/features/settlements";

import type { JSX } from "react";

const POPULATION_PAGINATION = { pageIndex: 0, pageSize: 1 } as const;
const ALIVE_FILTER = { status: "alive" } as const;
const ACTIVE_EVENTS_FILTER: EventListFilters = { statusFilter: ["active"] };

type WorldDashboardStatTilesProps = {
  readonly worldId: string;
};

/**
 * At-a-glance stat-tile row for the world dashboard. Each tile owns its own
 * query (via shared React Query cache keys, so no duplicate network calls
 * happen when other panels on the page request the same data).
 */
export function WorldDashboardStatTiles({
  worldId,
}: WorldDashboardStatTilesProps): JSX.Element {
  const nationsQuery = useQuery(nationsListQueryOptions(worldId));
  const readinessQuery = useQuery(
    settlementReadinessSummaryQueryOptions(worldId),
  );
  const populationQuery = useQuery(
    citizensDirectoryQueryOptions(worldId, ALIVE_FILTER, POPULATION_PAGINATION),
  );
  const activeEventsQuery = useQuery(
    eventsListQueryOptions(worldId, ACTIVE_EVENTS_FILTER),
  );

  const readySettlementCount = readinessQuery.data?.readySettlementCount ?? 0;
  const totalSettlementCount = readinessQuery.data?.totalSettlementCount ?? 0;
  const allReady =
    totalSettlementCount > 0 && readySettlementCount === totalSettlementCount;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <StatTile
        icon={Flag}
        label="Nations"
        value={nationsQuery.data?.length ?? 0}
        context="Nations in this world"
        isLoading={nationsQuery.isPending}
      />
      <StatTile
        icon={Building2}
        label="Settlements"
        value={totalSettlementCount}
        context="Across all nations"
        isLoading={readinessQuery.isPending}
      />
      <StatTile
        icon={Users}
        label="Population"
        value={(populationQuery.data?.totalCount ?? 0).toLocaleString()}
        context="Living citizens"
        isLoading={populationQuery.isPending}
      />
      <StatTile
        icon={CheckCircle2}
        label="Settlements ready"
        value={`${String(readySettlementCount)}/${String(totalSettlementCount)}`}
        context={
          readinessQuery.data === undefined
            ? undefined
            : `${formatSettlementReadinessPercentage(readinessQuery.data.readyPercentage)} ready for this turn`
        }
        tone={
          totalSettlementCount === 0
            ? "default"
            : allReady
              ? "success"
              : "warning"
        }
        isLoading={readinessQuery.isPending}
      />
      <StatTile
        icon={Zap}
        label="Active events"
        value={activeEventsQuery.data?.length ?? 0}
        context="Currently affecting the world"
        isLoading={activeEventsQuery.isPending}
      />
    </div>
  );
}
