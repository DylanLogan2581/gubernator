import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
  NationRelationshipsSection,
  useNationDetailContext,
} from "@/features/nations";

import type { JSX } from "react";

function NationRelationshipsRoute(): JSX.Element {
  const queryClient = useQueryClient();
  const { effectiveCanAdmin, isArchived, nation } = useNationDetailContext();

  return (
    <NationRelationshipsSection
      canAdminWorld={effectiveCanAdmin && !isArchived}
      isArchived={isArchived}
      nation={nation}
      queryClient={queryClient}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/relationships",
)({
  component: NationRelationshipsRoute,
});
