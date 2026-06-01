import type { DepositType, WorkerInputEntry } from "../types/depositTypes";

export type WorkerInputEntryRow = {
  readonly amount_per_worker: number;
  readonly resource_id: string;
};

export type DepositTypeRow = {
  readonly created_at: string;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly job_id: string;
  readonly name: string;
  readonly output_units_per_worker: number;
  // Embedded FK references — job_definitions whose linked_deposit_type_id = this id.
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly slug: string;
  readonly updated_at: string;
  readonly worker_inputs_json: readonly WorkerInputEntryRow[];
  readonly world_id: string;
};

export const DEPOSIT_TYPE_SELECT = [
  "id,world_id,name,slug,job_id,output_units_per_worker,worker_inputs_json,is_trashed,created_at,updated_at",
  "referencing_jobs:job_definitions!job_definitions_linked_deposit_type_fk(id)",
].join(",");

export function toWorkerInputEntry(row: WorkerInputEntryRow): WorkerInputEntry {
  return {
    amountPerWorker: row.amount_per_worker,
    resourceId: row.resource_id,
  };
}

export function toDepositType(row: DepositTypeRow): DepositType {
  return {
    createdAt: row.created_at,
    hasActiveReferences: row.referencing_jobs.length > 0,
    id: row.id,
    isTrashed: row.is_trashed,
    jobId: row.job_id,
    name: row.name,
    outputUnitsPerWorker: row.output_units_per_worker,
    slug: row.slug,
    updatedAt: row.updated_at,
    workerInputsJson: row.worker_inputs_json.map(toWorkerInputEntry),
    worldId: row.world_id,
  };
}
