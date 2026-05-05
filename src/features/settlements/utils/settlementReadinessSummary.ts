import type { SettlementReadinessSummary } from "../types/settlementReadinessTypes";

export type SettlementReadinessSummaryRow = {
  readonly auto_ready_enabled: boolean;
  readonly is_ready_current_turn: boolean;
};

export function computeSettlementReadinessSummary(
  rows: readonly SettlementReadinessSummaryRow[],
): SettlementReadinessSummary {
  const totalSettlementCount = rows.length;
  const readySettlementCount = rows.filter(
    isSettlementReadyForCurrentTurn,
  ).length;
  const notReadySettlementCount = totalSettlementCount - readySettlementCount;
  const readyPercentage =
    totalSettlementCount === 0
      ? 0
      : (readySettlementCount / totalSettlementCount) * 100;

  return {
    notReadySettlementCount,
    readyPercentage,
    readySettlementCount,
    totalSettlementCount,
  };
}

export function formatSettlementReadinessPercentage(
  readyPercentage: number,
): string {
  return `${Math.floor(readyPercentage)}%`;
}

export function isSettlementReadyForCurrentTurn(
  row: SettlementReadinessSummaryRow,
): boolean {
  return row.auto_ready_enabled || row.is_ready_current_turn;
}
