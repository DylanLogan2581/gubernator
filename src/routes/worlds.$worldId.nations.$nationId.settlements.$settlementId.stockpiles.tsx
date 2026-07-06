import { createFileRoute } from "@tanstack/react-router";

import { SettlementStockpilesPanel } from "@/features/resources";
import { useSettlementDetailContext } from "@/features/settlements";

import type { JSX } from "react";

function SettlementStockpilesRoute(): JSX.Element {
  const { effectiveCanAdmin, isArchived, settlement, worldId } =
    useSettlementDetailContext();

  return (
    <SettlementStockpilesPanel
      canAdmin={effectiveCanAdmin}
      isArchived={isArchived}
      nationId={settlement.nationId}
      settlementId={settlement.id}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/stockpiles",
)({
  component: SettlementStockpilesRoute,
});
