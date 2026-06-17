import { createFileRoute } from "@tanstack/react-router";

import { EventCreateNewPage } from "@/features/events";

import type { JSX } from "react";

function EventCreateNewRoute(): JSX.Element {
  const { worldId } = Route.useParams();

  return <EventCreateNewPage worldId={worldId} />;
}

export const Route = createFileRoute("/worlds/$worldId/events/new")({
  component: EventCreateNewRoute,
});
