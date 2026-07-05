import { createFileRoute } from "@tanstack/react-router";

import {
  NationReportsSection,
  useNationDetailContext,
} from "@/features/nations";

import type { JSX } from "react";

function NationReportsRoute(): JSX.Element {
  const { nation, worldAccess, worldId } = useNationDetailContext();

  return (
    <NationReportsSection
      currentTurnNumber={worldAccess.header.currentTurnNumber}
      nationId={nation.id}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/reports",
)({
  component: NationReportsRoute,
});
