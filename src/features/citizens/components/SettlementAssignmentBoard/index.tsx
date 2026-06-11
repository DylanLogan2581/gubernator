import { JobAssignmentsTable } from "./JobAssignmentsTable";

import type { JSX } from "react";

type SettlementAssignmentBoardProps = {
  readonly activeTab: "bulk" | "per-target";
  readonly canManageSettlement: boolean;
  readonly isArchived: boolean;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementAssignmentBoard({
  canManageSettlement,
  isArchived,
  settlementId,
}: SettlementAssignmentBoardProps): JSX.Element {
  const canEdit = canManageSettlement && !isArchived;

  return (
    <section
      aria-labelledby="settlement-assignment-board-heading"
      className="grid gap-3 p-4"
    >
      <h2
        id="settlement-assignment-board-heading"
        className="text-base font-medium"
      >
        Job Assignments
      </h2>

      <JobAssignmentsTable canEdit={canEdit} settlementId={settlementId} />
    </section>
  );
}
