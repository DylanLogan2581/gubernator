import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";

import type { JSX } from "react";

function WorldShellRoute(): JSX.Element {
  const { worldSlug } = Route.useParams();

  return (
    <div className="mx-auto max-w-5xl py-6">
      <EmptyState
        title="World shell"
        description={`World workspace for ${worldSlug} will render here.`}
      />
    </div>
  );
}

export const Route = createFileRoute("/worlds/$worldSlug")({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: WorldShellRoute,
  pendingComponent: WorldShellPendingRoute,
});

function WorldShellPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
