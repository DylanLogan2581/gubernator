import { createFileRoute } from "@tanstack/react-router";

import {
  NationTreasurySection,
  useNationDetailContext,
} from "@/features/nations";

import type { JSX } from "react";

function NationTreasuryRoute(): JSX.Element {
  const { effectiveCanAdmin, isArchived, nation } = useNationDetailContext();

  // Everyone with world access can view the treasury tab; grant/subsidize
  // controls and the tax rate slider are gated internally by
  // NationTreasurySection based on world-admin/nation-manager authority,
  // mirroring the government tab.
  return (
    <div className="grid gap-4">
      <NationTreasurySection
        canAdminWorld={effectiveCanAdmin}
        isArchived={isArchived}
        nation={nation}
      />
    </div>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/treasury",
)({
  component: NationTreasuryRoute,
});
