import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { getErrorDescription } from "@/lib/errorUtils";

import { nationSettlementsQueryOptions } from "../../queries/nationsQueries";

import type { NationSettlement } from "../../types/nationTypes";
import type { JSX } from "react";

export function NationSettlementsSection({
  nationId,
  worldId,
}: {
  readonly nationId: string;
  readonly worldId: string;
}): JSX.Element {
  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nationId));

  return (
    <section
      aria-labelledby="nation-settlements-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <h2 id="nation-settlements-heading" className="text-base font-medium">
        Settlements
      </h2>
      {settlementsQuery.isPending ? (
        <LoadingState label="Loading settlements…" />
      ) : settlementsQuery.isError ? (
        <ErrorState
          title="Settlements could not be loaded"
          description={getErrorDescription(settlementsQuery.error)}
        />
      ) : settlementsQuery.data.length === 0 ? (
        <EmptyState
          title="No settlements"
          description="This nation has no settlements yet."
        />
      ) : (
        <ul className="grid gap-2" aria-label="Settlements">
          {settlementsQuery.data.map((settlement) => (
            <NationSettlementListItem
              key={settlement.id}
              settlement={settlement}
              worldId={worldId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function NationSettlementListItem({
  settlement,
  worldId,
}: {
  readonly settlement: NationSettlement;
  readonly worldId: string;
}): JSX.Element {
  return (
    <li className="rounded-md border border-border bg-background p-3">
      <Link
        to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
        params={{
          nationId: settlement.nationId,
          settlementId: settlement.id,
          worldId,
        }}
        className="text-sm font-medium underline-offset-4 hover:underline"
      >
        {settlement.name}
      </Link>
    </li>
  );
}
