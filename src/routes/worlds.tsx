import { Outlet, createFileRoute } from "@tanstack/react-router";

import { ScopedNotFound } from "@/components/app/ScopedNotFound";
import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";

import type { JSX } from "react";

function WorldsRoute(): JSX.Element {
  return <Outlet />;
}

export const Route = createFileRoute("/worlds")({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: WorldsRoute,
  pendingComponent: WorldsPendingRoute,
  notFoundComponent: WorldsNotFoundPage,
});

function WorldsPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}

function WorldsNotFoundPage(): JSX.Element {
  return (
    <ScopedNotFound
      title="Worlds not found"
      description="The worlds section you're looking for doesn't exist or may have moved."
      backTo="/"
      backToLabel="Go to home"
    />
  );
}
