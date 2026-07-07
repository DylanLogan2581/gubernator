import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  eventsListQueryOptions,
  type EventListFilters,
} from "@/features/events";
import { getErrorDescription } from "@/lib/errorUtils";

import type { JSX } from "react";

const ACTIVE_EVENTS_FILTER: EventListFilters = { statusFilter: ["active"] };
const FEED_LIMIT = 5;

type WorldActiveEventsFeedProps = {
  readonly worldId: string;
};

/** Compact feed of the world's currently active events, world/nation/settlement scoped alike. */
export function WorldActiveEventsFeed({
  worldId,
}: WorldActiveEventsFeedProps): JSX.Element {
  const eventsQuery = useQuery(
    eventsListQueryOptions(worldId, ACTIVE_EVENTS_FILTER),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Active events</CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-auto text-xs">
          <Link to="/worlds/$worldId/events" params={{ worldId }}>
            View all
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {eventsQuery.isPending ? (
          <LoadingState label="Loading active events…" />
        ) : eventsQuery.isError ? (
          <ErrorState
            title="Active events could not be loaded"
            description={getErrorDescription(eventsQuery.error)}
          />
        ) : eventsQuery.data.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No active events"
            description="Nothing is currently affecting this world."
          />
        ) : (
          <ul className="space-y-2">
            {eventsQuery.data.slice(0, FEED_LIMIT).map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{event.name}</p>
                  {event.duration_type === "sustained" ? (
                    <p className="text-xs text-muted-foreground">
                      {event.remaining_transitions ?? 0} turn(s) remaining
                    </p>
                  ) : null}
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">
                  {event.scope_type}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
