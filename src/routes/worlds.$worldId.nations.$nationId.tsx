import { Outlet, createFileRoute } from "@tanstack/react-router";

import { ScopedNotFound } from "@/components/app/ScopedNotFound";
import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";

import type { JSX } from "react";

export const Route = createFileRoute("/worlds/$worldId/nations/$nationId")({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: Outlet,
  pendingComponent: NationLayoutPendingRoute,
  notFoundComponent: NationDetailNotFoundPage,
});

function NationLayoutPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}

function NationDetailNotFoundPage(): JSX.Element {
  const { worldId, nationId } = Route.useParams();
  return (
    <ScopedNotFound
      title="Page not found"
      description="The page you're looking for in this nation doesn't exist or may have moved."
      backTo={`/worlds/${worldId}/nations/${nationId}`}
      backToLabel="Back to nation"
    />
  );
}
