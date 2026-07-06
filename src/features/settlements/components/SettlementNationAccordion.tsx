import { Link } from "@tanstack/react-router";
import { AlertCircle, Check, ChevronDown } from "lucide-react";
import { useMemo } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import type { WorldPermissionContext } from "@/features/worlds";

import { groupSettlementsByNation } from "../utils/settlementNationGrouping";

import { SettlementReadinessTable } from "./SettlementReadinessTable";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";
import type { SettlementNationGroup } from "../utils/settlementNationGrouping";
import type { JSX } from "react";

type SettlementNationAccordionProps = {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly items: readonly SettlementReadinessListItem[];
  readonly worldId: string;
};

export function SettlementNationAccordion({
  accessContext,
  canAdmin,
  canManage,
  isArchived,
  items,
  worldId,
}: SettlementNationAccordionProps): JSX.Element {
  const groups = useMemo(() => groupSettlementsByNation(items), [items]);

  return (
    <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
      {groups.map((group) => (
        <NationAccordionRow
          key={group.nationId}
          accessContext={accessContext}
          canAdmin={canAdmin}
          canManage={canManage}
          group={group}
          isArchived={isArchived}
          worldId={worldId}
        />
      ))}
    </div>
  );
}

type NationAccordionRowProps = {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly group: SettlementNationGroup;
  readonly isArchived: boolean;
  readonly worldId: string;
};

function NationAccordionRow({
  accessContext,
  canAdmin,
  canManage,
  group,
  isArchived,
  worldId,
}: NationAccordionRowProps): JSX.Element {
  const allReady = group.readyCount === group.totalCount;
  const noneReady = group.readyCount === 0;
  const bgColor = allReady
    ? "group-data-[state=closed]:bg-green-50 dark:group-data-[state=closed]:bg-green-950/30"
    : "";

  return (
    <Collapsible className="group">
      <div
        className={`flex w-full items-center justify-between px-4 text-left transition-colors ${bgColor}`}
      >
        <Link
          to="/worlds/$worldId/nations/$nationId"
          params={{
            nationId: group.nationId,
            worldId,
          }}
          search={{}}
          className="py-3 font-medium underline-offset-4 hover:underline"
        >
          {group.nationName}
        </Link>
        <CollapsibleTrigger
          aria-label={`Toggle ${group.nationName} settlements (${group.readyCount}/${group.totalCount} ready)`}
          className="flex flex-1 items-center justify-end gap-4 py-3 pl-4 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <span>
            {group.readyCount}/{group.totalCount} ready
          </span>
          <Progress
            value={group.readyPercentage}
            className={`w-20 ${noneReady ? "[&>div]:bg-destructive" : ""}`}
          />
          <div
            className="w-5 h-5 shrink-0 flex items-center justify-center"
            role="img"
            aria-label={
              allReady ? "all ready" : noneReady ? "none ready" : "not ready"
            }
          >
            {allReady ? (
              <Check
                aria-hidden="true"
                className="w-4 h-4 text-green-600 dark:text-green-500"
              />
            ) : noneReady ? (
              <AlertCircle
                aria-hidden="true"
                className="w-4 h-4 text-red-600 dark:text-red-500"
              />
            ) : null}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="border-t border-border px-4 pb-4 pt-2">
          <SettlementReadinessTable
            accessContext={accessContext}
            canAdmin={canAdmin}
            canManage={canManage}
            isArchived={isArchived}
            items={group.items}
            worldId={worldId}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
