import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { ActiveEventsCard } from "@/features/events";
import {
  NationDetailsSection,
  useNationDetailContext,
} from "@/features/nations";

import type { JSX } from "react";

function NationOverviewRoute(): JSX.Element {
  const queryClient = useQueryClient();
  const { canEditDetails, nation, worldId } = useNationDetailContext();

  return (
    <>
      <NationDetailsSection
        canEdit={canEditDetails}
        nation={nation}
        queryClient={queryClient}
      />

      <ActiveEventsCard scope="nation" scopeId={nation.id} worldId={worldId} />
    </>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/",
)({
  component: NationOverviewRoute,
});
