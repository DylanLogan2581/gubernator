import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { WorldShellPage } from "@/features/worlds";

import type { JSX } from "react";

function WorldShellRoute(): JSX.Element {
  const { worldSlug } = Route.useParams();

  return <WorldShellPage worldSlug={worldSlug} />;
}

export const Route = createFileRoute("/worlds/$worldSlug")({
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
