import { Outlet, createFileRoute } from "@tanstack/react-router";

import { ScopedNotFound } from "@/components/app/ScopedNotFound";
import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";

import type { JSX } from "react";

export const Route = createFileRoute("/worlds/$worldId/nations")({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: Outlet,
  pendingComponent: NationsLayoutPendingRoute,
  notFoundComponent: NationsNotFoundPage,
});

function NationsLayoutPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}

function NationsNotFoundPage(): JSX.Element {
  const { worldId } = Route.useParams();
  return (
    <ScopedNotFound
      title="Page not found"
      description="The page you're looking for in this world's nations doesn't exist or may have moved."
      backTo={`/worlds/${worldId}`}
      backToLabel="Back to world"
    />
  );
}
