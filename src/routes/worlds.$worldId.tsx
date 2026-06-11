import { Outlet, createFileRoute } from "@tanstack/react-router";

import { ScopedNotFound } from "@/components/app/ScopedNotFound";
import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { WorldEntryGate } from "@/features/worlds";

import type { JSX } from "react";

export const Route = createFileRoute("/worlds/$worldId")({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: WorldLayoutRoute,
  pendingComponent: WorldLayoutPendingRoute,
  notFoundComponent: WorldDetailNotFoundPage,
});

function WorldLayoutRoute(): JSX.Element {
  const { worldId } = Route.useParams();
  return (
    <WorldEntryGate worldId={worldId}>
      <Outlet />
    </WorldEntryGate>
  );
}

function WorldLayoutPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}

function WorldDetailNotFoundPage(): JSX.Element {
  const { worldId } = Route.useParams();
  return (
    <ScopedNotFound
      title="Page not found"
      description="The page you're looking for in this world doesn't exist or may have moved."
      backTo={`/worlds/${worldId}`}
      backToLabel="Back to world"
    />
  );
}
