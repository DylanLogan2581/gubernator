import { useQuery } from "@tanstack/react-query";
import { Building2, Handshake, Users, Zap } from "lucide-react";

import { StatTile } from "@/components/shared/StatTile";
import { activeNationEventsQueryOptions } from "@/features/events";

import { nationRelationshipsFromNationQueryOptions } from "../queries/nationRelationshipQueries";
import { nationSettlementsQueryOptions } from "../queries/nationsQueries";

import type { NationRelationshipStance } from "../types/nationRelationshipTypes";
import type { JSX } from "react";

const ACTIVE_STANCES = new Set<NationRelationshipStance>([
  "friendly",
  "hostile",
  "at_war",
  "allied",
  "non_aggression_pact",
]);
const HOSTILE_STANCES = new Set<NationRelationshipStance>([
  "hostile",
  "at_war",
]);

type NationOverviewStatTilesProps = {
  readonly nationId: string;
  readonly worldId: string;
};

/**
 * At-a-glance stat-tile row for the nation overview. Each tile owns its own
 * query (via shared React Query cache keys, so no duplicate network calls
 * happen when other panels on the page request the same data).
 */
export function NationOverviewStatTiles({
  nationId,
  worldId,
}: NationOverviewStatTilesProps): JSX.Element {
  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nationId));
  const relationshipsQuery = useQuery(
    nationRelationshipsFromNationQueryOptions(nationId),
  );
  const activeEventsQuery = useQuery(
    activeNationEventsQueryOptions(worldId, nationId),
  );

  const settlements = settlementsQuery.data ?? [];
  const totalPopulation = settlements.reduce(
    (sum, settlement) => sum + settlement.population,
    0,
  );

  const relationships = relationshipsQuery.data ?? [];
  const activeRelationshipCount = relationships.filter((relationship) =>
    ACTIVE_STANCES.has(relationship.currentStance),
  ).length;
  const hostileRelationshipCount = relationships.filter((relationship) =>
    HOSTILE_STANCES.has(relationship.currentStance),
  ).length;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatTile
        icon={Building2}
        label="Settlements"
        value={settlements.length}
        context="Settlements in this nation"
        isLoading={settlementsQuery.isPending}
      />
      <StatTile
        icon={Users}
        label="Population"
        value={totalPopulation.toLocaleString()}
        context="Across all settlements"
        isLoading={settlementsQuery.isPending}
      />
      <StatTile
        icon={Handshake}
        label="Relationships"
        value={activeRelationshipCount}
        context={
          hostileRelationshipCount > 0
            ? `${hostileRelationshipCount} hostile or at war`
            : "Non-neutral stances"
        }
        tone={hostileRelationshipCount > 0 ? "warning" : "default"}
        isLoading={relationshipsQuery.isPending}
      />
      <StatTile
        icon={Zap}
        label="Active events"
        value={activeEventsQuery.data?.length ?? 0}
        context="Currently affecting this nation"
        isLoading={activeEventsQuery.isPending}
      />
    </div>
  );
}
