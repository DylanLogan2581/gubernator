import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";

import { WorldListPage } from "@/features/worlds";

import type { JSX } from "react";

const worldsIndexSearchSchema = z.object({
  action: z.enum(["create", "import"]).optional(),
});

function WorldsIndexRoute(): JSX.Element {
  const { action } = Route.useSearch();
  const navigate = useNavigate();

  const clearAction = useCallback(() => {
    void navigate({ to: "/worlds", search: {}, replace: true });
  }, [navigate]);

  return <WorldListPage action={action} onClearAction={clearAction} />;
}

export const Route = createFileRoute("/worlds/")({
  component: WorldsIndexRoute,
  validateSearch: worldsIndexSearchSchema,
});
