import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { NationNamesetCard } from "@/features/namesets";
import {
  NationDeleteSection,
  NationSectionRedirect,
  NationTradePolicySection,
  useNationDetailContext,
} from "@/features/nations";
import {
  AdminSuppressedNotice,
  useActivePlayerCharacter,
} from "@/features/permissions";

import type { JSX } from "react";

function NationSettingsRoute(): JSX.Element {
  const queryClient = useQueryClient();
  const { canDelete, effectiveCanAdmin, nation, worldAccess, worldId } =
    useNationDetailContext();
  const { activeCharacter } = useActivePlayerCharacter();
  const isNationManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === nation.id &&
    activeCharacter.status === "alive";

  // Trade policy is manage-nation gated, so this nation's manager needs
  // access to the tab too — not just world admins as before. A user with
  // neither authority still has nothing to do here.
  if (!worldAccess.canAdmin && !isNationManager) {
    return <NationSectionRedirect nationId={nation.id} worldId={worldId} />;
  }

  // A world admin with an active player character has authority in
  // principle but it's suppressed while playing — same treatment as the
  // settlement settings route. Doesn't apply to a nation-manager-only
  // visitor, who isn't a suppressed admin.
  if (worldAccess.canAdmin && !effectiveCanAdmin) {
    return <AdminSuppressedNotice />;
  }

  return (
    <>
      <NationTradePolicySection
        canAdminWorld={effectiveCanAdmin}
        isArchived={worldAccess.header.isArchived}
        nation={nation}
      />

      <NationNamesetCard
        canAdmin={effectiveCanAdmin}
        currentNamesetId={nation.namesetId}
        isArchived={worldAccess.header.isArchived}
        nationId={nation.id}
        worldId={nation.worldId}
      />

      {canDelete ? (
        <NationDeleteSection nation={nation} queryClient={queryClient} />
      ) : null}
    </>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/settings",
)({
  component: NationSettingsRoute,
});
