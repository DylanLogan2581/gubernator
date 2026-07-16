import { createFileRoute, Link } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DecreesSection } from "@/features/decrees";
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
  const { effectiveCanAdmin, isArchived, nation, worldAccess } =
    useNationDetailContext();
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
      <div className="flex justify-end">
        <Button asChild size="sm" variant="outline">
          <Link
            to="/worlds/$worldId/nations/$nationId/charter"
            params={{ nationId: nation.id, worldId: nation.worldId }}
          >
            <ScrollText aria-hidden="true" />
            View charter
          </Link>
        </Button>
      </div>
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
        currentTurnNumber={worldAccess.header.currentTurnNumber}
        effectiveCanAdmin={effectiveCanAdmin}
        isArchived={isArchived}
        nationId={nation.id}
        scope="nation"
        worldId={nation.worldId}
      />
      <DecreesSection
        canManage={canManageBodies}
        effectiveCanAdmin={effectiveCanAdmin}
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
