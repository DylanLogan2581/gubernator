import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { SettlementDetailPage } from "@/features/settlements";

import type { JSX } from "react";

const ASSIGNMENT_TABS = ["bulk", "per-target"] as const;
const SECTION_TABS = [
  "overview",
  "population",
  "economy",
  "forecast",
  "reports",
  "admin",
  "history",
] as const;

type AssignmentTab = (typeof ASSIGNMENT_TABS)[number];
type SectionTab = (typeof SECTION_TABS)[number];

const DEFAULT_ASSIGNMENT_TAB: AssignmentTab = "bulk";
const DEFAULT_SECTION_TAB: SectionTab = "overview";

const settlementDetailSearchSchema = z.object({
  assignmentTab: z.enum(ASSIGNMENT_TABS).optional(),
  section: z.enum(SECTION_TABS).optional(),
});

function parseSettlementDetailSearch(search: unknown): {
  readonly assignmentTab?: AssignmentTab;
  readonly section?: SectionTab;
} {
  const result = settlementDetailSearchSchema.safeParse(search);
  return {
    assignmentTab: result.success
      ? (result.data.assignmentTab ?? DEFAULT_ASSIGNMENT_TAB)
      : DEFAULT_ASSIGNMENT_TAB,
    section: result.success
      ? (result.data.section ?? DEFAULT_SECTION_TAB)
      : DEFAULT_SECTION_TAB,
  };
}

function SettlementDetailRoute(): JSX.Element {
  const { nationId, settlementId, worldId } = Route.useParams();
  const {
    assignmentTab = DEFAULT_ASSIGNMENT_TAB,
    section = DEFAULT_SECTION_TAB,
  } = Route.useSearch();

  return (
    <SettlementDetailPage
      assignmentTab={assignmentTab}
      nationId={nationId}
      settlementId={settlementId}
      worldId={worldId}
      activeSection={section}
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
  validateSearch: parseSettlementDetailSearch,
});

function SettlementDetailPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
