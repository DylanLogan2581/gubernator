import { createFileRoute } from "@tanstack/react-router";

import { SettlementBuildingsPanel } from "@/features/buildings";
import { useSettlementDetailContext } from "@/features/settlements";

import type { JSX } from "react";

function SettlementBuildingsRoute(): JSX.Element {
  const { effectiveCanAdmin, isArchived, settlement, worldId } =
    useSettlementDetailContext();

  return (
    <SettlementBuildingsPanel
      canAdmin={effectiveCanAdmin}
      isArchived={isArchived}
      settlementId={settlement.id}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/buildings",
)({
  component: SettlementBuildingsRoute,
});
