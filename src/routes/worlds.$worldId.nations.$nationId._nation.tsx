import { Outlet, createFileRoute } from "@tanstack/react-router";

import { NationDetailPage } from "@/features/nations";

import type { JSX } from "react";

// Pathless layout (see docs/ui-redesign.md §4.1): mounts NationDetailPage's
// gating pyramid + header/context for the nation's OWN child routes
// (overview, settlements list, relationships, government, reports,
// settings) without wrapping the sibling settlement-detail route tree
// (`nations.$nationId.settlements.$settlementId.*`), which has always
// nested directly under `nations.$nationId` and must stay untouched by
// nation-level chrome/gating.
function NationSectionsLayout(): JSX.Element {
  const { nationId, worldId } = Route.useParams();

  return (
    <NationDetailPage nationId={nationId} worldId={worldId}>
      <Outlet />
    </NationDetailPage>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation",
)({
  component: NationSectionsLayout,
});
