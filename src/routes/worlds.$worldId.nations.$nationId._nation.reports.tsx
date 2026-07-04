import { createFileRoute } from "@tanstack/react-router";

import {
  NationReportsSection,
  useNationDetailContext,
} from "@/features/nations";
import { TurnLogBrowser } from "@/features/turns";

import type { JSX } from "react";

function NationReportsRoute(): JSX.Element {
  const { nation, worldAccess, worldId } = useNationDetailContext();

  return (
    <>
      <NationReportsSection
        currentTurnNumber={worldAccess.header.currentTurnNumber}
        nationId={nation.id}
        worldId={worldId}
      />

      <TurnLogBrowser
        fixedFilter={{ nationId: nation.id }}
        title="Nation turn log"
        worldId={worldId}
      />
    </>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/reports",
)({
  component: NationReportsRoute,
});
