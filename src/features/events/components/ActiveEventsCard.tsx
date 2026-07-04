import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Switch } from "@/components/ui/switch";
import { getErrorDescription } from "@/lib/errorUtils";

import {
  activeNationEventsQueryOptions,
  activeSettlementEventsQueryOptions,
  expiredNationEventsQueryOptions,
  expiredSettlementEventsQueryOptions,
} from "../queries/eventQueries";

import type { EventWithGroup } from "../types/eventTypes";
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

  const expiredQueryOpts = useMemo(
    () =>
      scope === "settlement"
        ? expiredSettlementEventsQueryOptions(worldId, scopeId)
        : expiredNationEventsQueryOptions(worldId, scopeId),
    [scope, scopeId, worldId],
  ) as ReturnType<typeof expiredSettlementEventsQueryOptions>;

  const eventsQuery = useQuery(queryOpts);
  const expiredEventsQuery = useQuery({
    ...expiredQueryOpts,
    enabled: showExpired,
  });

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
  const expiredEvents = showExpired ? (expiredEventsQuery.data ?? []) : [];

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
      </div>

      {showExpired && expiredEventsQuery.isPending && (
        <p className="text-sm text-muted-foreground">Loading expired events…</p>
      )}

      {showExpired && expiredEventsQuery.isError && (
        <ErrorState
          title="Expired events could not be loaded"
          description={getErrorDescription(expiredEventsQuery.error)}
        />
      )}

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

function EventRow({ event }: { readonly event: EventWithGroup }): JSX.Element {
  return (
    <div className="rounded-md border border-muted bg-muted/30 p-3">
      <h3 className="truncate font-medium text-sm">
        {event.group?.name ?? event.name}
      </h3>
    </div>
  );
}
