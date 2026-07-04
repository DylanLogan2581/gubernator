import { createFileRoute } from "@tanstack/react-router";

import {
  NationRoleAssignmentSection,
  NationSectionRedirect,
  useNationDetailContext,
} from "@/features/nations";
import { useActivePlayerCharacter } from "@/features/permissions";

import type { JSX } from "react";

function NationGovernmentRoute(): JSX.Element {
  const { effectiveCanAdmin, isArchived, nation, worldId } =
    useNationDetailContext();
  const { activeCharacter } = useActivePlayerCharacter();
  const isNationManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === nation.id &&
    activeCharacter.status === "alive";

  // Mirrors the visibility check inside NationRoleAssignmentSection itself —
  // a viewer who is neither world admin nor this nation's alive
  // nation_manager would see nothing here, so send them back to the
  // overview instead of an empty page.
  if (!effectiveCanAdmin && !isNationManager) {
    return <NationSectionRedirect nationId={nation.id} worldId={worldId} />;
  }

  return (
    <NationRoleAssignmentSection
      canAdminWorld={effectiveCanAdmin}
      isArchived={isArchived}
      nation={nation}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/government",
)({
  component: NationGovernmentRoute,
});
