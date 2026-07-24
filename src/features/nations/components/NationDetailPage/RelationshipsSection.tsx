import { useQuery, type QueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { worldCalendarConfigQueryOptions } from "@/features/calendar";
import {
  useActivePlayerCharacter,
  useNationManageAuthority,
} from "@/features/permissions";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import type { Resource } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { type resolveTurnCalendarDate } from "@/shared/turnCalendarPrimitives";

import { nationDiscoveriesQueryOptions } from "../../queries/nationDiscoveryQueries";
import {
  nationRelationshipsFromNationQueryOptions,
  nationRelationshipsToNationQueryOptions,
} from "../../queries/nationRelationshipQueries";
import { nationsListQueryOptions } from "../../queries/nationsQueries";
import { nationTreatiesQueryOptions } from "../../queries/treatiesQueries";
import {
  buildDiscoveryPairMap,
  discoveryPairKey,
} from "../NationDiscoveryConfigPanel/NationDiscoveryUtils";

import { NationRelationshipRow } from "./RelationshipRow";
import {
  formatRelationshipStance,
  getStanceBadgeClassName,
  getStanceIconConfig,
} from "./RelationshipUtils";
import { NationTreatiesPanel } from "./TreatiesList";

import type { NationRelationship } from "../../types/nationRelationshipTypes";
import type { NationTreaty } from "../../types/nationTreatyTypes";
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
  const { canManageNation } = useNationManageAuthority({
    canAdmin: canAdminWorld,
    nationId: nation.id,
  });
  const canControl = canManageNation && !isArchived;

  const nationsQuery = useQuery(nationsListQueryOptions(nation.worldId));
  const discoveriesQuery = useQuery(
    nationDiscoveriesQueryOptions(nation.worldId),
  );
  const outgoingQuery = useQuery(
    nationRelationshipsFromNationQueryOptions(nation.id),
  );
  const incomingQuery = useQuery(
    nationRelationshipsToNationQueryOptions(nation.id),
  );
  const treatiesQuery = useQuery(nationTreatiesQueryOptions(nation.id));
  const resourcesQuery = useQuery(
    activeResourcesByWorldQueryOptions(nation.worldId),
  );
  const calendarQuery = useQuery(
    worldCalendarConfigQueryOptions(nation.worldId),
  );

  const discoveredPairsByKey = buildDiscoveryPairMap(
    discoveriesQuery.data ?? [],
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
        discoveriesQuery.isPending ||
        outgoingQuery.isPending ||
        incomingQuery.isPending ||
        treatiesQuery.isPending ||
        resourcesQuery.isPending ? (
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
        ) : discoveriesQuery.isError ? (
          <div className="px-4 pb-4 pt-2">
            <ErrorState
              title="Relationships could not be loaded"
              description={getErrorDescription(discoveriesQuery.error)}
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
        ) : treatiesQuery.isError ? (
          <div className="px-4 pb-4 pt-2">
            <ErrorState
              title="Treaties could not be loaded"
              description={getErrorDescription(treatiesQuery.error)}
            />
          </div>
        ) : resourcesQuery.isError ? (
          <div className="px-4 pb-4 pt-2">
            <ErrorState
              title="Resources could not be loaded"
              description={getErrorDescription(resourcesQuery.error)}
            />
          </div>
        ) : (
          <NationRelationshipsList
            activeCharacterId={activeCharacter?.id ?? null}
            calendarConfig={calendarQuery.data ?? null}
            canControl={canControl}
            incoming={incomingQuery.data}
            nation={nation}
            otherNations={nationsQuery.data.filter(
              (candidate) =>
                candidate.id !== nation.id &&
                discoveredPairsByKey.has(
                  discoveryPairKey(nation.id, candidate.id),
                ),
            )}
            outgoing={outgoingQuery.data}
            queryClient={queryClient}
            resources={resourcesQuery.data}
            treaties={treatiesQuery.data}
          />
        )}
      </div>
    </section>
  );
}

