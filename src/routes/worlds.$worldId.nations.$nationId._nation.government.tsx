import { createFileRoute } from "@tanstack/react-router";

import {
  NationOfficesSection,
  NationRoleAssignmentSection,
  useNationDetailContext,
} from "@/features/nations";

import type { JSX } from "react";

function NationGovernmentRoute(): JSX.Element {
  const { effectiveCanAdmin, isArchived, nation } = useNationDetailContext();

  // Everyone with world access can view the government tab; write controls
  // (role assignment, office appoint/dismiss) are gated internally by each
  // section based on world-admin/nation-manager authority.
  return (
    <div className="grid gap-4">
      <NationOfficesSection
        canAdminWorld={effectiveCanAdmin}
        isArchived={isArchived}
        nation={nation}
      />
      <NationRoleAssignmentSection
        canAdminWorld={effectiveCanAdmin}
        isArchived={isArchived}
        nation={nation}
      />
    </div>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/government",
)({
  component: NationGovernmentRoute,
});
