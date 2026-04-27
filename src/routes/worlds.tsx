import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { WorldListPage } from "@/features/worlds";

import type { JSX } from "react";

function WorldsRoute(): JSX.Element {
  return <WorldListPage />;
}

export const Route = createFileRoute("/worlds")({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: WorldsRoute,
  pendingComponent: WorldsPendingRoute,
});

function WorldsPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
