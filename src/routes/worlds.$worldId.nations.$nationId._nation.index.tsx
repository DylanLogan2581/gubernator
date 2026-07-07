import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { ActiveEventsCard } from "@/features/events";
import {
  NationDetailsSection,
  NationIdentitySection,
  NationOverviewCharts,
  NationOverviewStatTiles,
  useNationDetailContext,
} from "@/features/nations";

import type { JSX } from "react";

function NationOverviewRoute(): JSX.Element {
  const queryClient = useQueryClient();
  const {
    canEditDetails,
    effectiveCanAdmin,
    isArchived,
    nation,
    worldAccess,
    worldId,
  } = useNationDetailContext();

  return (
    <>
      <NationOverviewStatTiles nationId={nation.id} worldId={worldId} />

      <NationIdentitySection
        canAdminWorld={effectiveCanAdmin}
        isArchived={isArchived}
        nation={nation}
        queryClient={queryClient}
      />

      <NationOverviewCharts
        currentTurnNumber={worldAccess.header.currentTurnNumber}
        nationId={nation.id}
        worldId={worldId}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <NationDetailsSection
          canEdit={canEditDetails}
          nation={nation}
          queryClient={queryClient}
        />

        <ActiveEventsCard
          scope="nation"
          scopeId={nation.id}
          worldId={worldId}
        />
      </div>
    </>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/",
)({
  component: NationOverviewRoute,
});
