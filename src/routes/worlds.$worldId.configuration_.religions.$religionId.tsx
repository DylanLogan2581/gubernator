import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { ReligionDetailPage } from "@/features/religions";

import type { JSX } from "react";

function ReligionDetailRoute(): JSX.Element {
  const { religionId, worldId } = Route.useParams();

  return <ReligionDetailPage religionId={religionId} worldId={worldId} />;
}

export const Route = createFileRoute(
  "/worlds/$worldId/configuration_/religions/$religionId",
)({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: ReligionDetailRoute,
  pendingComponent: ReligionDetailPendingRoute,
});

function ReligionDetailPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
