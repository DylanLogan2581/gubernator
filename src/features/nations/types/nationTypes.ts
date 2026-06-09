export type Nation = {
  readonly createdAt: string;
  readonly description: string | null;
  readonly id: string;
  readonly isHidden: boolean;
  readonly name: string;
  readonly namesetId: string | null;
  readonly updatedAt: string;
  readonly worldId: string;
};

export type NationSettlement = {
  readonly autoReadyEnabled: boolean;
  readonly id: string;
  readonly isReadyCurrentTurn: boolean;
  readonly isReadyForCurrentTurn: boolean;
  readonly lastReadyAt: string | null;
  readonly name: string;
  readonly nationId: string;
  readonly nationName: string;
  readonly readySetAt: string | null;
};
