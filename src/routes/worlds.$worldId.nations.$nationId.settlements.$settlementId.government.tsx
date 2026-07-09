import { createFileRoute } from "@tanstack/react-router";

import {
  SettlementManagerCard,
  SettlementOfficesSection,
  useSettlementDetailContext,
} from "@/features/settlements";

import type { JSX } from "react";

function SettlementGovernmentRoute(): JSX.Element {
  const { canManageNation, canManageSettlement, isArchived, settlement } =
    useSettlementDetailContext();

  // Everyone with world access can view the government tab; write controls
  // are gated internally: appoint/dismiss requires canManageSettlement
  // (settlement manager, that settlement's nation manager, or an admin),
  // custom office type management requires canManageNation (nation manager
  // or admin only, matching office_types RLS).
  return (
    <div className="grid gap-4">
      <SettlementManagerCard settlement={settlement} />
      <SettlementOfficesSection
        canManageSettlement={canManageSettlement}
        canManageTypes={canManageNation}
        isArchived={isArchived}
        settlement={settlement}
      />
    </div>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/government",
)({
  component: SettlementGovernmentRoute,
});
