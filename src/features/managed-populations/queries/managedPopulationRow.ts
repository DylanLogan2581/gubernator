import type {
  ManagedPopulationCullingJob,
  ManagedPopulationHusbandryJob,
  ManagedPopulationType,
  PopulationResourceEntry,
} from "../types/managedPopulationTypes";

export type PopulationResourceEntryRow = {
  readonly amount_per_n_animals: number;
  readonly resource_id: string;
};

export type ManagedPopulationHusbandryJobRow = {
  readonly id: string;
  readonly job_id: string;
  readonly workers_per_n_animals: number;
};

export type ManagedPopulationCullingJobRow = {
  readonly id: string;
  readonly job_id: string;
  readonly max_cull_per_worker: number;
};

export type ManagedPopulationTypeRow = {
  readonly created_at: string;
  readonly culling_outputs_json: readonly PopulationResourceEntryRow[];
  readonly growth_rate: number;
  readonly icon: string | null;
  readonly icon_color: number | null;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly maintenance_rules_json: readonly PopulationResourceEntryRow[];
  readonly managed_population_culling_jobs: readonly ManagedPopulationCullingJobRow[];
  readonly managed_population_husbandry_jobs: readonly ManagedPopulationHusbandryJobRow[];
  readonly name: string;
  // Embedded FK references — job_definitions whose linked_managed_population_type_id = this id.
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly regular_outputs_json: readonly PopulationResourceEntryRow[];
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

export const MANAGED_POPULATION_TYPE_SELECT = [
  "id,world_id,name,slug,icon,icon_color,growth_rate",
  "maintenance_rules_json,culling_outputs_json,regular_outputs_json,is_trashed,created_at,updated_at",
  "referencing_jobs:job_definitions!job_definitions_linked_managed_pop_type_fk(id)",
  "managed_population_husbandry_jobs(id,job_id,workers_per_n_animals)",
  "managed_population_culling_jobs(id,job_id,max_cull_per_worker)",
].join(",");

export function toPopulationResourceEntry(
  row: PopulationResourceEntryRow,
): PopulationResourceEntry {
  return {
    amountPerNAnimals: row.amount_per_n_animals,
    resourceId: row.resource_id,
  };
}

export function toManagedPopulationHusbandryJob(
  row: ManagedPopulationHusbandryJobRow,
): ManagedPopulationHusbandryJob {
  return {
    id: row.id,
    jobId: row.job_id,
    workersPerNAnimals: row.workers_per_n_animals,
  };
}

export function toManagedPopulationCullingJob(
  row: ManagedPopulationCullingJobRow,
): ManagedPopulationCullingJob {
  return {
    id: row.id,
    jobId: row.job_id,
    maxCullPerWorker: row.max_cull_per_worker,
  };
}

export function toManagedPopulationType(
  row: ManagedPopulationTypeRow,
): ManagedPopulationType {
  return {
    createdAt: row.created_at,
    cullingJobs: row.managed_population_culling_jobs.map(
      toManagedPopulationCullingJob,
    ),
    cullingOutputsJson: row.culling_outputs_json.map(toPopulationResourceEntry),
    growthRate: row.growth_rate,
    hasActiveReferences: row.referencing_jobs.length > 0,
    husbandryJobs: row.managed_population_husbandry_jobs.map(
      toManagedPopulationHusbandryJob,
    ),
    icon: row.icon,
    iconColor: row.icon_color,
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
