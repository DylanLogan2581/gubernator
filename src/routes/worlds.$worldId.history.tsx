import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { TurnLogBrowser } from "@/features/turns";
import { WorldEntryGate } from "@/features/worlds";

import type { JSX } from "react";

function WorldHistoryRoute(): JSX.Element {
  const { worldId } = Route.useParams();

  return (
    <WorldEntryGate worldId={worldId}>
      <div className="container max-w-6xl space-y-6 py-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-normal">
            Turn history
          </h1>
          <p className="text-sm text-muted-foreground">
            Audit log of all simulation events across every turn transition.
          </p>
        </header>

        <TurnLogBrowser worldId={worldId} title="All turn log entries" />
      </div>
    </WorldEntryGate>
  );
}

export const Route = createFileRoute("/worlds/$worldId/history")({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: WorldHistoryRoute,
  pendingComponent: WorldHistoryPendingRoute,
});

function WorldHistoryPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
