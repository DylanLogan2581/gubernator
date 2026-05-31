import type {
  BuildingBlueprint,
  BuildingBlueprintTier,
  TierCostEntry,
  TierEffect,
} from "../types/buildingTypes";

export type BlueprintRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly grace_period_turns: number;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly max_instances_per_settlement: number | null;
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

export type TierCostEntryRow = {
  readonly amount: number;
  readonly resource_id: string;
};

export type TierEffectRow =
  | {
      readonly amount: number;
      readonly job_id: string;
      readonly type: "job_capacity_increase";
    }
  | {
      readonly amount: number;
      readonly resource_id: string;
      readonly type: "passive_resource_production";
    }
  | {
      readonly amount: number;
      readonly resource_id: string;
      readonly type: "resource_storage_increase";
    }
  | {
      readonly amount: number;
      readonly type: "population_cap_increase";
    };

export type TierRow = {
  readonly building_blueprint_id: string;
  readonly construction_costs_json: readonly TierCostEntryRow[];
  readonly created_at: string;
  readonly effects_json: readonly TierEffectRow[];
  readonly id: string;
  readonly tier_number: number;
  readonly updated_at: string;
  readonly upkeep_costs_json: readonly TierCostEntryRow[];
  readonly worker_turns_required: number;
};

export const BLUEPRINT_SELECT =
  "id,world_id,name,slug,description,grace_period_turns,max_instances_per_settlement,is_trashed,created_at,updated_at";

export const TIER_SELECT =
  "id,building_blueprint_id,tier_number,worker_turns_required,construction_costs_json,upkeep_costs_json,effects_json,created_at,updated_at";

export function toBlueprint(row: BlueprintRow): BuildingBlueprint {
  return {
    createdAt: row.created_at,
    description: row.description,
    gracePeriodTurns: row.grace_period_turns,
    id: row.id,
    isTrashed: row.is_trashed,
    maxInstancesPerSettlement: row.max_instances_per_settlement,
    name: row.name,
    slug: row.slug,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}

export function toCostEntry(row: TierCostEntryRow): TierCostEntry {
  return {
    amount: row.amount,
    resourceId: row.resource_id,
  };
}

export function toTierEffect(row: TierEffectRow): TierEffect {
  switch (row.type) {
    case "job_capacity_increase":
      return {
        amount: row.amount,
        jobId: row.job_id,
        type: "job_capacity_increase",
      };
    case "passive_resource_production":
      return {
        amount: row.amount,
        resourceId: row.resource_id,
        type: "passive_resource_production",
      };
    case "resource_storage_increase":
      return {
        amount: row.amount,
        resourceId: row.resource_id,
        type: "resource_storage_increase",
      };
    case "population_cap_increase":
      return {
        amount: row.amount,
        type: "population_cap_increase",
      };
  }
}

export function toTier(row: TierRow): BuildingBlueprintTier {
  return {
    buildingBlueprintId: row.building_blueprint_id,
    constructionCostsJson: row.construction_costs_json.map(toCostEntry),
    createdAt: row.created_at,
    effectsJson: row.effects_json.map(toTierEffect),
    id: row.id,
    tierNumber: row.tier_number,
    updatedAt: row.updated_at,
    upkeepCostsJson: row.upkeep_costs_json.map(toCostEntry),
    workerTurnsRequired: row.worker_turns_required,
  };
}
