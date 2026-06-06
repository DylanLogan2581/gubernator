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
  readonly id: string;
  readonly name: string;
  readonly nationId: string;
};
