import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { TurnLogPage } from "@/features/turns";

import type { JSX } from "react";

function WorldHistoryRoute(): JSX.Element {
  const { worldId } = Route.useParams();

  return <TurnLogPage worldId={worldId} />;
}

export const Route = createFileRoute("/worlds/$worldId/history")({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: WorldHistoryRoute,
  pendingComponent: WorldHistoryPendingRoute,
});

function WorldHistoryPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
