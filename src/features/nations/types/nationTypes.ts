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
  readonly taxRate: number;
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

// Treasury (#1084): nation stockpile row, one per resource held by the
// nation.
export type NationStockpileEntry = {
  readonly isSystemResource: boolean;
  readonly quantity: number;
  readonly resourceId: string;
  readonly resourceName: string;
};

// Treasury (#1084): one required input resource for a construction project,
// derived from the target tier's construction_costs_json (v1 has no
// "remaining inputs" tracking, so this is always the tier's full cost).
export type NationConstructionProjectCost = {
  readonly amount: number;
  readonly resourceId: string;
  readonly resourceName: string;
};

// Treasury (#1084): an active (queued/in_progress/paused) construction
// project belonging to one of the nation's settlements, for the Subsidize
// dialog's project picker.
export type NationActiveConstructionProject = {
  readonly blueprintName: string;
  readonly costs: readonly NationConstructionProjectCost[];
  readonly id: string;
  readonly settlementId: string;
  readonly settlementName: string;
  readonly tierNumber: number;
};

// Treasury (#1084): the most recent nation_turn_snapshots row, used to
// render an "estimated next-turn intake" figure on the tax rate slider.
// null before the nation's first economy-phase snapshot exists.
export type NationLatestTaxSnapshot = {
  readonly totalTaxCollected: number;
  readonly turnNumber: number;
};

// Discovery (#1085): one recorded nation_discoveries row. nationAId is
// always the lexicographically smaller nation id (the DB's canonical pair
// order); callers should not assume it matches UI row/column order.
export type NationDiscoveryPair = {
  readonly createdByUserId: string | null;
  readonly metAtTurnNumber: number;
  readonly nationAId: string;
  readonly nationBId: string;
};
