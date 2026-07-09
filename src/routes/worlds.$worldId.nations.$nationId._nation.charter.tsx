import { createFileRoute } from "@tanstack/react-router";

import { NationCharterPage, useNationDetailContext } from "@/features/nations";

import type { JSX } from "react";

function NationCharterRoute(): JSX.Element {
  const { nation, worldId } = useNationDetailContext();

  return <NationCharterPage nation={nation} worldId={worldId} />;
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/_nation/charter",
)({
  component: NationCharterRoute,
});
