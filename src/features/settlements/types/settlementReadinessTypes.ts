export type SettlementReadinessListItem = {
  readonly autoReadyEnabled: boolean;
  readonly id: string;
  readonly isReadyCurrentTurn: boolean;
  readonly isReadyForCurrentTurn: boolean;
  readonly name: string;
  readonly nationId: string;
  readonly readySetAt: string | null;
};

export type SettlementReadinessSummary = {
  readonly pendingSettlementCount: number;
  readonly readySettlementCount: number;
  readonly totalSettlementCount: number;
};
