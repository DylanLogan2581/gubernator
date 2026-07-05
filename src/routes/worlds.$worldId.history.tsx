import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { TurnLogPage } from "@/features/turns";

import type { JSX } from "react";

const historySearchSchema = z.object({
  turn: z
    .union([z.literal("all"), z.coerce.number().int().positive()])
    .optional(),
});

function parseHistorySearch(search: unknown): {
  readonly turn?: number | "all";
} {
  const result = historySearchSchema.safeParse(search);
  return result.success ? result.data : {};
}

function WorldHistoryRoute(): JSX.Element {
  const { worldId } = Route.useParams();
  const { turn } = Route.useSearch();

  return <TurnLogPage selectedTurn={turn} worldId={worldId} />;
}

export const Route = createFileRoute("/worlds/$worldId/history")({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: WorldHistoryRoute,
  pendingComponent: WorldHistoryPendingRoute,
  validateSearch: parseHistorySearch,
});

function WorldHistoryPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
