export const NATION_GOVERNMENT_TYPES = [
  "monarchy",
  "republic",
  "theocracy",
  "tribal_council",
  "confederation",
  "despotism",
] as const;

export type NationGovernmentType = (typeof NATION_GOVERNMENT_TYPES)[number];

export type Nation = {
  readonly capitalSettlementId: string | null;
  readonly createdAt: string;
  readonly description: string | null;
  readonly flagPath: string | null;
  readonly foundedTurnNumber: number | null;
  readonly governmentType: NationGovernmentType;
  readonly id: string;
  readonly isHidden: boolean;
  readonly name: string;
  readonly namesetId: string | null;
  readonly updatedAt: string;
  readonly worldId: string;
};

export function formatNationGovernmentType(
  governmentType: NationGovernmentType,
): string {
  switch (governmentType) {
    case "monarchy":
      return "Monarchy";
    case "republic":
      return "Republic";
    case "theocracy":
      return "Theocracy";
    case "tribal_council":
      return "Tribal council";
    case "confederation":
      return "Confederation";
    case "despotism":
      return "Despotism";
    default:
      return governmentType;
  }
}

export type NationSettlement = {
  readonly autoReadyEnabled: boolean;
  readonly id: string;
  readonly isReadyCurrentTurn: boolean;
  readonly isReadyForCurrentTurn: boolean;
  readonly lastReadyAt: string | null;
  readonly name: string;
  readonly nationId: string;
  readonly nationName: string;
  readonly population: number;
  readonly readySetAt: string | null;
};
