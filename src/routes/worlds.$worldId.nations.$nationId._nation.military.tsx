import { createFileRoute } from "@tanstack/react-router";

import { NationMilitarySection } from "@/features/military";
import { useNationDetailContext } from "@/features/nations";

import type { JSX } from "react";

function NationMilitaryRoute(): JSX.Element {
  const { effectiveCanAdmin, isArchived, nation } = useNationDetailContext();

  // Everyone with world access can view the military tab; write controls
  // (create/rename/move/delete army or tree nodes, recruit/discharge) are
  // gated internally by NationMilitarySection based on manage-nation
  // authority, mirroring government/bank.
  return (
    <NationMilitarySection
      canAdminWorld={effectiveCanAdmin}
      isArchived={isArchived}
      nation={nation}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/military",
)({
  component: NationMilitaryRoute,
});
