import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { ActiveEventsCard } from "@/features/events";
import {
  SettlementCoordinatesSection,
  SettlementDetailsSection,
  SettlementOverviewStatTiles,
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
      <SettlementOverviewStatTiles
        settlementId={settlement.id}
        worldId={worldId}
      />

      <TurnTransitionOutcomePanel scope="settlement" id={settlement.id} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
      </div>
    </>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/",
)({
  component: SettlementOverviewRoute,
});
