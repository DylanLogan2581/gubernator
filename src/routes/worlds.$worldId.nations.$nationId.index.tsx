import { createFileRoute } from "@tanstack/react-router";

import { NationDetailPage } from "@/features/nations";

import type { JSX } from "react";

function NationDetailIndexRoute(): JSX.Element {
  const { nationId, worldId } = Route.useParams();

  return <NationDetailPage nationId={nationId} worldId={worldId} />;
}

export const Route = createFileRoute("/worlds/$worldId/nations/$nationId/")({
  component: NationDetailIndexRoute,
});
