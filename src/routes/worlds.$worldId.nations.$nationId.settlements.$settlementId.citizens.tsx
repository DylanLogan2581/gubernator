import { createFileRoute } from "@tanstack/react-router";

import { CitizensPanel } from "@/features/citizens";
import { useSettlementDetailContext } from "@/features/settlements";

import type { JSX } from "react";

function SettlementCitizensRoute(): JSX.Element {
  const { effectiveCanAdmin, isArchived, settlement, worldAccess, worldId } =
    useSettlementDetailContext();

  return (
    <CitizensPanel
      canAdmin={effectiveCanAdmin}
      incestPreventionDepth={worldAccess.world.incestPreventionDepth}
      isArchived={isArchived}
      nationId={settlement.nationId}
      settlementId={settlement.id}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/citizens",
)({
  component: SettlementCitizensRoute,
});
