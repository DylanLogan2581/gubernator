import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { ActiveEventsCard } from "@/features/events";
import {
  SettlementCoordinatesSection,
  SettlementDetailsSection,
  SettlementReadinessSection,
  useSettlementDetailContext,
} from "@/features/settlements";
import { TurnTransitionOutcomePanel } from "@/features/turns";

import type { JSX } from "react";

function SettlementOverviewRoute(): JSX.Element {
  const queryClient = useQueryClient();
  const {
    accessContext,
    canEditCoordinates,
    canEditDetails,
    effectiveCanAdmin,
    canManageSettlement,
    isArchived,
    settlement,
    worldId,
  } = useSettlementDetailContext();

  return (
    <>
      <TurnTransitionOutcomePanel scope="settlement" id={settlement.id} />

      <SettlementReadinessSection
        accessContext={accessContext}
        canAdmin={effectiveCanAdmin}
        canManage={canManageSettlement}
        isArchived={isArchived}
        settlementId={settlement.id}
        worldId={worldId}
      />

      <ActiveEventsCard
        scope="settlement"
        scopeId={settlement.id}
        worldId={worldId}
      />

      <SettlementDetailsSection
        canEdit={canEditDetails}
        queryClient={queryClient}
        settlement={settlement}
      />

      <SettlementCoordinatesSection
        canEdit={canEditCoordinates}
        queryClient={queryClient}
        settlement={settlement}
      />
    </>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/",
)({
  component: SettlementOverviewRoute,
});
