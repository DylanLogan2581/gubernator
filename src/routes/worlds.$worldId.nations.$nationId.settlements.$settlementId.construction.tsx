import { createFileRoute } from "@tanstack/react-router";

import { SettlementConstructionPanel } from "@/features/construction";
import { useSettlementDetailContext } from "@/features/settlements";

import type { JSX } from "react";

function SettlementConstructionRoute(): JSX.Element {
  const { canManageSettlement, isArchived, settlement, worldId } =
    useSettlementDetailContext();

  return (
    <SettlementConstructionPanel
      canManageSettlement={canManageSettlement}
      isArchived={isArchived}
      settlementId={settlement.id}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/construction",
)({
  component: SettlementConstructionRoute,
});
