import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { NamesetCreatePage } from "@/features/namesets";

import type { JSX } from "react";

function NamesetCreateRoute(): JSX.Element {
  const { worldId } = Route.useParams();

  return <NamesetCreatePage worldId={worldId} />;
}

export const Route = createFileRoute(
  "/worlds/$worldId/configuration_/namesets/new",
)({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: NamesetCreateRoute,
  pendingComponent: NamesetCreatePendingRoute,
});

function NamesetCreatePendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
