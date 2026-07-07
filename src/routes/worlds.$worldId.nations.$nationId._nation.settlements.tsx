import { createFileRoute } from "@tanstack/react-router";

import {
  NationSettlementsSection,
  useNationDetailContext,
} from "@/features/nations";

import type { JSX } from "react";

function NationSettlementsRoute(): JSX.Element {
  const { accessContext, effectiveCanAdmin, isArchived, nation, worldId } =
    useNationDetailContext();

  return (
    <NationSettlementsSection
      accessContext={accessContext}
      canAdmin={effectiveCanAdmin}
      isArchived={isArchived}
      nationId={nation.id}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/settlements",
)({
  component: NationSettlementsRoute,
});
