import { createFileRoute } from "@tanstack/react-router";

import {
  NationSettlementsSection,
  useNationDetailContext,
} from "@/features/nations";

import type { JSX } from "react";

function NationSettlementsRoute(): JSX.Element {
  const { effectiveCanAdmin, isArchived, nation, worldId } =
    useNationDetailContext();

  return (
    <NationSettlementsSection
      canAdmin={effectiveCanAdmin}
      isArchived={isArchived}
      nationId={nation.id}
      userId={null}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/settlements",
)({
  component: NationSettlementsRoute,
});
