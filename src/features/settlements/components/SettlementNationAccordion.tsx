import { ChevronDown } from "lucide-react";
import { useMemo } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { WorldPermissionContext } from "@/features/worlds";

import { groupSettlementsByNation } from "../utils/settlementNationGrouping";
import { formatSettlementReadinessPercentage } from "../utils/settlementReadinessSummary";

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
  return (
    <Collapsible className="group">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50">
        <span className="font-medium">{group.nationName}</span>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            {group.readyCount}/{group.totalCount} ready
          </span>
          <span>
            {formatSettlementReadinessPercentage(group.readyPercentage)}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
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
