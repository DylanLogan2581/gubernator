import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { NationNamesetCard } from "@/features/namesets";
import {
  NationDeleteSection,
  NationSectionRedirect,
  useNationDetailContext,
} from "@/features/nations";
import { AdminSuppressedNotice } from "@/features/permissions";

import type { JSX } from "react";

function NationSettingsRoute(): JSX.Element {
  const queryClient = useQueryClient();
  const { canDelete, effectiveCanAdmin, nation, worldAccess, worldId } =
    useNationDetailContext();

  // A true non-admin has no authority here at all — send them back to the
  // overview rather than an empty/error page.
  if (!worldAccess.canAdmin) {
    return <NationSectionRedirect nationId={nation.id} worldId={worldId} />;
  }

  // An admin with an active player character has authority in principle but
  // it's suppressed while playing — same treatment as the settlement
  // settings route.
  if (!effectiveCanAdmin) {
    return <AdminSuppressedNotice />;
  }

  return (
    <>
      <NationNamesetCard
        canAdmin={effectiveCanAdmin}
        currentNamesetId={nation.namesetId}
        isArchived={worldAccess.header.isArchived}
        nationId={nation.id}
        worldId={worldId}
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
