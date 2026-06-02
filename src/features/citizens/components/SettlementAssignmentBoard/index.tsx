import { Link, useNavigate } from "@tanstack/react-router";

import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

import { BulkJobsTab } from "./BulkJobsTab";
import { PerTargetJobsTab } from "./PerTargetJobsTab";

import type { ChangeEvent, JSX } from "react";

type Tab = "bulk" | "per-target";

type SettlementAssignmentBoardProps = {
  readonly activeTab: Tab;
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementAssignmentBoard({
  activeTab,
  canManage,
  isArchived,
  nationId,
  settlementId,
  worldId,
}: SettlementAssignmentBoardProps): JSX.Element {
  const navigate = useNavigate();
  const canEdit = canManage && !isArchived;

  const settlementParams = { nationId, settlementId, worldId };

  function handleSelectChange(e: ChangeEvent<HTMLSelectElement>): void {
    void navigate({
      params: settlementParams,
      search: { assignmentTab: e.target.value as Tab },
      to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
    });
  }

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

      {/* Mobile select — visible below md breakpoint */}
      <div className="md:hidden">
        <NativeSelect
          aria-label="Assignment view"
          value={activeTab}
          onChange={handleSelectChange}
        >
          <option value="bulk">Bulk jobs</option>
          <option value="per-target">Per-target jobs</option>
        </NativeSelect>
      </div>

      {/* Desktop tab nav — visible from md up */}
      <nav
        aria-label="Assignment view"
        className="hidden border-b border-border md:flex"
      >
        <Link
          aria-current={activeTab === "bulk" ? "page" : undefined}
          className={cn(
            "px-3 pb-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            activeTab === "bulk"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          params={settlementParams}
          search={{ assignmentTab: "bulk" }}
          to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
        >
          Bulk jobs
        </Link>
        <Link
          aria-current={activeTab === "per-target" ? "page" : undefined}
          className={cn(
            "px-3 pb-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            activeTab === "per-target"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          params={settlementParams}
          search={{ assignmentTab: "per-target" }}
          to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
        >
          Per-target jobs
        </Link>
      </nav>

      <div hidden={activeTab !== "bulk"}>
        <BulkJobsTab canEdit={canEdit} settlementId={settlementId} />
      </div>

      <div hidden={activeTab !== "per-target"}>
        <PerTargetJobsTab canEdit={canEdit} settlementId={settlementId} />
      </div>
    </section>
  );
}
