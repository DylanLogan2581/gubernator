import { createFileRoute } from "@tanstack/react-router";

import { GovernmentBodiesSection } from "@/features/government-bodies";
import { LawDocumentsSection } from "@/features/law-documents";
import {
  NationOfficesSection,
  NationRoleAssignmentSection,
  useNationDetailContext,
} from "@/features/nations";
import { useActivePlayerCharacter } from "@/features/permissions";

import type { JSX } from "react";

function NationGovernmentRoute(): JSX.Element {
  const { effectiveCanAdmin, isArchived, nation } = useNationDetailContext();
  const { activeCharacter } = useActivePlayerCharacter();
  const isNationManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === nation.id &&
    activeCharacter.status === "alive";
  const canManageBodies = effectiveCanAdmin || isNationManager;

  // Everyone with world access can view the government tab; write controls
  // (role assignment, office appoint/dismiss, body CRUD) are gated
  // internally by each section based on world-admin/nation-manager authority.
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
      <GovernmentBodiesSection
        canManage={canManageBodies}
        isArchived={isArchived}
        nationId={nation.id}
        scope="nation"
        worldId={nation.worldId}
      />
      <LawDocumentsSection
        canManage={canManageBodies}
        canRepeal={effectiveCanAdmin}
        isArchived={isArchived}
        nationId={nation.id}
        scope="nation"
        worldId={nation.worldId}
      />
    </div>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/government",
)({
  component: NationGovernmentRoute,
});
