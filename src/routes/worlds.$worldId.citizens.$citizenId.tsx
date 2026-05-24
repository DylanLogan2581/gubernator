import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { CitizenDetailPage } from "@/features/citizens";

import type { JSX } from "react";

function CitizenDetailRoute(): JSX.Element {
  const { citizenId, worldId } = Route.useParams();

  return <CitizenDetailPage citizenId={citizenId} worldId={worldId} />;
}

export const Route = createFileRoute("/worlds/$worldId/citizens/$citizenId")({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: CitizenDetailRoute,
  pendingComponent: CitizenDetailPendingRoute,
});

function CitizenDetailPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
