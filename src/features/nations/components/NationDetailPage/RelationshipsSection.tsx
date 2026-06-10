import { useQuery, type QueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useActivePlayerCharacter } from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";

import {
  nationRelationshipsFromNationQueryOptions,
  nationRelationshipsToNationQueryOptions,
} from "../../queries/nationRelationshipQueries";
import { nationsListQueryOptions } from "../../queries/nationsQueries";

import { NationRelationshipRow } from "./RelationshipRow";
import { getStanceIconConfig } from "./RelationshipUtils";

import type { NationRelationship } from "../../types/nationRelationshipTypes";
import type { Nation } from "../../types/nationTypes";

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
      className="rounded-md border border-border bg-card p-0 text-card-foreground"
    >
      <div className="px-4 py-4">
        <h2 id="nation-relationships-heading" className="text-base font-medium">
          Relationships
        </h2>
        <p className="text-sm text-muted-foreground">
          Outgoing stances from {nation.name} and proposals awaiting either
          side.
        </p>
      </div>
      <div className="border-t border-border">
        {nationsQuery.isPending ||
        outgoingQuery.isPending ||
        incomingQuery.isPending ? (
          <div className="px-4 pb-4 pt-2">
            <LoadingState label="Loading relationships…" />
          </div>
        ) : nationsQuery.isError ? (
          <div className="px-4 pb-4 pt-2">
            <ErrorState
              title="Relationships could not be loaded"
              description={getErrorDescription(nationsQuery.error)}
            />
          </div>
        ) : outgoingQuery.isError ? (
          <div className="px-4 pb-4 pt-2">
            <ErrorState
              title="Relationships could not be loaded"
              description={getErrorDescription(outgoingQuery.error)}
            />
          </div>
        ) : incomingQuery.isError ? (
          <div className="px-4 pb-4 pt-2">
            <ErrorState
              title="Relationships could not be loaded"
              description={getErrorDescription(incomingQuery.error)}
            />
          </div>
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
      </div>
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
      <div className="px-4 pb-4 pt-2">
        <EmptyState
          title="No other nations"
          description="This world has no other nations to relate to yet."
        />
      </div>
    );
  }

  const outgoingByTo = new Map<string, NationRelationship>(
    outgoing.map((row) => [row.toNationId, row]),
  );
  const incomingByFrom = new Map<string, NationRelationship>(
    incoming.map((row) => [row.fromNationId, row]),
  );

  return (
    <div className="divide-y divide-border">
      {otherNations.map((other) => (
        <NationRelationshipAccordionRow
          key={other.id}
          canControl={canControl}
          incoming={incomingByFrom.get(other.id) ?? null}
          nation={nation}
          other={other}
          outgoing={outgoingByTo.get(other.id) ?? null}
          queryClient={queryClient}
        />
      ))}
    </div>
  );
}

function NationRelationshipAccordionRow({
  canControl,
  incoming,
  nation,
  other,
  outgoing,
  queryClient,
}: {
  readonly canControl: boolean;
  readonly incoming: NationRelationship | null;
  readonly nation: Nation;
  readonly other: Nation;
  readonly outgoing: NationRelationship | null;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const currentStance = outgoing?.currentStance ?? "neutral";
  const { Icon, colorClass, label } = getStanceIconConfig(currentStance);

  return (
    <Collapsible className="group">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors">
        <span className="font-medium">{other.name}</span>
        <div className="flex items-center gap-2 shrink-0">
          <Icon className={`h-4 w-4 ${colorClass}`} aria-label={label} />
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border px-4 pb-4 pt-2">
          <NationRelationshipRow
            canControl={canControl}
            incoming={incoming}
            nation={nation}
            other={other}
            outgoing={outgoing}
            queryClient={queryClient}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
