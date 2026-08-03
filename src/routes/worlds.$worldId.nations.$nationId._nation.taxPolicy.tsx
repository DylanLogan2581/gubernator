import { createFileRoute } from "@tanstack/react-router";

import {
  NationTaxPolicySection,
  useNationDetailContext,
} from "@/features/nations";

import type { JSX } from "react";

function NationTaxPolicyRoute(): JSX.Element {
  const { effectiveCanAdmin, isArchived, nation } = useNationDetailContext();

  // Everyone with world access can view the tax policy tab; editing controls
  // and the demand-tribute action are gated internally by
  // NationTaxPolicySection based on world-admin/nation-manager authority,
  // mirroring the treasury tab.
  return (
    <div className="grid gap-4">
      <NationTaxPolicySection
        canAdminWorld={effectiveCanAdmin}
        isArchived={isArchived}
        nation={nation}
      />
    </div>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/taxPolicy",
)({
  component: NationTaxPolicyRoute,
});
