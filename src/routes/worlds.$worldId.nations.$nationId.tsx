import { Outlet, createFileRoute } from "@tanstack/react-router";

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
});

function NationLayoutPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
