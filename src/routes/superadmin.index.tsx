import { createFileRoute } from "@tanstack/react-router";

import { SuperadminSettingsPage } from "@/features/permissions";

import type { JSX } from "react";

function SuperadminIndexRoute(): JSX.Element {
  return <SuperadminSettingsPage />;
}

export const Route = createFileRoute("/superadmin/")({
  component: SuperadminIndexRoute,
});
