export type ArmyFundingSource = "host_settlement" | "nation";

export type Army = {
  readonly createdAt: string;
  readonly createdTurnNumber: number;
  readonly fundingSource: ArmyFundingSource;
  readonly id: string;
  readonly name: string;
  readonly nationId: string;
  readonly stationedSettlementId: string;
  readonly updatedAt: string;
  readonly worldId: string;
};

export type ArmyGroup = {
  readonly armyId: string;
  readonly createdAt: string;
  readonly id: string;
  readonly name: string;
  readonly parentGroupId: string | null;
  readonly sortOrder: number;
  readonly updatedAt: string;
};

export type ArmyUnit = {
  readonly armyId: string;
  readonly createdAt: string;
  readonly createdTurnNumber: number;
  readonly groupId: string | null;
  readonly id: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly unitTypeId: string;
  readonly updatedAt: string;
};

export type UnitSoldier = {
  readonly citizenId: string;
  readonly createdAt: string;
  readonly homeSettlementId: string | null;
  readonly id: string;
  readonly recruitedTurnNumber: number;
  readonly unitId: string;
  readonly worldId: string;
};

export type ArmyTurnSnapshot = {
  readonly armyId: string;
  readonly createdAt: string;
  readonly id: string;
  readonly soldierCountTotal: number;
  readonly turnNumber: number;
  readonly upkeepPaid: boolean;
  readonly worldId: string;
};

export function formatArmyFundingSource(
  fundingSource: ArmyFundingSource,
): string {
  switch (fundingSource) {
    case "nation":
      return "Nation treasury";
    case "host_settlement":
      return "Host settlement";
  }
}