function NationRelationshipsList({
  activeCharacterId,
  calendarConfig,
  canControl,
  incoming,
  nation,
  otherNations,
  outgoing,
  queryClient,
  resources,
  treaties,
}: {
  readonly activeCharacterId: string | null;
  readonly calendarConfig: Parameters<typeof resolveTurnCalendarDate>[0] | null;
  readonly canControl: boolean;
  readonly incoming: readonly NationRelationship[];
  readonly nation: Nation;
  readonly otherNations: readonly Nation[];
  readonly outgoing: readonly NationRelationship[];
  readonly queryClient: QueryClient;
  readonly resources: readonly Resource[];
  readonly treaties: readonly NationTreaty[];
}): JSX.Element {
  if (otherNations.length === 0) {
    return (
      <div className="px-4 pb-4 pt-2">
        <EmptyState
          title="No nations discovered"
          description={`${nation.name} has not discovered any other nations yet.`}
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
          activeCharacterId={activeCharacterId}
          calendarConfig={calendarConfig}
          canControl={canControl}
          incoming={incomingByFrom.get(other.id) ?? null}
          nation={nation}
          other={other}
          outgoing={outgoingByTo.get(other.id) ?? null}
          queryClient={queryClient}
          resources={resources}
          treaties={treaties.filter(
            (treaty) =>
              treaty.proposerNationId === other.id ||
              treaty.responderNationId === other.id,
          )}
        />
      ))}
    </div>
  );
}

function NationRelationshipAccordionRow({
  activeCharacterId,
  calendarConfig,
  canControl,
  incoming,
  nation,
  other,
  outgoing,
  queryClient,
  resources,
  treaties,
}: {
  readonly activeCharacterId: string | null;
  readonly calendarConfig: Parameters<typeof resolveTurnCalendarDate>[0] | null;
  readonly canControl: boolean;
  readonly incoming: NationRelationship | null;
  readonly nation: Nation;
  readonly other: Nation;
  readonly outgoing: NationRelationship | null;
  readonly queryClient: QueryClient;
  readonly resources: readonly Resource[];
  readonly treaties: readonly NationTreaty[];
}): JSX.Element {
  const currentStance = outgoing?.currentStance ?? "neutral";
  const { Icon, colorClass } = getStanceIconConfig(currentStance);
  const stanceLabel = formatRelationshipStance(currentStance);
  const badgeClassName = getStanceBadgeClassName(currentStance);
  const pendingTreatyCount = treaties.filter(
    (treaty) => treaty.status === "proposed",
  ).length;
  const pendingCount =
    (outgoing?.pendingStance !== null && outgoing?.pendingStance !== undefined
      ? outgoing.pendingStatus === "proposed"
        ? 1
        : 0
      : 0) +
    (incoming?.pendingStance !== null && incoming?.pendingStance !== undefined
      ? incoming.pendingStatus === "proposed"
        ? 1
        : 0
      : 0) +
    pendingTreatyCount;

  return (
    <Collapsible className="group">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors">
        <span className="font-medium">{other.name}</span>
        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 ? (
            <Badge variant="outline">
              {pendingCount} pending{" "}
              {pendingCount === 1 ? "proposal" : "proposals"}
            </Badge>
          ) : null}
          <Badge className={badgeClassName}>
            <Icon className={`h-3 w-3 ${colorClass}`} aria-hidden="true" />
            {stanceLabel}
          </Badge>
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-3 border-t border-border px-4 pb-4 pt-2">
        <NationRelationshipRow
          canControl={canControl}
          incoming={incoming}
          nation={nation}
          other={other}
          outgoing={outgoing}
          queryClient={queryClient}
        />
        <NationTreatiesPanel
          activeCharacterId={activeCharacterId}
          calendarConfig={calendarConfig}
          canControl={canControl}
          nation={nation}
          other={other}
          queryClient={queryClient}
          resources={resources}
          treaties={treaties}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
