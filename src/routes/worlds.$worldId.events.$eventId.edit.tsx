import { createFileRoute } from "@tanstack/react-router";

import { EventEditPage } from "@/features/events";

import type { JSX } from "react";

function EventEditRoute(): JSX.Element {
  const { worldId, eventId } = Route.useParams();

  return <EventEditPage worldId={worldId} eventId={eventId} />;
}

export const Route = createFileRoute("/worlds/$worldId/events/$eventId/edit")({
  component: EventEditRoute,
});
