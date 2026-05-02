export type SettlementReadinessListItem = {
  readonly autoReadyEnabled: boolean;
  readonly id: string;
  readonly isReadyCurrentTurn: boolean;
  readonly name: string;
  readonly nationId: string;
  readonly readySetAt: string | null;
};
