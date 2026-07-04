import { createFileRoute } from "@tanstack/react-router";

import { SettlementManagedPopulationsPanel } from "@/features/managed-populations";
import { useSettlementDetailContext } from "@/features/settlements";

import type { JSX } from "react";

function SettlementPopulationsRoute(): JSX.Element {
  const {
    effectiveCanAdmin,
    canManageSettlement,
    isArchived,
    settlement,
    worldId,
  } = useSettlementDetailContext();

  return (
    <SettlementManagedPopulationsPanel
      canAdmin={effectiveCanAdmin}
      canManage={canManageSettlement}
      isArchived={isArchived}
      settlementId={settlement.id}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/populations",
)({
  component: SettlementPopulationsRoute,
});
