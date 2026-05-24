import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { SettlementDetailPage } from "@/features/settlements";

import type { JSX } from "react";

function SettlementDetailRoute(): JSX.Element {
  const { nationId, settlementId, worldId } = Route.useParams();

  return (
    <SettlementDetailPage
      nationId={nationId}
      settlementId={settlementId}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
)({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: SettlementDetailRoute,
  pendingComponent: SettlementDetailPendingRoute,
});

function SettlementDetailPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
