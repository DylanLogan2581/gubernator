import { tierEffectsToState } from "./tierEditorUtils";

import type {
  SettlementBuilding,
  SettlementBuildingState,
} from "../types/settlementBuildingTypes";

export type EffectChip = {
  readonly key: string;
  readonly label: string;
};

export function buildEffectChips(
  building: SettlementBuilding,
  resourceNames: ReadonlyMap<string, string>,
  jobNames: ReadonlyMap<string, string>,
): readonly EffectChip[] {
  const rows = tierEffectsToState(building.effectsJson);
  const chips: EffectChip[] = [];
  for (const row of rows) {
    switch (row.effectType) {
      case "population_cap_increase":
        chips.push({ key: row.id, label: `+${row.amount} pop cap` });
        break;
      case "job_capacity_increase":
        chips.push({
          key: row.id,
          label: `+${row.amount} ${jobNames.get(row.jobId) ?? row.jobId} jobs`,
        });
        break;
      case "resource_storage_increase":
        chips.push({
          key: row.id,
          label: `${row.amount} ${resourceNames.get(row.resourceId) ?? row.resourceId} cap`,
        });
        break;
      case "passive_resource_production":
        chips.push({
          key: row.id,
          label: `+${row.amount} ${resourceNames.get(row.resourceId) ?? row.resourceId}/turn`,
        });
        break;
      case "":
        break;
      default: {
        const _exhaustive: never = row.effectType;
        throw new Error(`Unknown effect type: ${String(_exhaustive)}`);
      }
    }
  }
  return chips;
}

export type StateBadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "destructive"
  | "warning";

export function stateBadgeVariant(
  state: SettlementBuildingState,
): StateBadgeVariant {
  switch (state) {
    case "active":
      return "default";
    case "suspended":
      return "warning";
    case "manually_deconstructed":
      return "secondary";
    case "auto_deconstructed":
      return "destructive";
  }
}

export function stateBadgeLabel(state: SettlementBuildingState): string {
  switch (state) {
    case "active":
      return "active";
    case "suspended":
      return "Suspended";
    case "manually_deconstructed":
      return "deconstructed";
    case "auto_deconstructed":
      return "Auto-deconstructed";
  }
}
