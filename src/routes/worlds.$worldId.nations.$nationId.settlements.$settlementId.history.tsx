import { createFileRoute } from "@tanstack/react-router";

import { useSettlementDetailContext } from "@/features/settlements";
import { TurnLogBrowser } from "@/features/turns";

import type { JSX } from "react";

function SettlementHistoryRoute(): JSX.Element {
  const { settlement, worldId } = useSettlementDetailContext();

  return (
    <TurnLogBrowser
      fixedFilter={{ settlementId: settlement.id }}
      title="Settlement turn log"
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/history",
)({
  component: SettlementHistoryRoute,
});
