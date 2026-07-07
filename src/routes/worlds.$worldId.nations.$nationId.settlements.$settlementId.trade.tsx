import { createFileRoute } from "@tanstack/react-router";

import { useSettlementDetailContext } from "@/features/settlements";
import { SettlementTradeRoutesPanel } from "@/features/trade";

import type { JSX } from "react";

function SettlementTradeRoute(): JSX.Element {
  const {
    canManageNation,
    canManageSettlement,
    isArchived,
    settlement,
    worldId,
  } = useSettlementDetailContext();

  return (
    <SettlementTradeRoutesPanel
      canManage={canManageSettlement}
      canManageNation={canManageNation}
      isArchived={isArchived}
      settlementId={settlement.id}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/trade",
)({
  component: SettlementTradeRoute,
});
