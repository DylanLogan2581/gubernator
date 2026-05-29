import { useQuery, type QueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { useActivePlayerCharacter } from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";

import {
  nationRelationshipsFromNationQueryOptions,
  nationRelationshipsToNationQueryOptions,
} from "../../queries/nationRelationshipQueries";
import { nationsListQueryOptions } from "../../queries/nationsQueries";

import { NationRelationshipRow } from "./RelationshipRow";

import type { NationRelationship } from "../../types/nationRelationshipTypes";
import type { Nation } from "../../types/nationTypes";
import type { JSX } from "react";

export function NationRelationshipsSection({
  canAdminWorld,
  isArchived,
  nation,
  queryClient,
}: {
  readonly canAdminWorld: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const { activeCharacter } = useActivePlayerCharacter();
  const isNationManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === nation.id &&
    activeCharacter.status === "alive";
  const canControl = (canAdminWorld || isNationManager) && !isArchived;

  const nationsQuery = useQuery(nationsListQueryOptions(nation.worldId));
  const outgoingQuery = useQuery(
    nationRelationshipsFromNationQueryOptions(nation.id),
  );
  const incomingQuery = useQuery(
    nationRelationshipsToNationQueryOptions(nation.id),
  );

  return (
    <section
      aria-labelledby="nation-relationships-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="space-y-1">
        <h2 id="nation-relationships-heading" className="text-base font-medium">
          Relationships
        </h2>
        <p className="text-sm text-muted-foreground">
          Outgoing stances from {nation.name} and proposals awaiting either
          side.
        </p>
      </div>
      {nationsQuery.isPending ||
      outgoingQuery.isPending ||
      incomingQuery.isPending ? (
        <LoadingState label="Loading relationships…" />
      ) : nationsQuery.isError ? (
        <ErrorState
          title="Relationships could not be loaded"
          description={getErrorDescription(nationsQuery.error)}
        />
      ) : outgoingQuery.isError ? (
        <ErrorState
          title="Relationships could not be loaded"
          description={getErrorDescription(outgoingQuery.error)}
        />
      ) : incomingQuery.isError ? (
        <ErrorState
          title="Relationships could not be loaded"
          description={getErrorDescription(incomingQuery.error)}
        />
      ) : (
        <NationRelationshipsList
          canControl={canControl}
          incoming={incomingQuery.data}
          nation={nation}
          otherNations={nationsQuery.data.filter(
            (candidate) => candidate.id !== nation.id,
          )}
          outgoing={outgoingQuery.data}
          queryClient={queryClient}
        />
      )}
    </section>
  );
}

function NationRelationshipsList({
  canControl,
  incoming,
  nation,
  otherNations,
  outgoing,
  queryClient,
}: {
  readonly canControl: boolean;
  readonly incoming: readonly NationRelationship[];
  readonly nation: Nation;
  readonly otherNations: readonly Nation[];
  readonly outgoing: readonly NationRelationship[];
  readonly queryClient: QueryClient;
}): JSX.Element {
  if (otherNations.length === 0) {
    return (
      <EmptyState
        title="No other nations"
        description="This world has no other nations to relate to yet."
      />
    );
  }

  const outgoingByTo = new Map<string, NationRelationship>(
    outgoing.map((row) => [row.toNationId, row]),
  );
  const incomingByFrom = new Map<string, NationRelationship>(
    incoming.map((row) => [row.fromNationId, row]),
  );

  return (
    <ul className="grid gap-2" aria-label="Relationships">
      {otherNations.map((other) => (
        <NationRelationshipRow
          key={other.id}
          canControl={canControl}
          incoming={incomingByFrom.get(other.id) ?? null}
          nation={nation}
          other={other}
          outgoing={outgoingByTo.get(other.id) ?? null}
          queryClient={queryClient}
        />
      ))}
    </ul>
  );
}
