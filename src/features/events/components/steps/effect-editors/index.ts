import { BuildingDestroyedEditor } from "./BuildingDestroyedEditor";
import { ConsumptionMultiplierEditor } from "./ConsumptionMultiplierEditor";
import { DepositDestroyedEditor } from "./DepositDestroyedEditor";
import { ManagedPopulationEffectEditor } from "./ManagedPopulationEffectEditor";
import { PopulationEffectEditor } from "./PopulationEffectEditor";
import { ProductionMultiplierEditor } from "./ProductionMultiplierEditor";
import { ResourceEffectEditor } from "./ResourceEffectEditor";
import { UpkeepMultiplierEditor } from "./UpkeepMultiplierEditor";

import type { EffectEditorProps } from "./Types";
import type { ComponentType } from "react";

export type { EffectData, EffectEditorProps, EventEffectType } from "./Types";

/**
 * Maps every effect type (including the legacy resource_grant/resource_drain
 * and population_boost aliases) to its dedicated sub-editor. Adding a new
 * effect type = one sub-editor component + one entry here.
 */
export const EFFECT_EDITORS: Record<
  string,
  ComponentType<EffectEditorProps>
> = {
  modify_resource: ResourceEffectEditor,
  resource_grant: ResourceEffectEditor,
  resource_drain: ResourceEffectEditor,
  population_boost: PopulationEffectEditor,
  population_loss: PopulationEffectEditor,
  managed_population_change: ManagedPopulationEffectEditor,
  production_multiplier: ProductionMultiplierEditor,
  consumption_multiplier: ConsumptionMultiplierEditor,
  upkeep_multiplier: UpkeepMultiplierEditor,
  building_destroyed: BuildingDestroyedEditor,
  deposit_destroyed: DepositDestroyedEditor,
};
