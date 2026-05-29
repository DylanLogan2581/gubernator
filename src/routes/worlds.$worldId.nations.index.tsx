import { createFileRoute } from "@tanstack/react-router";

import { NationListPage } from "@/features/nations";

import type { JSX } from "react";

function NationListRoute(): JSX.Element {
  const { worldId } = Route.useParams();

  return <NationListPage worldId={worldId} />;
}

export const Route = createFileRoute("/worlds/$worldId/nations/")({
  component: NationListRoute,
});
