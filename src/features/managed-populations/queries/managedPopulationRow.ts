import type {
  ManagedPopulationType,
  PopulationResourceEntry,
} from "../types/managedPopulationTypes";

export type PopulationResourceEntryRow = {
  readonly amount_per_n_animals: number;
  readonly resource_id: string;
};

export type ManagedPopulationTypeRow = {
  readonly created_at: string;
  readonly culling_job_id: string;
  readonly culling_outputs_json: readonly PopulationResourceEntryRow[];
  readonly growth_rate: number;
  readonly husbandry_job_id: string;
  readonly husbandry_workers_per_n_animals: number;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly maintenance_rules_json: readonly PopulationResourceEntryRow[];
  readonly name: string;
  // Embedded FK references — job_definitions whose linked_managed_population_type_id = this id.
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly regular_outputs_json: readonly PopulationResourceEntryRow[];
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

export const MANAGED_POPULATION_TYPE_SELECT = [
  "id,world_id,name,slug,husbandry_job_id,culling_job_id",
  "husbandry_workers_per_n_animals,growth_rate",
  "maintenance_rules_json,culling_outputs_json,regular_outputs_json,is_trashed,created_at,updated_at",
  "referencing_jobs:job_definitions!job_definitions_linked_managed_pop_type_fk(id)",
].join(",");

export function toPopulationResourceEntry(
  row: PopulationResourceEntryRow,
): PopulationResourceEntry {
  return {
    amountPerNAnimals: row.amount_per_n_animals,
    resourceId: row.resource_id,
  };
}

export function toManagedPopulationType(
  row: ManagedPopulationTypeRow,
): ManagedPopulationType {
  return {
    createdAt: row.created_at,
    cullingJobId: row.culling_job_id,
    cullingOutputsJson: row.culling_outputs_json.map(toPopulationResourceEntry),
    growthRate: row.growth_rate,
    hasActiveReferences: row.referencing_jobs.length > 0,
    husbandryJobId: row.husbandry_job_id,
    husbandryWorkersPerNAnimals: row.husbandry_workers_per_n_animals,
    id: row.id,
    isTrashed: row.is_trashed,
    maintenanceRulesJson: row.maintenance_rules_json.map(
      toPopulationResourceEntry,
    ),
    name: row.name,
    regularOutputsJson: row.regular_outputs_json.map(toPopulationResourceEntry),
    slug: row.slug,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
