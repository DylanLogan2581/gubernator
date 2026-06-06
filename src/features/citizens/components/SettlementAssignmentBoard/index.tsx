import { useNavigate } from "@tanstack/react-router";

import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BulkJobsTab } from "./BulkJobsTab";
import { PerTargetJobsTab } from "./PerTargetJobsTab";

import type { ChangeEvent, JSX } from "react";

type Tab = "bulk" | "per-target";

type SettlementAssignmentBoardProps = {
  readonly activeTab: Tab;
  readonly canManageSettlement: boolean;
  readonly isArchived: boolean;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementAssignmentBoard({
  activeTab,
  canManageSettlement,
  isArchived,
  nationId,
  settlementId,
  worldId,
}: SettlementAssignmentBoardProps): JSX.Element {
  const navigate = useNavigate();
  const canEdit = canManageSettlement && !isArchived;

  const settlementParams = { nationId, settlementId, worldId };

  function handleTabChange(value: string): void {
    void navigate({
      params: settlementParams,
      resetScroll: false,
      search: { assignmentTab: value as Tab },
      to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
    });
  }

  function handleSelectChange(e: ChangeEvent<HTMLSelectElement>): void {
    handleTabChange(e.target.value);
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

      {/* Desktop tab strip — visible from md up */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="hidden md:flex">
          <TabsTrigger value="bulk">Bulk jobs</TabsTrigger>
          <TabsTrigger value="per-target">Per-target jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="bulk" forceMount>
          <BulkJobsTab canEdit={canEdit} settlementId={settlementId} />
        </TabsContent>
        <TabsContent value="per-target" forceMount>
          <PerTargetJobsTab canEdit={canEdit} settlementId={settlementId} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
