import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { SettlementFlagAvatar } from "@/features/settlements";
import { getErrorDescription } from "@/lib/errorUtils";

import { nationSettlementsQueryOptions } from "../../queries/nationsQueries";

export function CharterSettlementsSection({
  nationId,
  worldId,
}: {
  readonly nationId: string;
  readonly worldId: string;
}): JSX.Element {
  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nationId));

  return (
    <section
      className="grid gap-3"
      aria-labelledby="nation-charter-settlements-heading"
    >
      <div className="flex items-center gap-2">
        <Building2
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
        <h2
          id="nation-charter-settlements-heading"
          className="text-base font-medium"
        >
          Settlement charters
        </h2>
      </div>

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
        <ul className="grid gap-1 sm:grid-cols-2">
          {settlementsQuery.data.map((settlement) => (
            <li key={settlement.id}>
              <Link
                to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/government"
                params={{ nationId, settlementId: settlement.id, worldId }}
                className="flex items-center gap-2 text-sm underline-offset-4 hover:underline"
              >
                <SettlementFlagAvatar
                  className="w-6 shrink-0"
                  flagPath={settlement.flagPath}
                  settlementId={settlement.id}
                  settlementName={settlement.name}
                />
                {settlement.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
