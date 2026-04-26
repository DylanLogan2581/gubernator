import { createFileRoute } from "@tanstack/react-router";

import { WorldListPage } from "@/features/worlds";

import type { JSX } from "react";

function WorldsRoute(): JSX.Element {
  return <WorldListPage />;
}

export const Route = createFileRoute("/worlds")({
  component: WorldsRoute,
});
