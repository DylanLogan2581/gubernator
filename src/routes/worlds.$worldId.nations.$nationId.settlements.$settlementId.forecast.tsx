import { createFileRoute } from "@tanstack/react-router";

import {
  ForecastPanel,
  useSettlementDetailContext,
} from "@/features/settlements";

import type { JSX } from "react";

function SettlementForecastRoute(): JSX.Element {
  const { settlement, worldId } = useSettlementDetailContext();

  return <ForecastPanel settlementId={settlement.id} worldId={worldId} />;
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/forecast",
)({
  component: SettlementForecastRoute,
});
