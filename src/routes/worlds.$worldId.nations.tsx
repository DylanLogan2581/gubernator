import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { NationListPage } from "@/features/nations";

import type { JSX } from "react";

function NationListRoute(): JSX.Element {
  const { worldId } = Route.useParams();

  return <NationListPage worldId={worldId} />;
}

export const Route = createFileRoute("/worlds/$worldId/nations")({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: NationListRoute,
  pendingComponent: NationListPendingRoute,
});

function NationListPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
