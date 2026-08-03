import type {
  Army,
  ArmyFundingSource,
  ArmyGroup,
  ArmyTurnSnapshot,
  ArmyUnit,
  UnitSoldier,
} from "../types/armyTypes";

export type ArmyRow = {
  readonly created_at: string;
  readonly created_turn_number: number;
  readonly funding_source: string;
  readonly id: string;
  readonly name: string;
  readonly nation_id: string;
  readonly stationed_settlement_id: string;
  readonly updated_at: string;
  readonly world_id: string;
};

export type ArmyGroupRow = {
  readonly army_id: string;
  readonly created_at: string;
  readonly id: string;
  readonly name: string;
  readonly parent_group_id: string | null;
  readonly sort_order: number;
  readonly updated_at: string;
};

export type ArmyUnitRow = {
  readonly army_id: string;
  readonly created_at: string;
  readonly created_turn_number: number;
  readonly group_id: string | null;
  readonly id: string;
  readonly name: string;
  readonly sort_order: number;
  readonly unit_type_id: string;
  readonly updated_at: string;
};

export type UnitSoldierRow = {
  readonly citizen_id: string;
  readonly created_at: string;
  readonly home_settlement_id: string | null;
  readonly id: string;
  readonly recruited_turn_number: number;
  readonly unit_id: string;
  readonly world_id: string;
};

export type ArmyTurnSnapshotRow = {
  readonly army_id: string;
  readonly created_at: string;
  readonly id: string;
  readonly soldier_count_total: number;
  readonly turn_number: number;
  readonly upkeep_paid: boolean;
  readonly world_id: string;
};

export const ARMY_SELECT =
  "id,world_id,nation_id,name,funding_source,stationed_settlement_id,created_turn_number,created_at,updated_at";

export const ARMY_GROUP_SELECT =
  "id,army_id,parent_group_id,name,sort_order,created_at,updated_at";

export const ARMY_UNIT_SELECT =
  "id,army_id,group_id,unit_type_id,name,sort_order,created_turn_number,created_at,updated_at";

export const UNIT_SOLDIER_SELECT =
  "id,world_id,unit_id,citizen_id,home_settlement_id,recruited_turn_number,created_at";

export const ARMY_TURN_SNAPSHOT_SELECT =
  "id,world_id,army_id,turn_number,soldier_count_total,upkeep_paid,created_at";

export function toArmy(row: ArmyRow): Army {
  return {
    createdAt: row.created_at,
    createdTurnNumber: row.created_turn_number,
    fundingSource: row.funding_source as ArmyFundingSource,
    id: row.id,
    name: row.name,
    nationId: row.nation_id,
    stationedSettlementId: row.stationed_settlement_id,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}

export function toArmyGroup(row: ArmyGroupRow): ArmyGroup {
  return {
    armyId: row.army_id,
    createdAt: row.created_at,
    id: row.id,
    name: row.name,
    parentGroupId: row.parent_group_id,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

export function toArmyUnit(row: ArmyUnitRow): ArmyUnit {
  return {
    armyId: row.army_id,
    createdAt: row.created_at,
    createdTurnNumber: row.created_turn_number,
    groupId: row.group_id,
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    unitTypeId: row.unit_type_id,
    updatedAt: row.updated_at,
  };
}

export function toUnitSoldier(row: UnitSoldierRow): UnitSoldier {
  return {
    citizenId: row.citizen_id,
    createdAt: row.created_at,
    homeSettlementId: row.home_settlement_id,
    id: row.id,
    recruitedTurnNumber: row.recruited_turn_number,
    unitId: row.unit_id,
    worldId: row.world_id,
  };
}

export function toArmyTurnSnapshot(row: ArmyTurnSnapshotRow): ArmyTurnSnapshot {
  return {
    armyId: row.army_id,
    createdAt: row.created_at,
    id: row.id,
    soldierCountTotal: row.soldier_count_total,
    turnNumber: row.turn_number,
    upkeepPaid: row.upkeep_paid,
    worldId: row.world_id,
  };
}
