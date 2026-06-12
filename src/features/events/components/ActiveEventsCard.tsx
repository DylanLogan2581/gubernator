import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Switch } from "@/components/ui/switch";
import { getErrorDescription } from "@/lib/errorUtils";

import {
  activeNationEventsQueryOptions,
  activeSettlementEventsQueryOptions,
} from "../queries/eventQueries";

import type { Event } from "../types/eventTypes";
import type { JSX } from "react";

export function ActiveEventsCard({
  scope,
  scopeId,
  worldId,
}: {
  readonly scope: "settlement" | "nation";
  readonly scopeId: string;
  readonly worldId: string;
}): JSX.Element {
  const [showExpired, setShowExpired] = useState(false);

  // Determine query options based on scope
  const queryOpts = useMemo(
    () =>
      scope === "settlement"
        ? activeSettlementEventsQueryOptions(worldId, scopeId)
        : activeNationEventsQueryOptions(worldId, scopeId),
    [scope, scopeId, worldId],
  ) as ReturnType<typeof activeSettlementEventsQueryOptions>;

  const eventsQuery = useQuery(queryOpts);

  if (eventsQuery.isPending) {
    return <LoadingState label="Loading events…" />;
  }

  if (eventsQuery.isError) {
    return (
      <ErrorState
        title="Events could not be loaded"
        description={getErrorDescription(eventsQuery.error)}
      />
    );
  }

  const activeEvents = eventsQuery.data ?? [];
  // TODO: Implement expired events query when status='inactive' is available
  const expiredEvents: Event[] = [];

  const displayEvents =
    showExpired && expiredEvents.length > 0
      ? [...activeEvents, ...expiredEvents]
      : activeEvents;

  return (
    <section aria-labelledby="active-events-heading" className="grid gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 id="active-events-heading" className="text-base font-medium">
          Active Events
        </h2>
        {expiredEvents.length > 0 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="show-expired"
              className="text-sm text-muted-foreground"
            >
              Show expired
            </label>
            <Switch
              id="show-expired"
              checked={showExpired}
              onCheckedChange={setShowExpired}
            />
          </div>
        )}
      </div>

      {displayEvents.length === 0 ? (
        <EmptyState
          title="No active events"
          description="No events currently affecting this location."
        />
      ) : (
        <div className="space-y-2">
          {displayEvents.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}

function EventRow({ event }: { readonly event: Event }): JSX.Element {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="flex cursor-pointer items-center justify-between rounded-md border border-muted bg-muted/30 p-3 hover:bg-muted/50">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate font-medium text-sm">{event.name}</h3>
              {event.event_group_id !== null && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  Group
                </Badge>
              )}
            </div>
            {event.description !== null && (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {event.description}
              </p>
            )}
            {event.remaining_transitions !== null && (
              <p className="text-xs text-muted-foreground">
                {event.remaining_transitions} transition
                {event.remaining_transitions !== 1 ? "s" : ""} remaining
              </p>
            )}
          </div>
          <ChevronDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">{event.name}</h4>
          {event.description !== null && (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          )}
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Effect type:</dt>
              <dd className="font-mono">{event.effect_type}</dd>
            </div>
            {event.remaining_transitions !== null && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Transitions remaining:
                </dt>
                <dd>{event.remaining_transitions}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Scope:</dt>
              <dd className="capitalize">{event.scope_type}</dd>
            </div>
            {event.duration_type.length > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Duration type:</dt>
                <dd className="capitalize">{event.duration_type}</dd>
              </div>
            )}
          </dl>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
