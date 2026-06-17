import { Outlet, createFileRoute } from "@tanstack/react-router";

import type { JSX } from "react";

function EventDetailShellRoute(): JSX.Element {
  return <Outlet />;
}

export const Route = createFileRoute("/worlds/$worldId/events/$eventId")({
  component: EventDetailShellRoute,
});
