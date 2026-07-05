import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { EventsPage } from "@/features/events";
import type { EventsSearchParams } from "@/features/events";

import type { JSX } from "react";

const EVENT_STATUS_VALUES = [
  "pending",
  "active",
  "expired",
  "cancelled",
] as const;

const EVENT_SCOPE_VALUES = ["world", "nation", "settlement"] as const;

const EVENT_SORT_VALUES = ["status", "created_at"] as const;

const eventsSearchSchema = z.object({
  status: z.array(z.enum(EVENT_STATUS_VALUES)).optional(),
  scope: z.enum(EVENT_SCOPE_VALUES).optional(),
  q: z.string().optional(),
  sort: z.enum(EVENT_SORT_VALUES).optional(),
});

type EventsRouteSearch = z.infer<typeof eventsSearchSchema>;

// All fields stay optional here so links into the events list from elsewhere
// (sidebar, event create/cancel flows) don't have to specify search params.
function parseEventsSearch(search: unknown): EventsRouteSearch {
  const result = eventsSearchSchema.safeParse(search);
  return result.success ? result.data : {};
}

function EventsListRoute(): JSX.Element {
  const { worldId } = Route.useParams();
  const routeSearch = Route.useSearch();
  const search: EventsSearchParams = {
    status: routeSearch.status ?? [],
    scope: routeSearch.scope,
    q: routeSearch.q ?? "",
    sort: routeSearch.sort ?? "created_at",
  };

  return <EventsPage worldId={worldId} search={search} />;
}

export const Route = createFileRoute("/worlds/$worldId/events/")({
  component: EventsListRoute,
  validateSearch: parseEventsSearch,
});
