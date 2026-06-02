import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { SettlementDetailPage } from "@/features/settlements";

import type { JSX } from "react";

const ASSIGNMENT_TABS = ["bulk", "per-target"] as const;

type AssignmentTab = (typeof ASSIGNMENT_TABS)[number];

const DEFAULT_ASSIGNMENT_TAB: AssignmentTab = "bulk";

const assignmentSearchSchema = z.object({
  assignmentTab: z.enum(ASSIGNMENT_TABS).optional(),
});

function parseAssignmentSearch(search: unknown): {
  readonly assignmentTab?: AssignmentTab;
} {
  const result = assignmentSearchSchema.safeParse(search);
  return {
    assignmentTab: result.success
      ? (result.data.assignmentTab ?? DEFAULT_ASSIGNMENT_TAB)
      : DEFAULT_ASSIGNMENT_TAB,
  };
}

function SettlementDetailRoute(): JSX.Element {
  const { nationId, settlementId, worldId } = Route.useParams();
  const { assignmentTab = DEFAULT_ASSIGNMENT_TAB } = Route.useSearch();

  return (
    <SettlementDetailPage
      assignmentTab={assignmentTab}
      nationId={nationId}
      settlementId={settlementId}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
)({
  beforeLoad: ({ context, location }) =>
    requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    }),
  component: SettlementDetailRoute,
  pendingComponent: SettlementDetailPendingRoute,
  validateSearch: parseAssignmentSearch,
});

function SettlementDetailPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
