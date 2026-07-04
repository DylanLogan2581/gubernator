import { createFileRoute } from "@tanstack/react-router";

import { SettlementDepositsPanel } from "@/features/deposits";
import { useSettlementDetailContext } from "@/features/settlements";

import type { JSX } from "react";

function SettlementDepositsRoute(): JSX.Element {
  const {
    effectiveCanAdmin,
    canManageSettlement,
    isArchived,
    settlement,
    worldId,
  } = useSettlementDetailContext();

  return (
    <SettlementDepositsPanel
      canAdmin={effectiveCanAdmin}
      canManage={canManageSettlement}
      isArchived={isArchived}
      settlementId={settlement.id}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/deposits",
)({
  component: SettlementDepositsRoute,
});
