import { createFileRoute } from "@tanstack/react-router";

import { SuperadminWorldsPanel } from "@/features/permissions";

import type { JSX } from "react";

function SuperadminWorldsRoute(): JSX.Element {
  return <SuperadminWorldsPanel />;
}

export const Route = createFileRoute("/superadmin/worlds")({
  component: SuperadminWorldsRoute,
});
