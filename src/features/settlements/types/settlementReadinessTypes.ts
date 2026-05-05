export type SettlementReadinessListItem = {
  readonly autoReadyEnabled: boolean;
  readonly id: string;
  readonly isReadyCurrentTurn: boolean;
  readonly isReadyForCurrentTurn: boolean;
  readonly lastReadyAt: string | null;
  readonly name: string;
  readonly nationId: string;
  readonly readySetAt: string | null;
};

export type SettlementReadinessSummary = {
  readonly notReadySettlementCount: number;
  readonly readyPercentage: number;
  readonly readySettlementCount: number;
  readonly totalSettlementCount: number;
};
