import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { SettlementEducationSummaryCard } from "@/features/education";
import { ActiveEventsCard } from "@/features/events";
import {
  GarrisonCard,
  SettlementCoordinatesSection,
  SettlementDemographicsCard,
  SettlementDetailsSection,
  SettlementForecastWarningsCard,
  SettlementImagerySection,
  SettlementOverviewStatTiles,
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
  const canEditImagery = canManageSettlement && !isArchived;

  return (
    <>
      <SettlementOverviewStatTiles
        accessContext={accessContext}
        canManageReadiness={canManageSettlement}
        canSetAutoReady={effectiveCanAdmin}
        isArchived={isArchived}
        settlementId={settlement.id}
        worldId={worldId}
      />

      <SettlementImagerySection
        canEdit={canEditImagery}
        settlement={settlement}
      />

      <TurnTransitionOutcomePanel scope="settlement" id={settlement.id} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SettlementForecastWarningsCard
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

        <SettlementDemographicsCard
          settlementId={settlement.id}
          worldId={worldId}
        />

        <GarrisonCard
          nationId={settlement.nationId}
          settlementId={settlement.id}
          worldId={worldId}
        />

        <SettlementEducationSummaryCard
          nationId={settlement.nationId}
          settlementId={settlement.id}
          worldId={worldId}
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
