import { useQuery } from "@tanstack/react-query";
import { Building2, Coins, Users, Zap } from "lucide-react";

import { StatStrip } from "@/components/shared/StatStrip";
import { StatTile } from "@/components/shared/StatTile";
import { activeNationEventsQueryOptions } from "@/features/events";

import { nationCurrencyQueryOptions } from "../queries/currencyQueries";
import { nationSettlementsQueryOptions } from "../queries/nationsQueries";
import { formatNationCurrencyType } from "../types/currencyTypes";

import type { JSX } from "react";

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
  const currencyQuery = useQuery(nationCurrencyQueryOptions(nationId));
  const activeEventsQuery = useQuery(
    activeNationEventsQueryOptions(worldId, nationId),
  );

  const settlements = settlementsQuery.data ?? [];
  const totalPopulation = settlements.reduce(
    (sum, settlement) => sum + settlement.population,
    0,
  );

  const currency = currencyQuery.data ?? null;

  return (
    <StatStrip className="md:grid-cols-4 md:gap-x-0 md:divide-x md:divide-border md:[&>*]:px-4 md:[&>*:first-child]:pl-0 md:[&>*:last-child]:pr-0">
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
        icon={Coins}
        label="Treasury"
        value={
          currency === null
            ? "None"
            : `${currency.symbol}${currency.moneySupply.toLocaleString()}`
        }
        context={
          currency === null
            ? "No currency established"
            : formatNationCurrencyType(currency.currencyType)
        }
        isLoading={currencyQuery.isPending}
      />
      <StatTile
        icon={Zap}
        label="Active events"
        value={activeEventsQuery.data?.length ?? 0}
        context="Currently affecting this nation"
        isLoading={activeEventsQuery.isPending}
      />
    </StatStrip>
  );
}
