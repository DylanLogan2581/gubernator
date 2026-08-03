import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { CultureDetailPage } from "@/features/cultures";

import type { JSX } from "react";

function CultureDetailRoute(): JSX.Element {
  const { cultureId, worldId } = Route.useParams();

  return <CultureDetailPage cultureId={cultureId} worldId={worldId} />;
}

export const Route = createFileRoute(
  "/worlds/$worldId/configuration_/cultures/$cultureId",
)({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: CultureDetailRoute,
  pendingComponent: CultureDetailPendingRoute,
});

function CultureDetailPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
