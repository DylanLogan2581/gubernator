import { useQuery } from "@tanstack/react-query";

import type { Citizen } from "@/features/citizens";
import { settlementByIdQueryOptions } from "@/features/settlements";

import type { JSX } from "react";

// Shared by ActiveCharacterSwitcher and the sidebar-native
// CharacterSwitcherCard so the settlement-name lookup for a
// settlement_manager PC's role line lives in one place.
export function CharacterRoleLabel({
  citizen,
}: {
  readonly citizen: Citizen;
}): JSX.Element {
  const settlementId =
    citizen.roleType === "settlement_manager" ? citizen.roleSettlementId : null;
  const settlementQuery = useQuery({
    ...settlementByIdQueryOptions(settlementId ?? ""),
    enabled: settlementId !== null,
  });

  switch (citizen.roleType) {
    case "none":
      return <>None</>;
    case "nation_manager":
      return <>Nation manager</>;
    case "settlement_manager": {
      const settlementName = settlementQuery.data?.name ?? null;
      return (
        <>
          Settlement manager
          {settlementName === null ? "" : ` — ${settlementName}`}
        </>
      );
    }
  }
}
