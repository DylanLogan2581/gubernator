import { createFileRoute } from "@tanstack/react-router";

import { NationBankSection, useNationDetailContext } from "@/features/nations";

import type { JSX } from "react";

function NationBankRoute(): JSX.Element {
  const { effectiveCanAdmin, isArchived, nation } = useNationDetailContext();

  // Everyone with visibility into this nation (including other nations'
  // members, per nation_visible_to_current_user's met-nation path) can view
  // the bank tab read-only; mint/burn/deposit/redeem controls and the
  // establish-currency CTA are gated internally by NationBankSection based
  // on world-admin/nation-manager/bank_governor authority.
  return (
    <div className="grid gap-4">
      <NationBankSection
        canAdminWorld={effectiveCanAdmin}
        isArchived={isArchived}
        nation={nation}
      />
    </div>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/bank",
)({
  component: NationBankRoute,
});
