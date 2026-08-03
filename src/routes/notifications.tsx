import { createFileRoute } from "@tanstack/react-router";
import { type JSX } from "react";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { NotificationsPage } from "@/features/notifications";

export const Route = createFileRoute("/notifications")({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: NotificationsComponent,
  pendingComponent: NotificationsPendingRoute,
});

function NotificationsComponent(): JSX.Element {
  return <NotificationsPage />;
}

function NotificationsPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
