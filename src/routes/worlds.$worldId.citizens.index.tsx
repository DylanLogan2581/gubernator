import { createFileRoute } from "@tanstack/react-router";

import { CitizensDirectoryPage } from "@/features/citizens";

import type { JSX } from "react";

function CitizensDirectoryRoute(): JSX.Element {
  const { worldId } = Route.useParams();

  return <CitizensDirectoryPage worldId={worldId} />;
}

export const Route = createFileRoute("/worlds/$worldId/citizens/")({
  component: CitizensDirectoryRoute,
});
