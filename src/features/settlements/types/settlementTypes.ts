export type Settlement = {
  readonly coordX: number | null;
  readonly coordZ: number | null;
  readonly createdAt: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly nationId: string;
  readonly updatedAt: string;
};

export type SettlementNationSummary = {
  readonly id: string;
  readonly name: string;
  readonly worldId: string;
};

export type SettlementWithNation = Settlement & {
  readonly nation: SettlementNationSummary;
};

export type SettlementSummary = {
  readonly id: string;
  readonly name: string;
  readonly nationId: string;
  readonly nationName: string;
};
