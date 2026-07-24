import { type JSX } from "react";

import { OfficesSection } from "@/features/nations";

import type { SettlementWithNation } from "../../types/settlementTypes";

export function SettlementOfficesSection({
  canManageSettlement,
  canManageTypes,
  isArchived,
  settlement,
}: {
  readonly canManageSettlement: boolean;
  readonly canManageTypes: boolean;
  readonly isArchived: boolean;
  readonly settlement: SettlementWithNation;
}): JSX.Element {
  return (
    <OfficesSection
      canManageSettlement={canManageSettlement}
      canManageTypes={canManageTypes}
      isArchived={isArchived}
      nationId={settlement.nationId}
      scope="settlement"
      settlementId={settlement.id}
      settlementName={settlement.name}
      worldId={settlement.nation.worldId}
    />
  );
}
