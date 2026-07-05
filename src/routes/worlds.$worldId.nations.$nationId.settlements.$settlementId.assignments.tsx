import { createFileRoute } from "@tanstack/react-router";

import { SettlementAssignmentBoard } from "@/features/citizens";
import { useSettlementDetailContext } from "@/features/settlements";

import type { JSX } from "react";

function SettlementAssignmentsRoute(): JSX.Element {
  const { canManageSettlement, isArchived, settlement, worldId } =
    useSettlementDetailContext();

  return (
    <SettlementAssignmentBoard
      canManageSettlement={canManageSettlement}
      isArchived={isArchived}
      nationId={settlement.nationId}
      settlementId={settlement.id}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/assignments",
)({
  component: SettlementAssignmentsRoute,
});
