import { useId, useState, type JSX } from "react";

import { BulkJobsTab } from "./BulkJobsTab";
import { PerTargetJobsTab } from "./PerTargetJobsTab";

type Tab = "bulk" | "per-target";

type SettlementAssignmentBoardProps = {
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
};

export function SettlementAssignmentBoard({
  canManage,
  isArchived,
  settlementId,
}: SettlementAssignmentBoardProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>("bulk");
  const tablistId = useId();
  const bulkTabId = `${tablistId}-bulk-tab`;
  const perTargetTabId = `${tablistId}-per-target-tab`;
  const bulkPanelId = `${tablistId}-bulk-panel`;
  const perTargetPanelId = `${tablistId}-per-target-panel`;

  const canEdit = canManage && !isArchived;

  return (
    <section
      aria-labelledby="settlement-assignment-board-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <h2
        id="settlement-assignment-board-heading"
        className="text-base font-medium"
      >
        Job Assignments
      </h2>

      <div
        aria-label="Assignment view"
        className="flex gap-1 border-b border-border"
        role="tablist"
      >
        <button
          aria-controls={bulkPanelId}
          aria-selected={activeTab === "bulk"}
          className={`px-3 pb-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            activeTab === "bulk"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          id={bulkTabId}
          role="tab"
          type="button"
          onClick={() => {
            setActiveTab("bulk");
          }}
        >
          Bulk jobs
        </button>
        <button
          aria-controls={perTargetPanelId}
          aria-selected={activeTab === "per-target"}
          className={`px-3 pb-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            activeTab === "per-target"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          id={perTargetTabId}
          role="tab"
          type="button"
          onClick={() => {
            setActiveTab("per-target");
          }}
        >
          Per-target jobs
        </button>
      </div>

      <div
        aria-labelledby={bulkTabId}
        hidden={activeTab !== "bulk"}
        id={bulkPanelId}
        role="tabpanel"
      >
        {activeTab === "bulk" ? (
          <BulkJobsTab canEdit={canEdit} settlementId={settlementId} />
        ) : null}
      </div>

      <div
        aria-labelledby={perTargetTabId}
        hidden={activeTab !== "per-target"}
        id={perTargetPanelId}
        role="tabpanel"
      >
        {activeTab === "per-target" ? (
          <PerTargetJobsTab canEdit={canEdit} settlementId={settlementId} />
        ) : null}
      </div>
    </section>
  );
}
