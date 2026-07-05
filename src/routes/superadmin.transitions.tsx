import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { StuckTransitionPanel } from "@/features/permissions";

import type { JSX } from "react";

function SuperadminTransitionsRoute(): JSX.Element {
  return (
    <>
      <PageHeader
        icon={AlertTriangle}
        title="Stuck Transitions"
        description="Recover turn transitions wedged in running status."
      />
      <StuckTransitionPanel />
    </>
  );
}

export const Route = createFileRoute("/superadmin/transitions")({
  component: SuperadminTransitionsRoute,
});
