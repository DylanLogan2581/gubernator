import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { WorldShellPage } from "@/features/worlds";

import type { JSX } from "react";

function WorldShellRoute(): JSX.Element {
  const { worldId } = Route.useParams();

  return <WorldShellPage worldId={worldId} />;
}

export const Route = createFileRoute("/worlds/$worldId")({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: WorldShellRoute,
  pendingComponent: WorldShellPendingRoute,
});

function WorldShellPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
