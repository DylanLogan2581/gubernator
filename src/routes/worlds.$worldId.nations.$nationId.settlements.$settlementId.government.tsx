import { createFileRoute } from "@tanstack/react-router";

import { GovernmentBodiesSection } from "@/features/government-bodies";
import { LawDocumentsSection } from "@/features/law-documents";
import {
  SettlementManagerCard,
  SettlementOfficesSection,
  useSettlementDetailContext,
} from "@/features/settlements";

import type { JSX } from "react";

function SettlementGovernmentRoute(): JSX.Element {
  const {
    canManageNation,
    canManageSettlement,
    effectiveCanAdmin,
    isArchived,
    settlement,
    worldAccess,
  } = useSettlementDetailContext();

  // Everyone with world access can view the government tab; write controls
  // are gated internally: appoint/dismiss and body CRUD require
  // canManageSettlement (settlement manager, that settlement's nation
  // manager, or an admin), custom office type management requires
  // canManageNation (nation manager or admin only, matching office_types
  // RLS).
  return (
    <div className="grid gap-4">
      <SettlementManagerCard settlement={settlement} />
      <SettlementOfficesSection
        canManageSettlement={canManageSettlement}
        canManageTypes={canManageNation}
        isArchived={isArchived}
        settlement={settlement}
      />
      <GovernmentBodiesSection
        canManage={canManageSettlement}
        isArchived={isArchived}
        nationId={settlement.nationId}
        scope="settlement"
        settlementId={settlement.id}
        worldId={settlement.nation.worldId}
      />
      <LawDocumentsSection
        canManage={canManageSettlement}
        canRepeal={effectiveCanAdmin}
        currentTurnNumber={worldAccess.header.currentTurnNumber}
        effectiveCanAdmin={effectiveCanAdmin}
        isArchived={isArchived}
        nationId={settlement.nationId}
        scope="settlement"
        settlementId={settlement.id}
        worldId={settlement.nation.worldId}
      />
    </div>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId/government",
)({
  component: SettlementGovernmentRoute,
});
