export type EventEffectType =
  | "building_destroyed"
  | "consumption_multiplier"
  | "deposit_destroyed"
  | "managed_population_change"
  | "modify_resource"
  | "population_boost"
  | "population_loss"
  | "production_multiplier"
  | "resource_drain"
  | "resource_grant"
  | "upkeep_multiplier";

export type EffectData = {
  effectType: string;
  isPercent: boolean;
  amountValue: number | null;
  multiplierValue: number | null;
  resourceId: string | null;
  resourceIds?: string[];
  resourceMode?: "all" | "select";
  populationType?: "boost" | "loss";
  jobId: string | null;
  jobIds?: string[];
  jobMode?: "all" | "select";
  managedPopulationInstanceId: string | null;
  managedPopulationTypeId: string | null;
  managedPopulationMode?: "all" | "type" | "instance";
  depositInstanceId: string | null;
  depositInstanceIds?: string[];
  depositTypeId?: string | null;
  depositDestroyedMode?: "instance" | "type";
  settlementBuildingId: string | null;
  settlementBuildingIds?: string[];
  buildingBlueprintMode?: "all" | "select" | "instance";
  buildingBlueprintIds?: string[];
  buildingInstanceIds?: string[];
  _id?: string;
};

export type EffectScopeType = "world" | "nation" | "settlement" | null;

/** Props shared by every per-effect-type sub-editor. */
export type EffectEditorProps = {
  readonly effect: EffectData;
  readonly index: number;
  readonly onUpdate: (updated: EffectData) => void;
  readonly worldId: string;
  readonly selectedIds: string[];
  readonly scopeType: EffectScopeType;
};
