import { createFileRoute } from "@tanstack/react-router";

import { SettlementReportsPanel } from "@/features/reports";
import { useSettlementDetailContext } from "@/features/settlements";

import type { JSX } from "react";

function SettlementReportsRoute(): JSX.Element {
  const { settlement, worldAccess, worldId } = useSettlementDetailContext();

  return (
    <SettlementReportsPanel
      currentTurnNumber={worldAccess.header.currentTurnNumber}
      settlementId={settlement.id}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/reports",
)({
  component: SettlementReportsRoute,
});
