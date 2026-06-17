import { createFileRoute } from "@tanstack/react-router";

import { EventsPage } from "@/features/events";

import type { JSX } from "react";

function EventsListRoute(): JSX.Element {
  const { worldId } = Route.useParams();

  return <EventsPage worldId={worldId} />;
}

export const Route = createFileRoute("/worlds/$worldId/events/")({
  component: EventsListRoute,
});
