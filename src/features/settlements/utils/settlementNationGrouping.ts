import { computeSettlementReadinessSummary } from "./settlementReadinessSummary";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";

export type SettlementNationGroup = {
  readonly items: readonly SettlementReadinessListItem[];
  readonly nationId: string;
  readonly nationName: string;
  readonly readyCount: number;
  readonly readyPercentage: number;
  readonly totalCount: number;
};

export function groupSettlementsByNation(
  items: readonly SettlementReadinessListItem[],
): readonly SettlementNationGroup[] {
  const map = new Map<
    string,
    {
      items: SettlementReadinessListItem[];
      nationId: string;
      nationName: string;
    }
  >();

  for (const item of items) {
    const group = map.get(item.nationId);
    if (group !== undefined) {
      group.items.push(item);
    } else {
      map.set(item.nationId, {
        items: [item],
        nationId: item.nationId,
        nationName: item.nationName,
      });
    }
  }

  return [...map.values()]
    .map((group) => {
      const summary = computeSettlementReadinessSummary(
        group.items.map((item) => ({
          auto_ready_enabled: item.autoReadyEnabled,
          is_ready_current_turn: item.isReadyCurrentTurn,
        })),
      );
      return {
        items: group.items,
        nationId: group.nationId,
        nationName: group.nationName,
        readyCount: summary.readySettlementCount,
        readyPercentage: summary.readyPercentage,
        totalCount: summary.totalSettlementCount,
      };
    })
    .sort((a, b) =>
      a.nationName.localeCompare(b.nationName, undefined, {
        sensitivity: "base",
      }),
    );
}
