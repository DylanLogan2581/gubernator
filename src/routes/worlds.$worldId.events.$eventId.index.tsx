import { createFileRoute } from "@tanstack/react-router";

import { EventDetailPage } from "@/features/events";

import type { JSX } from "react";

function EventDetailRoute(): JSX.Element {
  const { worldId, eventId } = Route.useParams();

  return <EventDetailPage worldId={worldId} eventId={eventId} />;
}

export const Route = createFileRoute("/worlds/$worldId/events/$eventId/")({
  component: EventDetailRoute,
});
