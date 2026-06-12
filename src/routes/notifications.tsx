import { createFileRoute } from "@tanstack/react-router";
import { type JSX } from "react";

import { NotificationsPage } from "@/features/notifications";

export const Route = createFileRoute("/notifications")({
  component: NotificationsComponent,
});

function NotificationsComponent(): JSX.Element {
  return <NotificationsPage />;
}
