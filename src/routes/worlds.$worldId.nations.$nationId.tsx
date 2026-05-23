import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { NationDetailPage } from "@/features/nations";

import type { JSX } from "react";

function NationDetailRoute(): JSX.Element {
  const { nationId, worldId } = Route.useParams();

  return <NationDetailPage nationId={nationId} worldId={worldId} />;
}

export const Route = createFileRoute("/worlds/$worldId/nations/$nationId")({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: NationDetailRoute,
  pendingComponent: NationDetailPendingRoute,
});

function NationDetailPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
