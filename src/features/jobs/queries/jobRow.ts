import { parseJobType } from "../utils/parseJobType";

import type { JobDefinition, JobIoEntry } from "../types/jobTypes";

export type JobIoEntryRow = {
  readonly amount_per_worker: number;
  readonly notes?: string;
  readonly resource_id: string;
};

export type JobRow = {
  readonly base_capacity: number | null;
  readonly created_at: string;
  readonly deposit_types: ReadonlyArray<{ readonly id: string }>;
  readonly husbandry_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly culling_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly id: string;
  readonly inputs_json: readonly JobIoEntryRow[];
  readonly is_trashed: boolean;
  readonly job_type: string;
  readonly linked_deposit_type_id: string | null;
  readonly linked_managed_population_type_id: string | null;
  readonly name: string;
  readonly outputs_json: readonly JobIoEntryRow[];
  readonly slug: string;
  readonly trader_capacity_per_worker: number | null;
  readonly updated_at: string;
  readonly world_id: string;
};

export const JOB_SELECT = [
  "id,world_id,name,slug,job_type,base_capacity,trader_capacity_per_worker",
  "linked_deposit_type_id,linked_managed_population_type_id",
  "inputs_json,outputs_json,is_trashed,created_at,updated_at",
  "deposit_types!deposit_types_job_id_fk(id)",
  "husbandry_mpt:managed_population_types!managed_population_types_husbandry_job_fk(id)",
  "culling_mpt:managed_population_types!managed_population_types_culling_job_fk(id)",
].join(",");

export function toJobIoEntry(row: JobIoEntryRow): JobIoEntry {
  const entry: { amountPerWorker: number; notes?: string; resourceId: string } =
    {
      amountPerWorker: row.amount_per_worker,
      resourceId: row.resource_id,
    };
  if (row.notes !== undefined) {
    entry.notes = row.notes;
  }
  return entry;
}

export function toJob(row: JobRow): JobDefinition {
  return {
    baseCapacity: row.base_capacity,
    createdAt: row.created_at,
    hasActiveReferences:
      row.deposit_types.length > 0 ||
      row.husbandry_mpt.length > 0 ||
      row.culling_mpt.length > 0,
    id: row.id,
    inputsJson: row.inputs_json.map(toJobIoEntry),
    isTrashed: row.is_trashed,
    jobType: parseJobType(row.job_type),
    linkedDepositTypeId: row.linked_deposit_type_id,
    linkedManagedPopulationTypeId: row.linked_managed_population_type_id,
    name: row.name,
    outputsJson: row.outputs_json.map(toJobIoEntry),
    slug: row.slug,
    traderCapacityPerWorker: row.trader_capacity_per_worker,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
