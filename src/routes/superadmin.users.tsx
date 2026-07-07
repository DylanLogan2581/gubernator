import { createFileRoute } from "@tanstack/react-router";

import { SuperadminUsersPanel } from "@/features/permissions";

import type { JSX } from "react";

function SuperadminUsersRoute(): JSX.Element {
  return <SuperadminUsersPanel />;
}

export const Route = createFileRoute("/superadmin/users")({
  component: SuperadminUsersRoute,
});
