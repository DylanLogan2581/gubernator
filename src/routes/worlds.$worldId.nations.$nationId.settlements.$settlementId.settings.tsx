import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { SettlementNamesetCard } from "@/features/namesets";
import { AdminSuppressedNotice } from "@/features/permissions";
import {
  SettlementDeleteSection,
  useSettlementDetailContext,
} from "@/features/settlements";

import type { JSX } from "react";

function SettlementSettingsRoute(): JSX.Element | null {
  const queryClient = useQueryClient();
  const {
    canDelete,
    effectiveCanAdmin,
    isArchived,
    settlement,
    worldAccess,
    worldId,
  } = useSettlementDetailContext();

  // Only ever shown to accounts that could have admin authority here — the
  // sidebar Settings item is gated the same way (never shown-but-empty for
  // viewers who lack it outright).
  if (!worldAccess.canAdmin) {
    return null;
  }

  if (!effectiveCanAdmin) {
    return <AdminSuppressedNotice />;
  }

  return (
    <>
      <SettlementNamesetCard
        canAdmin={effectiveCanAdmin}
        currentNamesetId={settlement.namesetId}
        isArchived={isArchived}
        settlementId={settlement.id}
        worldId={worldId}
      />

      {canDelete ? (
        <SettlementDeleteSection
          queryClient={queryClient}
          settlement={settlement}
          worldId={worldId}
        />
      ) : null}
    </>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/settings",
)({
  component: SettlementSettingsRoute,
});
