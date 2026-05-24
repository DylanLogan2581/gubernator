import { createFileRoute } from "@tanstack/react-router";

import { WorldShellPage } from "@/features/worlds";

import type { JSX } from "react";

function WorldShellRoute(): JSX.Element {
  const { worldId } = Route.useParams();

  return <WorldShellPage worldId={worldId} />;
}

export const Route = createFileRoute("/worlds/$worldId/")({
  component: WorldShellRoute,
});
