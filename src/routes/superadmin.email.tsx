import { createFileRoute } from "@tanstack/react-router";

import { SuperadminEmailPanel } from "@/features/permissions";

import type { JSX } from "react";

function SuperadminEmailRoute(): JSX.Element {
  return <SuperadminEmailPanel />;
}

export const Route = createFileRoute("/superadmin/email")({
  component: SuperadminEmailRoute,
});
