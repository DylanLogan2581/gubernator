export type Settlement = {
  readonly coordX: number | null;
  readonly coordZ: number | null;
  readonly createdAt: string;
  readonly description: string | null;
  readonly flagPath: string | null;
  readonly id: string;
  readonly name: string;
  readonly namesetId: string | null;
  readonly nationId: string;
  readonly sealPath: string | null;
  readonly updatedAt: string;
};

export type SettlementNationSummary = {
  readonly id: string;
  readonly name: string;
  readonly namesetId: string | null;
  readonly worldId: string;
};

export type SettlementWithNation = Settlement & {
  readonly nation: SettlementNationSummary;
};

export type SettlementSummary = {
  readonly flagPath: string | null;
  readonly id: string;
  readonly name: string;
  readonly nationId: string;
  readonly nationName: string;
};
