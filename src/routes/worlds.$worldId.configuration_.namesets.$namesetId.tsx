import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { NamesetEditPage } from "@/features/namesets";

import type { JSX } from "react";

function NamesetEditRoute(): JSX.Element {
  const { namesetId, worldId } = Route.useParams();

  return <NamesetEditPage namesetId={namesetId} worldId={worldId} />;
}

export const Route = createFileRoute(
  "/worlds/$worldId/configuration_/namesets/$namesetId",
)({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: NamesetEditRoute,
  pendingComponent: NamesetEditPendingRoute,
});

function NamesetEditPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
