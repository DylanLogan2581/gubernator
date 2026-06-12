import { Outlet, createFileRoute } from "@tanstack/react-router";

import type { JSX } from "react";

function EventsShellRoute(): JSX.Element {
  return <Outlet />;
}

export const Route = createFileRoute("/worlds/$worldId/events")({
  component: EventsShellRoute,
});
